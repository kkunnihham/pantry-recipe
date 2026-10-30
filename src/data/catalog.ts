import raw from './catalog.json'
import type { Catalog, Ingredient, Recipe } from './types'

export const catalog = raw as unknown as Catalog

/** 숨김 재료는 냉장고 목록에서 뺀다. 조회는 ingredientById 로. */
export const ingredients: Ingredient[] = catalog.ingredients.filter((i) => !i.hidden)
/** 숨김 처리된 레시피는 목록·추천에서 뺀다. 상세·기록은 recipeById 로 계속 열 수 있다. */
export const recipes: Recipe[] = catalog.recipes.filter((r) => !r.hidden)

export const ingredientById: ReadonlyMap<string, Ingredient> = new Map(catalog.ingredients.map((i) => [i.id, i]))
export const recipeById: ReadonlyMap<string, Recipe> = new Map(catalog.recipes.map((r) => [r.id, r]))
