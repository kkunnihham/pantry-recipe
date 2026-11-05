/**
 * 주 재료 버킷 (계획서 9절).
 * 레시피에 따로 적지 않고 "꼭 필요" 그룹의 재료에서 뽑는다. 한 레시피가 여러 버킷에 들어갈 수 있다.
 */
import { ingredientById } from './catalog'
import type { Recipe } from './types'

export type MainBucket =
  | 'pork'
  | 'beef'
  | 'chicken'
  | 'egg'
  | 'tofu'
  | 'kimchi'
  | 'ham'
  | 'seafood'
  | 'dairy'
  | 'veg'
  | 'potato'
  | 'noodle'

export const MAIN_BUCKET_ORDER: MainBucket[] = ['pork', 'beef', 'chicken', 'egg', 'tofu', 'kimchi', 'ham', 'seafood', 'dairy', 'veg', 'potato', 'noodle']

export const MAIN_BUCKET_LABEL: Record<MainBucket, string> = {
  pork: '돼지고기',
  beef: '소고기',
  chicken: '닭고기',
  egg: '달걀',
  tofu: '두부',
  kimchi: '김치',
  ham: '햄·소시지·베이컨',
  seafood: '생선·해물',
  dairy: '치즈·우유',
  veg: '채소·버섯',
  potato: '감자·고구마',
  noodle: '면·떡·빵',
}

/** 재료 이름 → 버킷. 여기 없는 채소·해조류는 범주로 '채소·버섯'에 넣는다. */
const BY_NAME: Record<string, MainBucket> = {
  '돼지고기 (볶음·찌개용)': 'pork', 삼겹살: 'pork', '다진 돼지고기': 'pork', 돼지갈비: 'pork', '돼지 목살 (구이용)': 'pork', '돼지 등뼈': 'pork', 항정살: 'pork',
  '소고기 국거리': 'beef', '소고기 (불고기·볶음용)': 'beef', '다진 소고기': 'beef', '소고기 (구이용)': 'beef', 소갈비: 'beef', LA갈비: 'beef',
  닭다리살: 'chicken', 닭가슴살: 'chicken', '뼈 있는 닭다리': 'chicken', 통닭: 'chicken', '냉동 치킨너겟': 'chicken',
  달걀: 'egg', 메추리알: 'egg',
  두부: 'tofu', 순두부: 'tofu', 유부: 'tofu', 청국장: 'tofu',
  배추김치: 'kimchi', 깍두기: 'kimchi', 열무김치: 'kimchi',
  '통조림 햄 (스팸)': 'ham', 햄: 'ham', 소시지: 'ham', 비엔나소시지: 'ham', 베이컨: 'ham', 어묵: 'ham',
  '냉동 새우': 'seafood', 오징어: 'seafood', 바지락: 'seafood', 고등어: 'seafood', 연어: 'seafood', 명란: 'seafood', '꽁치 통조림': 'seafood', 삼치: 'seafood', '참치 통조림': 'seafood', 잔멸치: 'seafood',
  우유: 'dairy', 생크림: 'dairy', 체다치즈: 'dairy', '슬라이스 치즈': 'dairy', 모짜렐라치즈: 'dairy', 파르메산치즈: 'dairy', 크림치즈: 'dairy', '플레인 요거트': 'dairy', 그릭요거트: 'dairy', 사워크림: 'dairy',
  감자: 'potato', 고구마: 'potato', 단호박: 'potato', '냉동 감자튀김': 'potato',
  소면: 'noodle', 우동면: 'noodle', 칼국수면: 'noodle', 스파게티면: 'noodle', 당면: 'noodle', 라면: 'noodle', 중화면: 'noodle', 쌀국수면: 'noodle', 쫄면: 'noodle', 메밀면: 'noodle',
  '숏파스타 (펜네·마카로니)': 'noodle', 떡볶이떡: 'noodle', 떡국떡: 'noodle', 식빵: 'noodle', 또띠아: 'noodle', 바게트: 'noodle', 통밀빵: 'noodle', 모닝빵: 'noodle', '냉동 만두': 'noodle', 만두피: 'noodle',
  // 해조·통조림 채소는 채소 쪽으로
  김: 'veg', 조미김: 'veg', '마른 미역': 'veg', 미역줄기: 'veg', '옥수수 통조림': 'veg', '토마토 통조림': 'veg', 도토리묵: 'veg', 콩나물: 'veg', 단무지: 'veg',
}

/** 다른 주 재료가 하나도 없을 때만 쓰는 마지막 기준 (어니언링의 양파, 오니기리의 밥, 차파티의 밀가루). */
const LAST_RESORT: Record<string, MainBucket> = {
  양파: 'veg', 대파: 'veg', 마늘: 'veg', 청양고추: 'veg', 생강: 'veg', 쪽파: 'veg',
  밥: 'noodle', 쌀: 'noodle', 밀가루: 'noodle', 부침가루: 'noodle', 튀김가루: 'noodle',
}

/** 버킷을 정하기엔 너무 흔한 재료. 채소 범주라도 이것만으로는 '채소·버섯'이 되지 않는다. */
const TOO_COMMON = new Set(['양파', '대파', '마늘', '청양고추', '생강', '쪽파'])

function bucketOf(ingredientId: string, lastResort: boolean): MainBucket | null {
  const ing = ingredientById.get(ingredientId)
  if (!ing) return null
  const named = BY_NAME[ing.name]
  if (named) return named
  if (ing.category === 'veg' && !TOO_COMMON.has(ing.name)) return 'veg'
  return lastResort ? (LAST_RESORT[ing.name] ?? null) : null
}

function bucketsFromGroups(recipe: Recipe, roles: ReadonlySet<string>, lastResort = false): MainBucket[] {
  const out = new Set<MainBucket>()
  for (const g of recipe.groups) {
    if (!roles.has(g.role)) continue
    for (const it of g.items) {
      const b = bucketOf(it.ingredientId, lastResort)
      if (b) out.add(b)
    }
  }
  return MAIN_BUCKET_ORDER.filter((b) => out.has(b))
}

const CORE = new Set(['core'])
const CORE_MAJOR = new Set(['core', 'major'])

/** 레시피의 주 재료 버킷. "꼭 필요" 그룹 → "중요" 그룹까지 → 마지막 기준 순으로 찾는다. */
export function mainBucketsOf(recipe: Recipe): MainBucket[] {
  const core = bucketsFromGroups(recipe, CORE)
  if (core.length > 0) return core
  const major = bucketsFromGroups(recipe, CORE_MAJOR)
  if (major.length > 0) return major
  // 마지막 기준은 하나만. 어니언링은 밀가루보다 양파(채소)가 주인공이다.
  const last = bucketsFromGroups(recipe, CORE_MAJOR, true)
  return last.includes('veg') ? ['veg'] : last.slice(0, 1)
}

const cache = new Map<string, MainBucket[]>()
export function mainBucketsCached(recipe: Recipe): MainBucket[] {
  let v = cache.get(recipe.id)
  if (!v) {
    v = mainBucketsOf(recipe)
    cache.set(recipe.id, v)
  }
  return v
}
