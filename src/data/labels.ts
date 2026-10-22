import type { Cuisine, Difficulty, Meal, Method, Role } from './types'

export const CUISINE_LABEL: Record<Cuisine, string> = {
  korean: '한식',
  chinese: '중식',
  japanese: '일식',
  western: '양식',
  southeast_asian: '동남아',
  south_asian: '인도·남아시아',
  middle_eastern: '중동',
  other: '기타',
}

export const MEAL_LABEL: Record<Meal, string> = {
  main: '메인',
  side: '반찬',
  soup: '국물',
  snack: '간식',
  breakfast: '아침',
}

export const METHOD_LABEL: Record<Method, string> = {
  boil: '끓이기',
  stirfry: '볶기',
  grill: '굽기',
  fry: '튀기기',
  steam: '찌기',
  no_cook: '불 없이',
  air_fry: '에어프라이어',
  microwave: '전자레인지',
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  very_easy: '아주 쉬움',
  easy: '쉬움',
  normal: '보통',
  hard: '어려움',
}

export const ROLE_LABEL: Record<Role, string> = {
  core: '꼭 필요',
  major: '중요',
  support: '양념·보조',
  optional: '선택',
}

export const TIER_LABEL = { basic: '기본', discovery: '발견' } as const
