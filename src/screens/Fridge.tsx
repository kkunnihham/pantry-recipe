import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import { ingredients } from '../data/catalog'
import { CATEGORY_LABEL, TOOL_LABEL, type Ingredient, type IngredientCategory, type Tool } from '../data/types'
import type { StockState } from '../lib/db'
import { setOwnedTools, setStaplesDone, setStock, setStocks, useAppState } from '../state/store'

const CATEGORY_ORDER: IngredientCategory[] = ['veg', 'meat_egg', 'dairy', 'processed', 'grain', 'seafood', 'seasoning', 'fruit_etc']
const TOOL_CHOICES: Tool[] = ['air_fryer', 'microwave', 'rice_cooker', 'pressure_cooker', 'blender']
const NEXT: Record<StockState, StockState> = { none: 'have', have: 'low', low: 'none' }

function norm(s: string): string {
  return s.normalize('NFKC').toLowerCase().replace(/\s+/g, '')
}

function matches(ing: Ingredient, q: string): boolean {
  if (!q) return true
  const n = norm(q)
  return norm(ing.name).includes(n) || ing.aliases.some((a) => norm(a).includes(n))
}

function StockChip({ ing, state }: { ing: Ingredient; state: StockState }) {
  const label = state === 'low' ? `${ing.name} · 부족` : ing.name
  return (
    <button
      type="button"
      className={`stock-chip is-${state}`}
      aria-pressed={state !== 'none'}
      aria-label={`${ing.name}: ${state === 'have' ? '있음' : state === 'low' ? '부족' : '없음'}. 눌러서 바꾸기`}
      onClick={() => setStock(ing.id, NEXT[state])}
    >
      {label}
    </button>
  )
}

export default function Fridge() {
  const s = useAppState()
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const byCategory = useMemo(() => {
    const m = new Map<IngredientCategory, Ingredient[]>()
    for (const c of CATEGORY_ORDER) m.set(c, [])
    for (const i of ingredients) m.get(i.category)!.push(i)
    return m
  }, [])

  const staples = useMemo(() => ingredients.filter((i) => i.staple), [])
  const haveCount = [...s.inventory.values()].filter((v) => v === 'have').length
  const lowCount = [...s.inventory.values()].filter((v) => v === 'low').length
  const searching = query.trim().length > 0

  function toggleTool(t: Tool) {
    const next = new Set(s.ownedTools)
    if (next.has(t)) next.delete(t)
    else next.add(t)
    void setOwnedTools([...next])
  }

  async function markAllStaples() {
    await setStocks(staples.map((i) => [i.id, 'have'] as [string, StockState]))
    await setStaplesDone(true)
  }

  return (
    <main className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">
            있음 {haveCount} · 부족 {lowCount}
          </p>
          <h1 className="title">냉장고</h1>
        </div>
        <Link className="icon-btn" to="/shopping" aria-label="장보기 목록">
          <Icon name="cart" size={20} />
          {s.shopping.size > 0 && <span className="badge">{s.shopping.size}</span>}
        </Link>
      </header>

      <label className="search">
        <Icon name="search" size={18} />
        <input
          type="search"
          placeholder="재료 이름으로 찾기"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
        {query && (
          <button type="button" aria-label="지우기" onClick={() => setQuery('')}>
            <Icon name="close" size={16} />
          </button>
        )}
      </label>

      {!s.staplesDone && !searching && (
        <section className="accent-card">
          <p className="accent-label">
            <Icon name="spark" size={16} />
            처음 한 번만
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.5 }}>
            소금, 설탕, 간장, 식용유 같은 기본 양념 {staples.length}가지를 한 번에 "있음"으로 넣을까요? 떨어지면 그때 바꾸면 돼요.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn--primary" onClick={markAllStaples}>
              다 있어요
            </button>
            <button className="btn btn--ghost" onClick={() => setStaplesDone(true)}>
              직접 고를게요
            </button>
          </div>
        </section>
      )}

      {!searching && (
        <section className="section">
          <div className="section-head">
            <h2 className="section-title">도구</h2>
            <span className="meta">없는 도구가 필요한 요리는 추천에서 빠져요</span>
          </div>
          <div className="chips">
            {TOOL_CHOICES.map((t) => (
              <button
                key={t}
                type="button"
                className={`stock-chip ${s.ownedTools.has(t) ? 'is-have' : 'is-none'}`}
                aria-pressed={s.ownedTools.has(t)}
                onClick={() => toggleTool(t)}
              >
                {TOOL_LABEL[t]}
              </button>
            ))}
          </div>
        </section>
      )}

      {CATEGORY_ORDER.map((cat) => {
        const all = byCategory.get(cat)!.filter((i) => matches(i, query))
        if (all.length === 0) return null
        const owned = all.filter((i) => s.inventory.has(i.id))
        const rest = all.filter((i) => !s.inventory.has(i.id))
        const open = searching || expanded[cat] || owned.length === 0
        return (
          <section className="section" key={cat}>
            <div className="section-head">
              <h2 className="section-title">{CATEGORY_LABEL[cat]}</h2>
              <span className="meta">
                {owned.length}/{all.length}
              </span>
            </div>
            <div className="chips">
              {owned.map((i) => (
                <StockChip key={i.id} ing={i} state={s.inventory.get(i.id)!} />
              ))}
              {open && rest.map((i) => <StockChip key={i.id} ing={i} state="none" />)}
              {!open && rest.length > 0 && (
                <button type="button" className="stock-chip is-more" onClick={() => setExpanded((e) => ({ ...e, [cat]: true }))}>
                  <Icon name="plus" size={14} /> {rest.length}개 더
                </button>
              )}
              {open && !searching && owned.length > 0 && rest.length > 0 && (
                <button type="button" className="stock-chip is-more" onClick={() => setExpanded((e) => ({ ...e, [cat]: false }))}>
                  접기
                </button>
              )}
            </div>
          </section>
        )
      })}

      <p className="meta" style={{ textAlign: 'center' }}>
        재료를 누를 때마다 있음 → 부족 → 없음 순서로 바뀌어요.
      </p>
    </main>
  )
}
