import raw from './catalog.json'
import type { Catalog, Ingredient, Recipe } from './types'

export const catalog = raw as unknown as Catalog

export const ingredients: Ingredient[] = catalog.ingredients
/** 숨김 처리된 레시피는 목록·추천에서 뺀다. 상세·기록은 recipeById 로 계속 열 수 있다. */
export const recipes: Recipe[] = catalog.recipes.filter((r) => !r.hidden)

export const ingredientById: ReadonlyMap<string, Ingredient> = new Map(ingredients.map((i) => [i.id, i]))
export const recipeById: ReadonlyMap<string, Recipe> = new Map(catalog.recipes.map((r) => [r.id, r]))
