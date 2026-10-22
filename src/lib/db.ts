import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

/** 재고 상태. 수량은 추적하지 않는다. */
export type StockState = 'have' | 'low' | 'none'

export interface InventoryRow {
  ingredientId: string
  state: StockState
  updatedAt: number
}

export interface CookLogRow {
  id?: number
  recipeId: string
  cookedAt: number
  servings: number
  photo?: Blob
}

export type Rating = 'again' | 'meh'

export interface RatingRow {
  recipeId: string
  rating: Rating
  ratedAt: number
}

export interface ShoppingRow {
  ingredientId: string
  addedAt: number
  fromRecipeIds: string[]
  checked: boolean
}

interface PantryDB extends DBSchema {
  inventory: { key: string; value: InventoryRow }
  cookLog: { key: number; value: CookLogRow; indexes: { byRecipe: string; byDate: number } }
  ratings: { key: string; value: RatingRow }
  shopping: { key: string; value: ShoppingRow }
  kv: { key: string; value: unknown }
}

const DB_NAME = 'pantry-recipe'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<PantryDB>> | null = null

export function getDB(): Promise<IDBPDatabase<PantryDB>> {
  if (!dbPromise) {
    dbPromise = openDB<PantryDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore('inventory', { keyPath: 'ingredientId' })
        const log = db.createObjectStore('cookLog', { keyPath: 'id', autoIncrement: true })
        log.createIndex('byRecipe', 'recipeId')
        log.createIndex('byDate', 'cookedAt')
        db.createObjectStore('ratings', { keyPath: 'recipeId' })
        db.createObjectStore('shopping', { keyPath: 'ingredientId' })
        db.createObjectStore('kv')
      },
    })
  }
  return dbPromise
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const db = await getDB()
  return (await db.get('kv', key)) as T | undefined
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  const db = await getDB()
  await db.put('kv', value, key)
}

/** 백업용: 사진(Blob)을 제외한 모든 사용자 데이터를 한 객체로 모은다. */
export async function exportAll() {
  const db = await getDB()
  const [inventory, cookLog, ratings, shopping] = await Promise.all([
    db.getAll('inventory'),
    db.getAll('cookLog'),
    db.getAll('ratings'),
    db.getAll('shopping'),
  ])
  const kvKeys = await db.getAllKeys('kv')
  const kv: Record<string, unknown> = {}
  for (const k of kvKeys) kv[k] = await db.get('kv', k)
  return {
    format: 'pantry-recipe-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    inventory,
    cookLog: cookLog.map(({ photo: _photo, ...rest }) => rest),
    ratings,
    shopping,
    kv,
  }
}
