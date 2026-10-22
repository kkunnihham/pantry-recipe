/**
 * 앱 상태 저장소. 메모리에 두고 변경할 때마다 IndexedDB에 쓴다.
 * React에서는 useAppState()로 읽는다.
 */
import { useSyncExternalStore } from 'react'
import { getDB, kvGet, kvSet, type CookLogRow, type InventoryRow, type Rating, type RatingRow, type ShoppingRow, type StockState } from '../lib/db'
import type { Tool } from '../data/types'

export interface AppState {
  loaded: boolean
  inventory: ReadonlyMap<string, StockState>
  ownedTools: ReadonlySet<Tool>
  staplesDone: boolean
  /** recipeId → 마지막 조리 시각 */
  lastCooked: ReadonlyMap<string, number>
  /** recipeId → 조리 횟수 */
  cookCount: ReadonlyMap<string, number>
  ratings: ReadonlyMap<string, Rating>
  shopping: ReadonlyMap<string, ShoppingRow>
  /** 오늘 발견에서 "다른 것 보기"로 건너뛴 레시피 */
  discoverySkips: { date: string; ids: string[] }
}

const DEFAULT_TOOLS: Tool[] = ['air_fryer', 'microwave', 'rice_cooker']

let state: AppState = {
  loaded: false,
  inventory: new Map(),
  ownedTools: new Set(DEFAULT_TOOLS),
  staplesDone: false,
  lastCooked: new Map(),
  cookCount: new Map(),
  ratings: new Map(),
  shopping: new Map(),
  discoverySkips: { date: '', ids: [] },
}

const listeners = new Set<() => void>()

function emit(next: AppState) {
  state = next
  for (const l of listeners) l()
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, () => state, () => state)
}

export function getState(): AppState {
  return state
}

export async function loadState(): Promise<void> {
  const db = await getDB()
  const [invRows, logRows, ratingRows, shopRows, tools, staplesDone, skips] = await Promise.all([
    db.getAll('inventory'),
    db.getAll('cookLog'),
    db.getAll('ratings'),
    db.getAll('shopping'),
    kvGet<Tool[]>('ownedTools'),
    kvGet<boolean>('staplesDone'),
    kvGet<{ date: string; ids: string[] }>('discoverySkips'),
  ])
  const lastCooked = new Map<string, number>()
  const cookCount = new Map<string, number>()
  for (const row of logRows) {
    lastCooked.set(row.recipeId, Math.max(lastCooked.get(row.recipeId) ?? 0, row.cookedAt))
    cookCount.set(row.recipeId, (cookCount.get(row.recipeId) ?? 0) + 1)
  }
  emit({
    loaded: true,
    inventory: new Map(invRows.filter((r) => r.state !== 'none').map((r) => [r.ingredientId, r.state])),
    ownedTools: new Set(tools ?? DEFAULT_TOOLS),
    staplesDone: staplesDone ?? false,
    lastCooked,
    cookCount,
    ratings: new Map(ratingRows.map((r) => [r.recipeId, r.rating])),
    shopping: new Map(shopRows.map((r) => [r.ingredientId, r])),
    discoverySkips: skips ?? { date: '', ids: [] },
  })
}

export async function setStock(ingredientId: string, stock: StockState): Promise<void> {
  const inventory = new Map(state.inventory)
  if (stock === 'none') inventory.delete(ingredientId)
  else inventory.set(ingredientId, stock)
  emit({ ...state, inventory })
  const db = await getDB()
  const row: InventoryRow = { ingredientId, state: stock, updatedAt: Date.now() }
  if (stock === 'none') await db.delete('inventory', ingredientId)
  else await db.put('inventory', row)
}

export async function setStocks(entries: Array<[string, StockState]>): Promise<void> {
  const inventory = new Map(state.inventory)
  for (const [id, s] of entries) {
    if (s === 'none') inventory.delete(id)
    else inventory.set(id, s)
  }
  emit({ ...state, inventory })
  const db = await getDB()
  const tx = db.transaction('inventory', 'readwrite')
  const now = Date.now()
  for (const [id, s] of entries) {
    if (s === 'none') await tx.store.delete(id)
    else await tx.store.put({ ingredientId: id, state: s, updatedAt: now })
  }
  await tx.done
}

export async function setOwnedTools(tools: Tool[]): Promise<void> {
  emit({ ...state, ownedTools: new Set(tools) })
  await kvSet('ownedTools', tools)
}

export async function setStaplesDone(done: boolean): Promise<void> {
  emit({ ...state, staplesDone: done })
  await kvSet('staplesDone', done)
}

export async function addDiscoverySkip(date: string, recipeId: string): Promise<void> {
  const prev = state.discoverySkips.date === date ? state.discoverySkips.ids : []
  const next = { date, ids: [...prev, recipeId] }
  emit({ ...state, discoverySkips: next })
  await kvSet('discoverySkips', next)
}

export async function logCook(recipeId: string, servings: number, photo?: Blob): Promise<void> {
  const cookedAt = Date.now()
  const lastCooked = new Map(state.lastCooked)
  lastCooked.set(recipeId, cookedAt)
  const cookCount = new Map(state.cookCount)
  cookCount.set(recipeId, (cookCount.get(recipeId) ?? 0) + 1)
  emit({ ...state, lastCooked, cookCount })
  const db = await getDB()
  const row: CookLogRow = { recipeId, cookedAt, servings, ...(photo ? { photo } : {}) }
  await db.add('cookLog', row)
}

export async function rateRecipe(recipeId: string, rating: Rating | null): Promise<void> {
  const ratings = new Map(state.ratings)
  if (rating) ratings.set(recipeId, rating)
  else ratings.delete(recipeId)
  emit({ ...state, ratings })
  const db = await getDB()
  if (rating) {
    const row: RatingRow = { recipeId, rating, ratedAt: Date.now() }
    await db.put('ratings', row)
  } else await db.delete('ratings', recipeId)
}

export async function addToShopping(ingredientId: string, fromRecipeId?: string): Promise<void> {
  const prev = state.shopping.get(ingredientId)
  const row: ShoppingRow = {
    ingredientId,
    addedAt: prev?.addedAt ?? Date.now(),
    fromRecipeIds: [...new Set([...(prev?.fromRecipeIds ?? []), ...(fromRecipeId ? [fromRecipeId] : [])])],
    checked: false,
  }
  const shopping = new Map(state.shopping)
  shopping.set(ingredientId, row)
  emit({ ...state, shopping })
  const db = await getDB()
  await db.put('shopping', row)
}

export async function removeFromShopping(ingredientId: string): Promise<void> {
  const shopping = new Map(state.shopping)
  shopping.delete(ingredientId)
  emit({ ...state, shopping })
  const db = await getDB()
  await db.delete('shopping', ingredientId)
}

/** 장보기 체크: 재고를 "있음"으로 올리고 목록에서 뺀다. */
export async function checkShopping(ingredientId: string): Promise<void> {
  await setStock(ingredientId, 'have')
  await removeFromShopping(ingredientId)
}
