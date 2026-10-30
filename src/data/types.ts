/**
 * 레시피 데이터 구조 (계획서 3~4절).
 * 수량은 레시피 표시용이며 재고는 있음/부족/없음 세 상태만 쓴다.
 */

export type IngredientCategory =
  | 'veg' // 채소·버섯
  | 'meat_egg' // 육류·달걀
  | 'seafood' // 생선·해물
  | 'dried' // 건어물·육수
  | 'dairy' // 유제품·치즈
  | 'processed' // 가공식품·통조림·김치·두부
  | 'grain' // 곡물·면·빵
  | 'seasoning' // 기본 양념·기름
  | 'sauce' // 소스·향신료
  | 'fruit_etc' // 과일·견과·기타

export const CATEGORY_LABEL: Record<IngredientCategory, string> = {
  veg: '채소·버섯',
  meat_egg: '육류·달걀',
  seafood: '생선·해물',
  dried: '건어물·육수',
  dairy: '유제품·치즈',
  processed: '가공식품·통조림',
  grain: '곡물·면·빵',
  seasoning: '기본 양념·기름',
  sauce: '소스·향신료',
  fruit_etc: '과일·견과·기타',
}

export interface Ingredient {
  id: string
  name: string
  aliases: string[]
  category: IngredientCategory
  /** 기본 양념 체크리스트에 들어가는 상비 재료 */
  staple?: boolean
  /** 냉장고·검색에서 숨김. ID는 유지. */
  hidden?: boolean
  /** 옛 카탈로그 ID (추적용) */
  sourceIds?: string[]
}

export type Role = 'core' | 'major' | 'support' | 'optional'
export type MatchRule = 'one_of' | 'all_of' | 'at_least' | 'optional'

export interface Substitution {
  /** 함께 있어야 하는 구성 재료. 보통 1개. */
  ingredientIds: string[]
  /** 0 초과 1 미만. 핵심 관문은 0.75 이상만 통과. */
  fit: number
  note?: string
}

export interface ReqItem {
  ingredientId: string
  /** 1인분 기준. null이면 "적당량". */
  amount: number | null
  unit: string
  substitutions: Substitution[]
}

export interface ReqGroup {
  id: string
  name: string
  role: Role
  isCoreGate: boolean
  matchRule: MatchRule
  /** at_least 일 때 필요한 개수 */
  minCount?: number
  weight: number
  items: ReqItem[]
}

export interface Step {
  text: string
  timerSeconds: number | null
}

export type Tool = 'air_fryer' | 'microwave' | 'rice_cooker' | 'pressure_cooker' | 'blender' | 'oven'

export const TOOL_LABEL: Record<Tool, string> = {
  air_fryer: '에어프라이어',
  microwave: '전자레인지',
  rice_cooker: '전기밥솥',
  pressure_cooker: '압력솥',
  blender: '블렌더',
  oven: '오븐',
}

export type RecipeKind =
  | 'soup' // 국·찌개
  | 'stirfry' // 볶음
  | 'grill' // 구이
  | 'rice' // 밥
  | 'noodle' // 면
  | 'side' // 반찬
  | 'bread' // 빵·토스트
  | 'snack' // 간식·디저트
  | 'salad' // 샐러드
  | 'fried' // 튀김

export const KIND_LABEL: Record<RecipeKind, string> = {
  soup: '국·찌개',
  stirfry: '볶음',
  grill: '구이',
  rice: '밥',
  noodle: '면',
  side: '반찬',
  bread: '빵·토스트',
  snack: '간식',
  salad: '샐러드',
  fried: '튀김',
}

export type Cuisine = 'korean' | 'chinese' | 'japanese' | 'western' | 'southeast_asian' | 'south_asian' | 'middle_eastern' | 'other'
export type Meal = 'main' | 'side' | 'soup' | 'snack' | 'breakfast'
export type Method = 'boil' | 'stirfry' | 'grill' | 'fry' | 'steam' | 'no_cook' | 'air_fry' | 'microwave'
export type Difficulty = 'very_easy' | 'easy' | 'normal' | 'hard'

export interface WaterNeed {
  name: string
  amountMl: number
}

export interface Recipe {
  id: string
  sourceId?: string
  title: string
  aliases: string[]
  summary: string
  tier: 'basic' | 'discovery'
  kind: RecipeKind
  cuisine: Cuisine
  meal: Meal[]
  method: Method
  minutes: number
  difficulty: Difficulty
  /** 재료 양이 기준으로 삼는 인분. 앱은 (선택 인분 / 기준 인분) 배수로 환산한다. */
  baseServings: number
  /** 있으면 인분 환산을 끄고 이 문구로 표시한다 (예: '한 번 담그는 양'). */
  fixedYield?: string
  /** 목록·추천에서 숨김. ID는 유지한다 (기록 호환). */
  hidden?: boolean
  tools: Tool[]
  groups: ReqGroup[]
  /** 레시피에 명시된 물. 재고와 무관. */
  water?: WaterNeed[]
  steps: Step[]
  /** draft: 옛 카탈로그에서 가져온 그대로. reviewed: 재작성·검토 완료. */
  contentStatus: 'draft' | 'reviewed'
}

export interface Catalog {
  version: string
  generatedAt: string
  ingredients: Ingredient[]
  recipes: Recipe[]
}
