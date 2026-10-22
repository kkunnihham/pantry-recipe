import raw from './catalog.json'
import type { Catalog, Ingredient, Recipe } from './types'

export const catalog = raw as unknown as Catalog

export const ingredients: Ingredient[] = catalog.ingredients
export const recipes: Recipe[] = catalog.recipes

export const ingredientById: ReadonlyMap<string, Ingredient> = new Map(ingredients.map((i) => [i.id, i]))
export const recipeById: ReadonlyMap<string, Recipe> = new Map(recipes.map((r) => [r.id, r]))
