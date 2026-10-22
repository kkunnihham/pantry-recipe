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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 백업용: 유효한 항목만 남기고 모든 사용자 데이터를 한 번에 교체한다. */
export async function importAll(data: unknown): Promise<{ inventory: number; cookLog: number; ratings: number; shopping: number }> {
  if (!isRecord(data) || data.format !== 'pantry-recipe-backup' || data.version !== 1) {
    throw new Error('백업 파일 형식이 아니에요')
  }

  const now = Date.now()
  const inventory: InventoryRow[] = []
  for (const row of Array.isArray(data.inventory) ? data.inventory : []) {
    if (!isRecord(row) || typeof row.ingredientId !== 'string' || (row.state !== 'have' && row.state !== 'low' && row.state !== 'none')) continue
    inventory.push({
      ingredientId: row.ingredientId,
      state: row.state,
      updatedAt: typeof row.updatedAt === 'number' && Number.isFinite(row.updatedAt) ? row.updatedAt : now,
    })
  }
  const cookLog: CookLogRow[] = []
  for (const row of Array.isArray(data.cookLog) ? data.cookLog : []) {
    if (!isRecord(row) || typeof row.recipeId !== 'string' || typeof row.cookedAt !== 'number' || !Number.isFinite(row.cookedAt)
      || typeof row.servings !== 'number' || !Number.isFinite(row.servings)) continue
    cookLog.push({ recipeId: row.recipeId, cookedAt: row.cookedAt, servings: row.servings })
  }
  const ratings: RatingRow[] = []
  for (const row of Array.isArray(data.ratings) ? data.ratings : []) {
    if (!isRecord(row) || typeof row.recipeId !== 'string' || (row.rating !== 'again' && row.rating !== 'meh')) continue
    ratings.push({
      recipeId: row.recipeId,
      rating: row.rating,
      ratedAt: typeof row.ratedAt === 'number' && Number.isFinite(row.ratedAt) ? row.ratedAt : now,
    })
  }
  const shopping: ShoppingRow[] = []
  for (const row of Array.isArray(data.shopping) ? data.shopping : []) {
    if (!isRecord(row) || typeof row.ingredientId !== 'string' || typeof row.addedAt !== 'number' || !Number.isFinite(row.addedAt)
      || !Array.isArray(row.fromRecipeIds) || !row.fromRecipeIds.every((id) => typeof id === 'string') || typeof row.checked !== 'boolean') continue
    shopping.push({ ingredientId: row.ingredientId, addedAt: row.addedAt, fromRecipeIds: row.fromRecipeIds, checked: row.checked })
  }

  const db = await getDB()
  const stores = ['inventory', 'cookLog', 'ratings', 'shopping', 'kv'] as const
  const tx = db.transaction(stores, 'readwrite')
  try {
    await Promise.all(stores.map((store) => tx.objectStore(store).clear()))
    for (const row of inventory) await tx.objectStore('inventory').put(row)
    for (const row of cookLog) await tx.objectStore('cookLog').add(row)
    for (const row of ratings) await tx.objectStore('ratings').put(row)
    for (const row of shopping) await tx.objectStore('shopping').put(row)
    if (isRecord(data.kv)) {
      for (const [key, value] of Object.entries(data.kv)) await tx.objectStore('kv').put(value, key)
    }
    const [inventoryCount, cookLogCount, ratingsCount, shoppingCount] = await Promise.all([
      tx.objectStore('inventory').count(),
      tx.objectStore('cookLog').count(),
      tx.objectStore('ratings').count(),
      tx.objectStore('shopping').count(),
    ])
    await tx.done
    return { inventory: inventoryCount, cookLog: cookLogCount, ratings: ratingsCount, shopping: shoppingCount }
  } catch (error) {
    try {
      tx.abort()
    } catch {
      // 요청 오류로 이미 중단된 트랜잭션일 수 있다.
    }
    await tx.done.catch(() => {})
    throw error
  }
}
