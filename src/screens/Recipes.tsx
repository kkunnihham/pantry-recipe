import { useCallback, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ingredientById, recipes } from '../data/catalog'
import { KIND_LABEL, type Cuisine, type Meal, type Method, type Recipe, type RecipeKind } from '../data/types'
import { CUISINE_LABEL, DIFFICULTY_LABEL, MEAL_LABEL, METHOD_LABEL, TIER_LABEL } from '../data/labels'
import { MAIN_BUCKET_LABEL, MAIN_BUCKET_ORDER, mainBucketsCached, type MainBucket } from '../data/mainIngredient'
import type { Bucket, Recommendation } from '../engine/recommend'
import { useRecommendations } from '../engine/useRecommendations'
import { formatMinutes } from '../lib/format'
import Icon from '../components/Icon'

/** 상태 필터. 비어 있으면 전체. 주소에 없으면 기본값(바로 가능 + 대체 가능). */
type Status = 'exact' | 'sub' | 'near'
const STATUS_OPTIONS: { value: Status; label: string; buckets: Bucket[] }[] = [
  { value: 'exact', label: '바로 가능', buckets: ['ready_exact'] },
  { value: 'sub', label: '대체 가능', buckets: ['ready_substituted'] },
  { value: 'near', label: '1~2개만 사면', buckets: ['near'] },
]
const DEFAULT_STATUS: Status[] = ['exact', 'sub']
const BUCKET_RANK: Record<Bucket, number> = { ready_exact: 0, ready_substituted: 1, near: 2, hidden: 3 }

const KIND_OPTIONS = (Object.keys(KIND_LABEL) as RecipeKind[])
  .filter((value) => recipes.some((r) => r.kind === value))
  .map((value) => ({ value, label: KIND_LABEL[value] }))
const MAIN_OPTIONS = MAIN_BUCKET_ORDER.map((value) => ({ value, label: MAIN_BUCKET_LABEL[value] }))
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

/** 주소 쿼리의 쉼표 목록을 허용값으로 걸러 읽는다. */
function readList<T extends string>(params: URLSearchParams, key: string, allowed: readonly T[]): T[] {
  const raw = params.get(key)
  if (!raw) return []
  return raw.split(',').filter((v): v is T => (allowed as readonly string[]).includes(v))
}

