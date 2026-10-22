import { describe, expect, it } from 'vitest'
import { ingredients, recipes, recipeById } from '../data/catalog'
import type { Tool } from '../data/types'
import { evaluateAll, evaluateRecipe, type StockState } from './recommend'
import { dateKey, pickDiscovery } from './discovery'

const byName = new Map(ingredients.map((i) => [i.name, i.id]))
function id(name: string): string {
  const v = byName.get(name)
  if (!v) throw new Error(`식재료 없음: ${name}`)
  return v
}
function recipe(title: string) {
  const r = recipes.find((x) => x.title === title)
  if (!r) throw new Error(`레시피 없음: ${title}`)
  return r
}
function inv(have: string[], low: string[] = []): Map<string, StockState> {
  const m = new Map<string, StockState>()
  for (const n of have) m.set(id(n), 'have')
  for (const n of low) m.set(id(n), 'low')
  return m
}
const STAPLES = ingredients.filter((i) => i.staple).map((i) => i.name)
const TOOLS = new Set<Tool>(['air_fryer', 'microwave', 'rice_cooker'])
const base = { ownedTools: TOOLS, now: Date.parse('2026-10-22T12:00:00Z') }

describe('핵심 관문과 구역', () => {
  it('빈 냉장고면 전부 숨김', () => {
    const r = evaluateAll(recipes, { ...base, inventory: new Map() })
    expect(r.ready).toHaveLength(0)
    expect(r.near).toHaveLength(0)
    expect(r.hidden).toHaveLength(recipes.length)
  })

  it('김치찌개: 김치+돼지고기+기본 양념이면 바로 가능', () => {
    const rec = evaluateRecipe(recipe('김치찌개'), { ...base, inventory: inv([...STAPLES, '배추김치', '돼지고기 (볶음·찌개용)', '두부', '대파']) })
    expect(rec.bucket).toBe('ready_exact')
    expect(rec.missingCore).toHaveLength(0)
    expect(rec.matchPercent).toBeGreaterThan(80)
  })

  it('김치찌개: 돼지고기 대신 스팸이 있으면 대체해서 가능', () => {
    const rec = evaluateRecipe(recipe('김치찌개'), { ...base, inventory: inv([...STAPLES, '배추김치', '통조림 햄 (스팸)']) })
    expect(rec.bucket).toBe('ready_substituted')
    expect(rec.usedSubstitutions[0].viaIngredientIds).toEqual([id('통조림 햄 (스팸)')])
  })

  it('김치찌개: 김치만 있으면 돼지고기 1개만 사면 됨', () => {
    const rec = evaluateRecipe(recipe('김치찌개'), { ...base, inventory: inv([...STAPLES, '배추김치']) })
    expect(rec.bucket).toBe('near')
    expect(rec.purchaseCount).toBe(1)
    expect(rec.missingCore[0].buy).toEqual([id('돼지고기 (볶음·찌개용)')])
  })

  it('비빔밥 원칙: 양념만 다 있고 핵심 재료가 없으면 추천하지 않음', () => {
    const rec = evaluateRecipe(recipe('제육볶음'), { ...base, inventory: inv(STAPLES.filter((s) => s !== '고추장')) })
    expect(rec.bucket).toBe('hidden')
    expect(rec.hiddenReason).toBe('core_missing')
  })

  it('all_of 핵심 그룹: 데리야키 소스 중 맛술이 없으면 1개만 사면', () => {
    const rec = evaluateRecipe(recipe('데리야키 치킨'), { ...base, inventory: inv(['닭다리살', '간장', '설탕', '식용유']) })
    expect(rec.bucket).toBe('near')
    expect(rec.missingCore[0].buy).toEqual([id('맛술')])
  })

  it('at_least 핵심 그룹: 부대찌개는 스팸만 있어도 가공육 관문 통과', () => {
    const rec = evaluateRecipe(recipe('부대찌개'), { ...base, inventory: inv([...STAPLES, '배추김치', '통조림 햄 (스팸)']) })
    expect(rec.bucket).toBe('ready_exact')
  })

  it('at_least 핵심 그룹: 가공육이 하나도 없으면 1개만 사면', () => {
    const rec = evaluateRecipe(recipe('부대찌개'), { ...base, inventory: inv([...STAPLES, '배추김치', '라면']) })
    expect(rec.bucket).toBe('near')
    expect(rec.purchaseCount).toBe(1)
  })

  it('적합도 0.75 미만 대체재는 핵심 관문을 못 넘음', () => {
    // 유린기: 전분 대신 밀가루(0.75)는 통과, 가상의 더 낮은 값은 실패해야 함 → 설정을 올려 확인
    const inventory = inv([...STAPLES, '닭다리살', '밀가루', '대파'])
    const ok = evaluateRecipe(recipe('유린기'), { ...base, inventory })
    expect(ok.bucket).toBe('ready_substituted')
    const strict = evaluateRecipe(recipe('유린기'), { ...base, inventory, config: { coreSubstituteMinFit: 0.8 } })
    expect(strict.bucket).toBe('near')
  })
})

