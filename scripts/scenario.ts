/**
 * 추천 엔진을 가상의 냉장고로 돌려 결과를 표로 찍는다. 개발 확인용.
 * 사용: npx vite-node scripts/scenario.ts [재료이름,재료이름,...]
 * 재료를 안 주면 "전형적인 냉장고"를 쓴다. 기본 양념은 항상 포함.
 */
import { ingredients, recipes, recipeById, ingredientById } from '../src/data/catalog'
import type { Tool } from '../src/data/types'
import { evaluateAll, type StockState } from '../src/engine/recommend'
import { dateKey, pickDiscovery } from '../src/engine/discovery'

const byName = new Map(ingredients.map((i) => [i.name, i.id]))
const arg = process.argv[2]
const names = arg
  ? arg.split(',').map((s) => s.trim())
  : ['달걀', '양파', '대파', '감자', '당근', '배추김치', '두부', '밥', '식빵', '돼지고기 (볶음·찌개용)', '통조림 햄 (스팸)', '우유', '슬라이스 치즈', '토마토']

const inventory = new Map<string, StockState>()
for (const i of ingredients) if (i.staple) inventory.set(i.id, 'have')
for (const n of names) {
  const id = byName.get(n)
  if (!id) {
    console.error(`사전에 없는 재료: ${n}`)
    process.exit(1)
  }
  inventory.set(id, 'have')
}
const name = (id: string) => ingredientById.get(id)?.name ?? id
const ownedTools = new Set<Tool>(['air_fryer', 'microwave', 'rice_cooker'])
const r = evaluateAll(recipes, { inventory, ownedTools })

console.log(`냉장고: 기본 양념 + ${names.join(', ')}\n`)
console.log(`[바로 가능 ${r.ready.length}]`)
for (const x of r.ready) {
  const t = recipeById.get(x.recipeId)!
  const subs = x.usedSubstitutions.map((s) => `${name(s.forIngredientId)}→${s.viaIngredientIds.map(name).join('+')}`).join(', ')
  const miss = x.missingOptionalNames.length ? ` (없음: ${x.missingOptionalNames.join(', ')})` : ''
  console.log(`  ${x.sortScore.toString().padStart(5)}  ${t.title.padEnd(14)} ${x.bucket === 'ready_substituted' ? '대체 ' + subs : ''}${miss}`)
}
console.log(`\n[1~2개만 사면 ${r.near.length}]`)
for (const x of r.near) {
  const t = recipeById.get(x.recipeId)!
  console.log(`  ${x.sortScore.toString().padStart(5)}  ${t.title.padEnd(14)} 살 것: ${x.missingCore.flatMap((m) => m.buy).map(name).join(', ')}`)
}
const hiddenByReason = new Map<string, string[]>()
for (const x of r.hidden) hiddenByReason.set(x.hiddenReason!, [...(hiddenByReason.get(x.hiddenReason!) ?? []), recipeById.get(x.recipeId)!.title])
console.log(`\n[숨김 ${r.hidden.length}]`)
for (const [why, titles] of hiddenByReason) console.log(`  ${why}: ${titles.join(', ')}`)
const pick = pickDiscovery(r.ready, { dateKey: dateKey(), tierOf: (id) => recipeById.get(id)!.tier })
console.log(`\n오늘의 발견(${dateKey()}): ${pick ? recipeById.get(pick.recipeId)!.title : '없음'}`)