function FilterRow<T extends string>({ label, options, selected, onToggle, lead }: {
  label: string
  options: readonly { value: T; label: string }[]
  selected: T[]
  onToggle: (value: T) => void
  /** 줄 맨 앞에 두는 버튼 (전체·초기화) */
  lead?: { label: string; active: boolean; onClick: () => void }
}) {
  return (
    <div className="filter-row" role="group" aria-label={label}>
      <span className="meta filter-label">{label}</span>
      {lead && (
        <button type="button" className={`stock-chip ${lead.active ? 'is-have' : 'is-none'}`} aria-pressed={lead.active} onClick={lead.onClick}>
          {lead.label}
        </button>
      )}
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
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')

  // 주소에서 읽는 필터. status 는 'all' 이면 전체, 없으면 기본값.
  const statusRaw = params.get('status')
  const statuses: Status[] = statusRaw === null ? DEFAULT_STATUS : statusRaw === 'all' ? [] : readList(params, 'status', ['exact', 'sub', 'near'] as const)
  const kinds = readList(params, 'kind', KIND_OPTIONS.map((o) => o.value))
  const mains = readList(params, 'main', MAIN_BUCKET_ORDER)
  const cuisines = readList(params, 'cuisine', CUISINE_OPTIONS.map((o) => o.value))
  const meals = readList(params, 'meal', MEAL_OPTIONS.map((o) => o.value))
  const methods = readList(params, 'method', METHOD_OPTIONS.map((o) => o.value))
  const times = readList(params, 'time', AVAILABLE_TIMES.map((o) => o.value))

  const moreCount = mains.length + cuisines.length + meals.length + methods.length + times.length
  const [moreOpen, setMoreOpen] = useState(moreCount > 0)
  const statusIsDefault = statuses.length === DEFAULT_STATUS.length && DEFAULT_STATUS.every((s) => statuses.includes(s))
  const activeCount = moreCount + kinds.length + (statusIsDefault ? 0 : 1)

  // 함수형 갱신: 연달아 눌러도 직전 값 위에 쌓인다.
  const update = useCallback(
    (key: string, values: string[] | null) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (values === null || values.length === 0) next.delete(key)
          else next.set(key, values.join(','))
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )
  const setStatuses = (next: Status[]) => update('status', next.length === 0 ? ['all'] : next)
  const resetAll = () => setParams(new URLSearchParams(), { replace: true })

  const results = useMemo(() => {
    const q = norm(query)
    const allowedBuckets = new Set<Bucket>(STATUS_OPTIONS.filter((o) => statuses.includes(o.value)).flatMap((o) => o.buckets))
    const rows: { recipe: Recipe; recommendation: Recommendation | undefined; ingredientNames: string[] }[] = []
    for (const recipe of recipes) {
      const recommendation = rec.byId.get(recipe.id)
      if (statuses.length > 0 && !(recommendation && allowedBuckets.has(recommendation.bucket))) continue
      if (kinds.length && !kinds.includes(recipe.kind)) continue
      if (mains.length && !mainBucketsCached(recipe).some((b) => mains.includes(b))) continue
      if (cuisines.length && !cuisines.includes(recipe.cuisine)) continue
      if (meals.length && !recipe.meal.some((meal) => meals.includes(meal))) continue
      if (methods.length && !methods.includes(recipe.method)) continue
      if (times.length && !TIME_OPTIONS.some((option) => times.includes(option.value) && option.matches(recipe.minutes))) continue

      if (!q || [recipe.title, ...recipe.aliases].some((name) => norm(name).includes(q))) {
        rows.push({ recipe, recommendation, ingredientNames: [] })
        continue
      }
      const ingredientIds = new Set(recipe.groups.flatMap((group) => group.items.map((item) => item.ingredientId)))
      const ingredientNames = [...ingredientIds].flatMap((id) => {
        const ingredient = ingredientById.get(id)
        return ingredient && [ingredient.name, ...ingredient.aliases].some((name) => norm(name).includes(q)) ? [ingredient.name] : []
      })
      if (ingredientNames.length > 0) rows.push({ recipe, recommendation, ingredientNames })
    }
    // 만들 수 있는 것부터, 같은 구역 안에서는 점수순
    rows.sort((a, b) => {
      const ra = a.recommendation?.bucket ?? 'hidden'
      const rb = b.recommendation?.bucket ?? 'hidden'
      return BUCKET_RANK[ra] - BUCKET_RANK[rb] || (b.recommendation?.sortScore ?? 0) - (a.recommendation?.sortScore ?? 0) || a.recipe.title.localeCompare(b.recipe.title)
    })
    return rows
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, params, rec.byId])

  const tiers: Array<'basic' | 'discovery'> = ['basic', 'discovery']

  return (
    <main className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">
            {results.length}개{activeCount > 0 || !statusIsDefault || query ? ` · 전체 ${recipes.length}개 중` : ''}
          </p>
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
        <FilterRow
          label="상태"
          options={STATUS_OPTIONS}
          selected={statuses}
          onToggle={(value) => setStatuses(toggle(statuses, value))}
          lead={{ label: '전체', active: statuses.length === 0, onClick: () => setStatuses([]) }}
        />
        <FilterRow label="종류" options={KIND_OPTIONS} selected={kinds} onToggle={(value) => update('kind', toggle(kinds, value))} />
        {moreOpen && (
          <>
            <FilterRow label="주 재료" options={MAIN_OPTIONS} selected={mains} onToggle={(value: MainBucket) => update('main', toggle(mains, value))} />
            <FilterRow label="권역" options={CUISINE_OPTIONS} selected={cuisines} onToggle={(value) => update('cuisine', toggle(cuisines, value))} />
            <FilterRow label="끼니" options={MEAL_OPTIONS} selected={meals} onToggle={(value) => update('meal', toggle(meals, value))} />
            <FilterRow label="조리법" options={METHOD_OPTIONS} selected={methods} onToggle={(value) => update('method', toggle(methods, value))} />
            <FilterRow label="시간" options={AVAILABLE_TIMES} selected={times} onToggle={(value: TimeFilter) => update('time', toggle(times, value))} />
          </>
        )}
        <div className="filter-actions">
          <button type="button" className="link" aria-expanded={moreOpen} onClick={() => setMoreOpen((v) => !v)}>
            {moreOpen ? '필터 접기' : '필터 더 보기'}
            {!moreOpen && moreCount > 0 && <span className="count-badge">{moreCount}</span>}
          </button>
          {(activeCount > 0 || !statusIsDefault) && (
            <button type="button" className="link" onClick={resetAll}>
              초기화
            </button>
          )}
        </div>
      </div>

      {results.length === 0 && (
        <div className="card empty">
          조건에 맞는 레시피가 없어요.
          <br />
          {statuses.length > 0 ? '상태를 "전체"로 바꾸거나 필터를 줄여 보세요.' : '검색어나 필터를 줄여 보세요.'}
        </div>
      )}
      {tiers.map((tier) => {
        const list = results.filter(({ recipe }) => recipe.tier === tier)
        if (list.length === 0) return null
        return (
          <section className="section" key={tier}>
            <div className="section-head">
              <h2 className="section-title">{TIER_LABEL[tier]}</h2>
              <span className="meta">{list.length}개</span>
            </div>
            <div className="row-list">
              {list.map(({ recipe: r, recommendation, ingredientNames }) => (
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
              ))}
            </div>
          </section>
        )
      })}
    </main>
  )
}
