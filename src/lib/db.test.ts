import { beforeEach, describe, expect, it, vi } from 'vitest'

const { database } = vi.hoisted(() => ({ database: { transaction: vi.fn() } }))
vi.mock('idb', () => ({ openDB: vi.fn(async () => database) }))

import { importAll } from './db'

type Row = Record<string, unknown>

function makeStore(name: string, events: string[]) {
  const rows = new Map<unknown, unknown>()
  let nextId = 100
  return {
    rows,
    clear: vi.fn(async () => { events.push(`clear:${name}`); rows.clear() }),
    put: vi.fn(async (row: Row, key?: string) => {
      events.push(`put:${name}`)
      rows.set(key ?? row.ingredientId ?? row.recipeId, row)
    }),
    add: vi.fn(async (row: Row) => {
      events.push(`add:${name}`)
      const id = nextId++
      rows.set(id, { ...row, id })
      return id
    }),
    count: vi.fn(async () => rows.size),
  }
}

function makeTransaction() {
  const events: string[] = []
  const stores = {
    inventory: makeStore('inventory', events),
    cookLog: makeStore('cookLog', events),
    ratings: makeStore('ratings', events),
    shopping: makeStore('shopping', events),
    kv: makeStore('kv', events),
  }
  const tx = {
    objectStore: vi.fn((name: keyof typeof stores) => stores[name]),
    abort: vi.fn(),
    done: Promise.resolve(),
  }
  return { tx, stores, events }
}

const backup = () => ({
  format: 'pantry-recipe-backup', version: 1, exportedAt: '2026-10-23T00:00:00Z',
  inventory: [{ ingredientId: 'egg', state: 'have', updatedAt: 1 }],
  cookLog: [{ id: 5, recipeId: 'omelette', cookedAt: 2, servings: 2 }],
  ratings: [{ recipeId: 'omelette', rating: 'again', ratedAt: 3 }],
  shopping: [{ ingredientId: 'milk', addedAt: 4, fromRecipeIds: ['omelette'], checked: false }],
  kv: { ownedTools: ['microwave'], staplesDone: true },
})

describe('백업 가져오기', () => {
  let context: ReturnType<typeof makeTransaction>
  beforeEach(() => {
    database.transaction.mockReset()
    context = makeTransaction()
    database.transaction.mockReturnValue(context.tx)
  })

  it('잘못된 형식과 버전은 DB를 열거나 비우기 전에 거부한다', async () => {
    for (const data of [null, [], {}, { ...backup(), format: 'other' }, { ...backup(), version: 2 }]) {
      await expect(importAll(data)).rejects.toThrow('백업 파일 형식이 아니에요')
    }
    expect(database.transaction).not.toHaveBeenCalled()
  })

  it('단일 트랜잭션에서 다섯 스토어를 전부 비운 뒤 백업을 넣는다', async () => {
    for (const store of Object.values(context.stores)) store.rows.set('old', { old: true })
    await expect(importAll(backup())).resolves.toEqual({ inventory: 1, cookLog: 1, ratings: 1, shopping: 1 })
    expect(database.transaction).toHaveBeenCalledExactlyOnceWith(['inventory', 'cookLog', 'ratings', 'shopping', 'kv'], 'readwrite')
    expect(context.events.slice(0, 5)).toEqual(['clear:inventory', 'clear:cookLog', 'clear:ratings', 'clear:shopping', 'clear:kv'])
    for (const store of Object.values(context.stores)) expect(store.rows.has('old')).toBe(false)
    expect(context.stores.kv.put.mock.calls).toEqual([[['microwave'], 'ownedTools'], [true, 'staplesDone']])
  })

  it('잘못된 필수 필드와 타입은 건너뛰고 유효한 항목은 보존한다', async () => {
    const data = backup()
    await expect(importAll({ ...data,
      inventory: [...data.inventory, null, {}, { ingredientId: 2, state: 'have' }, { ingredientId: 'bad', state: ['have'] }],
      cookLog: [...data.cookLog, {}, { recipeId: 'bad', cookedAt: '2', servings: 2 }, { recipeId: 'bad', cookedAt: 2, servings: NaN }],
      ratings: [...data.ratings, null, { recipeId: 'bad', rating: 'good' }, { recipeId: 2, rating: 'again' }],
      shopping: [...data.shopping, {}, { ingredientId: 'bad', addedAt: 1, fromRecipeIds: [2], checked: false }, { ingredientId: 'bad', addedAt: 1, fromRecipeIds: [], checked: 'false' }],
    })).resolves.toEqual({ inventory: 1, cookLog: 1, ratings: 1, shopping: 1 })
    expect([...context.stores.inventory.rows.values()]).toEqual(data.inventory)
    expect([...context.stores.ratings.rows.values()]).toEqual(data.ratings)
    expect([...context.stores.shopping.rows.values()]).toEqual(data.shopping)
  })

  it('백업 기록의 id와 사진을 제거하고 add로 새 키를 발급받는다', async () => {
    await importAll({ ...backup(), cookLog: [
      { id: 5, recipeId: 'one', cookedAt: 1, servings: 1, photo: 'excluded' },
      { id: 5, recipeId: 'two', cookedAt: 2, servings: 3 },
    ] })
    expect(context.stores.cookLog.add.mock.calls).toEqual([
      [{ recipeId: 'one', cookedAt: 1, servings: 1 }], [{ recipeId: 'two', cookedAt: 2, servings: 3 }],
    ])
    expect(context.stores.cookLog.put).not.toHaveBeenCalled()
  })

  it('같은 키가 여러 번 나오면 실제 저장된 개수를 반환한다', async () => {
    const data = backup()
    await expect(importAll({ ...data, inventory: [...data.inventory, { ingredientId: 'egg', state: 'low', updatedAt: 2 }] }))
      .resolves.toEqual({ inventory: 1, cookLog: 1, ratings: 1, shopping: 1 })
    expect(context.stores.inventory.rows.get('egg')).toEqual({ ingredientId: 'egg', state: 'low', updatedAt: 2 })
  })

  it('선택 시각이 없어도 필수 필드만 있는 재고와 평가를 가져온다', async () => {
    const start = Date.now()
    await importAll({ ...backup(), inventory: [{ ingredientId: 'salt', state: 'none' }], ratings: [{ recipeId: 'soup', rating: 'meh' }] })
    expect(context.stores.inventory.rows.get('salt')).toEqual({ ingredientId: 'salt', state: 'none', updatedAt: expect.any(Number) })
    expect((context.stores.inventory.rows.get('salt') as Row).updatedAt).toBeGreaterThanOrEqual(start)
    expect(context.stores.ratings.rows.get('soup')).toEqual({ recipeId: 'soup', rating: 'meh', ratedAt: expect.any(Number) })
  })

  it('빈 백업은 기존 데이터를 모두 비우고 0을 반환한다', async () => {
    for (const store of Object.values(context.stores)) store.rows.set('old', true)
    await expect(importAll({ ...backup(), inventory: [], cookLog: [], ratings: [], shopping: [], kv: {} }))
      .resolves.toEqual({ inventory: 0, cookLog: 0, ratings: 0, shopping: 0 })
    for (const store of Object.values(context.stores)) expect(store.rows.size).toBe(0)
  })

  it('쓰기 오류는 숨기지 않고 트랜잭션을 중단한다', async () => {
    const error = new Error('write failed')
    context.stores.shopping.put.mockRejectedValueOnce(error)
    await expect(importAll(backup())).rejects.toBe(error)
    expect(context.tx.abort).toHaveBeenCalledOnce()
    expect(context.stores.kv.put).not.toHaveBeenCalled()
  })
})
