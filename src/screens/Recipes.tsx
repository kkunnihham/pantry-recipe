import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ingredientById, recipes } from '../data/catalog'
import { KIND_LABEL, type Cuisine, type Meal, type Method } from '../data/types'
import { CUISINE_LABEL, DIFFICULTY_LABEL, MEAL_LABEL, METHOD_LABEL, TIER_LABEL } from '../data/labels'
import { useRecommendations } from '../engine/useRecommendations'
import { formatMinutes } from '../lib/format'
import Icon from '../components/Icon'

const CUISINE_OPTIONS = (Object.keys(CUISINE_LABEL) as Cuisine[])
  .filter((value) => recipes.some((r) => r.cuisine === value))
  .map((value) => ({ value, label: CUISINE_LABEL[value] }))
const MEAL_OPTIONS = (Object.keys(MEAL_LABEL) as Meal[])
  .filter((value) => recipes.some((r) => r.meal.includes(value)))
  .map((value) => ({ value, label: MEAL_LABEL[value] }))
const METHOD_OPTIONS = (Object.keys(METHOD_LABEL) as Method[])
  .filter((value) => recipes.some((r) => r.method === value))
  .map((value) => ({ value, label: METHOD_LABEL[value] }))
const TIME_OPTIONS = [
  { value: 'up_to_15', label: '15분 이하', matches: (minutes: number) => minutes <= 15 },
  { value: 'up_to_30', label: '30분 이하', matches: (minutes: number) => minutes <= 30 },
  { value: 'over_30', label: '30분 넘게', matches: (minutes: number) => minutes > 30 },
] as const
type TimeFilter = (typeof TIME_OPTIONS)[number]['value']
const AVAILABLE_TIMES = TIME_OPTIONS.filter((option) => recipes.some((r) => option.matches(r.minutes)))

function norm(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/\s+/g, '')
}

function toggle<T>(selected: T[], value: T): T[] {
  return selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]
}

function FilterRow<T extends string>({ label, options, selected, onToggle, onReset }: {
  label: string
  options: readonly { value: T; label: string }[]
  selected: T[]
  onToggle: (value: T) => void
  onReset?: () => void
}) {
  return (
    <div className="filter-row" role="group" aria-label={label}>
      {onReset && <button type="button" className="stock-chip is-none" onClick={onReset}>초기화</button>}
      <span className="meta">{label}</span>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`stock-chip ${selected.includes(option.value) ? 'is-have' : 'is-none'}`}
          aria-pressed={selected.includes(option.value)}
          onClick={() => onToggle(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export default function Recipes() {
  const rec = useRecommendations()
  const [query, setQuery] = useState('')
  const [cuisines, setCuisines] = useState<Cuisine[]>([])
  const [meals, setMeals] = useState<Meal[]>([])
  const [methods, setMethods] = useState<Method[]>([])
  const [times, setTimes] = useState<TimeFilter[]>([])
  const hasFilters = cuisines.length + meals.length + methods.length + times.length > 0
  const tiers: Array<'basic' | 'discovery'> = ['basic', 'discovery']

  const results = useMemo(() => {
    const q = norm(query)
    return recipes.flatMap((recipe) => {
      if (cuisines.length && !cuisines.includes(recipe.cuisine)) return []
      if (meals.length && !recipe.meal.some((meal) => meals.includes(meal))) return []
      if (methods.length && !methods.includes(recipe.method)) return []
      if (times.length && !TIME_OPTIONS.some((option) => times.includes(option.value) && option.matches(recipe.minutes))) return []

      if (!q || [recipe.title, ...recipe.aliases].some((name) => norm(name).includes(q))) {
        return [{ recipe, ingredientNames: [] as string[] }]
      }
      const ingredientIds = new Set(recipe.groups.flatMap((group) => group.items.map((item) => item.ingredientId)))
      const ingredientNames = [...ingredientIds].flatMap((id) => {
        const ingredient = ingredientById.get(id)
        return ingredient && [ingredient.name, ...ingredient.aliases].some((name) => norm(name).includes(q)) ? [ingredient.name] : []
      })
      return ingredientNames.length > 0 ? [{ recipe, ingredientNames }] : []
    })
  }, [query, cuisines, meals, methods, times])

  function resetFilters() {
    setCuisines([])
    setMeals([])
    setMethods([])
    setTimes([])
  }

  return (
    <main className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">레시피 {recipes.length}개</p>
          <h1 className="title">레시피</h1>
        </div>
      </header>

      <label className="search recipe-search">
        <Icon name="search" size={18} />
        <input
          type="search"
          aria-label="요리 이름이나 재료로 찾기"
          placeholder="요리 이름이나 재료로 찾기"
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

      <div className="recipe-filters">
        <FilterRow label="권역" options={CUISINE_OPTIONS} selected={cuisines} onToggle={(value) => setCuisines((prev) => toggle(prev, value))} onReset={hasFilters ? resetFilters : undefined} />
        <FilterRow label="끼니" options={MEAL_OPTIONS} selected={meals} onToggle={(value) => setMeals((prev) => toggle(prev, value))} />
        <FilterRow label="조리법" options={METHOD_OPTIONS} selected={methods} onToggle={(value) => setMethods((prev) => toggle(prev, value))} />
        <FilterRow label="시간" options={AVAILABLE_TIMES} selected={times} onToggle={(value) => setTimes((prev) => toggle(prev, value))} />
      </div>

      {results.length === 0 && <div className="card empty">조건에 맞는 레시피가 없어요.</div>}
      {tiers.map((tier) => {
        const list = results.filter(({ recipe }) => recipe.tier === tier)
        return (
          <section className="section" key={tier}>
            <div className="section-head">
              <h2 className="section-title">{TIER_LABEL[tier]}</h2>
              <span className="meta">{list.length}개</span>
            </div>
            <div className="row-list">
              {list.map(({ recipe: r, ingredientNames }) => {
                const recommendation = rec.byId.get(r.id)
                return (
                  <Link key={r.id} to={`/recipe/${r.id}`} className="row recipe-row">
                    <div className="card-body">
                      <span className="card-title">{r.title}</span>
                      <span className="meta">
                        {KIND_LABEL[r.kind]} · {CUISINE_LABEL[r.cuisine]} · {formatMinutes(r.minutes)} · {DIFFICULTY_LABEL[r.difficulty]}
                      </span>
                      {ingredientNames.length > 0 && <span className="meta">재료: {ingredientNames.join(', ')}</span>}
                    </div>
                    {recommendation?.bucket === 'ready_exact' && <span className="chip recipe-status">바로 가능</span>}
                    {recommendation?.bucket === 'ready_substituted' && <span className="chip recipe-status">대체 가능</span>}
                    {recommendation?.bucket === 'near' && <span className="chip chip--muted recipe-status">{recommendation.purchaseCount}개만 사면</span>}
                    <Icon name="chevron" size={18} className="recipe-chevron" />
                  </Link>
                )
              })}
            </div>
          </section>
        )
      })}
    </main>
  )
}