describe('도구·평가·최근 조리', () => {
  it('전자레인지가 없으면 떠먹는 치즈감자는 숨김', () => {
    const inventory = inv([...STAPLES, '감자', '모짜렐라치즈'])
    const withTool = evaluateRecipe(recipe('떠먹는 치즈감자'), { ...base, inventory })
    expect(withTool.bucket).toBe('ready_exact')
    const noTool = evaluateRecipe(recipe('떠먹는 치즈감자'), { ...base, inventory, ownedTools: new Set() })
    expect(noTool.bucket).toBe('hidden')
    expect(noTool.hiddenReason).toBe('tool')
  })

  it('"별로" 평가는 숨김', () => {
    const rec = evaluateRecipe(recipe('계란후라이'), { ...base, inventory: inv([...STAPLES, '달걀']), ratings: new Map([[recipe('계란후라이').id, 'meh']]) })
    expect(rec.bucket).toBe('hidden')
    expect(rec.hiddenReason).toBe('meh')
  })

  it('최근 7일 안에 먹은 요리는 정렬 점수가 내려감', () => {
    const inventory = inv([...STAPLES, '달걀'])
    const fresh = evaluateRecipe(recipe('계란후라이'), { ...base, inventory })
    const recent = evaluateRecipe(recipe('계란후라이'), { ...base, inventory, lastCooked: new Map([[recipe('계란후라이').id, base.now - 2 * 86400000]]) })
    const old = evaluateRecipe(recipe('계란후라이'), { ...base, inventory, lastCooked: new Map([[recipe('계란후라이').id, base.now - 10 * 86400000]]) })
    expect(recent.sortScore).toBeLessThan(fresh.sortScore)
    expect(old.sortScore).toBe(fresh.sortScore)
    expect(recent.cookedRecently).toBe(true)
  })

  it('"부족" 재료는 관문을 통과하지만 표시되고 감점됨', () => {
    const have = evaluateRecipe(recipe('계란후라이'), { ...base, inventory: inv([...STAPLES, '달걀']) })
    const low = evaluateRecipe(recipe('계란후라이'), { ...base, inventory: inv(STAPLES, ['달걀']) })
    expect(low.bucket).toBe('ready_exact')
    expect(low.lowIngredientIds).toEqual([id('달걀')])
    expect(low.sortScore).toBeLessThan(have.sortScore)
  })
})

describe('전형적인 냉장고', () => {
  const fridge = inv([...STAPLES, '달걀', '양파', '대파', '감자', '당근', '배추김치', '두부', '밥', '식빵', '돼지고기 (볶음·찌개용)', '통조림 햄 (스팸)', '우유', '슬라이스 치즈', '토마토'])

  it('바로 가능한 레시피가 여럿 나오고 점수순으로 정렬된다', () => {
    const r = evaluateAll(recipes, { ...base, inventory: fridge })
    expect(r.ready.length).toBeGreaterThanOrEqual(8)
    // 바로 가능이 대체 가능보다 먼저, 각 구역 안에서는 점수 내림차순
    const exactIdx = r.ready.map((x) => x.bucket).lastIndexOf('ready_exact')
    const subIdx = r.ready.map((x) => x.bucket).indexOf('ready_substituted')
    if (exactIdx >= 0 && subIdx >= 0) expect(exactIdx).toBeLessThan(subIdx)
    for (const bucket of ['ready_exact', 'ready_substituted'] as const) {
      const zone = r.ready.filter((x) => x.bucket === bucket)
      for (let i = 1; i < zone.length; i++) {
        expect(zone[i - 1].sortScore).toBeGreaterThanOrEqual(zone[i].sortScore)
      }
    }
    const titles = r.ready.map((x) => recipeById.get(x.recipeId)!.title)
    expect(titles).toContain('김치찌개')
    expect(titles).toContain('계란볶음밥')
    expect(titles).toContain('토마토달걀볶음')
  })

  it('"1~2개만 사면" 목록은 구매 수가 2 이하다', () => {
    const r = evaluateAll(recipes, { ...base, inventory: fridge })
    expect(r.near.length).toBeGreaterThan(0)
    for (const n of r.near) {
      expect(n.purchaseCount).toBeGreaterThanOrEqual(1)
      expect(n.purchaseCount).toBeLessThanOrEqual(2)
    }
  })

  it('오늘의 발견은 안 해본 발견층 레시피에서 하루 동안 고정된다', () => {
    const r = evaluateAll(recipes, { ...base, inventory: fridge })
    const tierOf = (rid: string) => recipeById.get(rid)!.tier
    const a = pickDiscovery(r.ready, { dateKey: '2026-10-22', tierOf })
    const b = pickDiscovery(r.ready, { dateKey: '2026-10-22', tierOf })
    expect(a).not.toBeNull()
    expect(a!.recipeId).toBe(b!.recipeId)
    expect(tierOf(a!.recipeId)).toBe('discovery')
    const c = pickDiscovery(r.ready, { dateKey: '2026-10-22', tierOf, skipIds: new Set([a!.recipeId]) })
    expect(c!.recipeId).not.toBe(a!.recipeId)
  })

  it('해 본 요리는 발견에서 빠진다', () => {
    const r = evaluateAll(recipes, { ...base, inventory: fridge })
    const tierOf = (rid: string) => recipeById.get(rid)!.tier
    const discIds = r.ready.filter((x) => tierOf(x.recipeId) === 'discovery').map((x) => x.recipeId)
    const lastCooked = new Map(discIds.map((rid) => [rid, base.now - 30 * 86400000]))
    const r2 = evaluateAll(recipes, { ...base, inventory: fridge, lastCooked })
    const pick = pickDiscovery(r2.ready, { dateKey: dateKey(base.now), tierOf })
    // 발견층을 다 해봤으면 기본층의 안 해본 것으로 내려간다
    expect(pick === null || tierOf(pick.recipeId) === 'basic').toBe(true)
  })
})
