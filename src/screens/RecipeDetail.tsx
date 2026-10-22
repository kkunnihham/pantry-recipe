import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Icon from '../components/Icon'
import { ingredientById, recipeById } from '../data/catalog'
import { KIND_LABEL, TOOL_LABEL, type ReqGroup, type Role } from '../data/types'
import { CUISINE_LABEL, DIFFICULTY_LABEL, METHOD_LABEL, ROLE_LABEL } from '../data/labels'
import type { Recommendation } from '../engine/recommend'
import { useRecommendations } from '../engine/useRecommendations'
import { formatMinutes, formatNumber, formatTimer, scaleAmount } from '../lib/format'
import type { StockState } from '../lib/db'
import { addToShopping, useAppState } from '../state/store'

const ROLE_ORDER: Role[] = ['core', 'major', 'support', 'optional']

function ingredientName(id: string): string {
  return ingredientById.get(id)?.name ?? id
}

function GroupRow({ group, servings, inventory, rec }: { group: ReqGroup; servings: number; inventory: ReadonlyMap<string, StockState>; rec?: Recommendation }) {
  const joiner = group.matchRule === 'all_of' ? ' + ' : group.matchRule === 'one_of' && group.items.length > 1 ? ' 또는 ' : ', '
  const ruleHint =
    group.matchRule === 'at_least' && group.items.length > 1
      ? `${group.minCount ?? 1}가지 이상`
      : group.matchRule === 'optional' && group.role !== 'optional'
        ? '넣으면 좋아요'
        : null
  const usedSub = rec?.usedSubstitutions.find((s) => s.groupId === group.id)
  return (
    <li className="ing-row">
      <div className="ing-main">
        <span className="ing-names">
          {group.items.map((it, i) => {
            const st = inventory.get(it.ingredientId) ?? 'none'
            return (
              <span key={it.ingredientId}>
                {i > 0 && <span className="ing-joiner">{joiner}</span>}
                <span className={`ing-name is-${st}`}>
                  <span className="dot" aria-hidden="true" />
                  {ingredientName(it.ingredientId)}
                </span>{' '}
                <span className="ing-amount">{scaleAmount(it.amount, it.unit, servings)}</span>
              </span>
            )
          })}
        </span>
        {ruleHint && <span className="ing-hint">{ruleHint}</span>}
      </div>
      {group.items.some((it) => it.substitutions.length > 0) && (
        <ul className="ing-subs">
          {group.items.flatMap((it) =>
            it.substitutions.map((s, i) => {
              const active = usedSub && usedSub.forIngredientId === it.ingredientId && usedSub.viaIngredientIds.join() === s.ingredientIds.join()
              return (
                <li key={`${it.ingredientId}-${i}`} className={active ? 'is-active' : undefined}>
                  {active ? '지금은 ' : ''}
                  {ingredientName(it.ingredientId)} 대신 {s.ingredientIds.map(ingredientName).join(' + ')}
                  {s.note ? ` · ${s.note}` : ''}
                </li>
              )
            }),
          )}
        </ul>
      )}
    </li>
  )
}

function StatusBanner({ rec, recipeId }: { rec: Recommendation; recipeId: string }) {
  const s = useAppState()
  if (rec.bucket === 'ready_exact') return <div className="status status--ok">지금 바로 만들 수 있어요</div>
  if (rec.bucket === 'ready_substituted')
    return (
      <div className="status status--ok">
        대체해서 만들 수 있어요 · {rec.usedSubstitutions.map((x) => `${ingredientName(x.forIngredientId)} 대신 ${x.viaIngredientIds.map(ingredientName).join('+')}`).join(', ')}
      </div>
    )
  if (rec.bucket === 'near') {
    const buy = rec.missingCore.flatMap((m) => m.buy)
    return (
      <div className="status status--warn">
        <span>{buy.map(ingredientName).join(', ')}만 사면 돼요</span>
        <div className="chips">
          {buy.map((id) => (
            <button key={id} type="button" className={`stock-chip ${s.shopping.has(id) ? 'is-have' : 'is-none'}`} onClick={() => addToShopping(id, recipeId)}>
              {s.shopping.has(id) ? <Icon name="check" size={14} /> : <Icon name="cart" size={14} />} {ingredientName(id)}
            </button>
          ))}
        </div>
      </div>
    )
  }
  if (rec.hiddenReason === 'tool') return <div className="status status--muted">필요한 도구가 없어요</div>
  if (rec.hiddenReason === 'meh') return <div className="status status--muted">"별로"라고 표시한 요리예요</div>
  return <div className="status status--muted">꼭 필요한 재료가 {rec.missingCore.length}가지 없어요</div>
}

export default function RecipeDetail() {
  const { id } = useParams()
  const recipe = id ? recipeById.get(id) : undefined
  const s = useAppState()
  const recs = useRecommendations()
  const [servings, setServings] = useState(1)

  if (!recipe) {
    return (
      <main className="screen">
        <header className="screen-header">
          <Link className="icon-btn" to="/recipes" aria-label="뒤로">
            <Icon name="back" size={20} />
          </Link>
        </header>
        <div className="card empty">그런 레시피가 없어요.</div>
      </main>
    )
  }
  const rec = recs.byId.get(recipe.id)
  const groupsByRole = ROLE_ORDER.map((role) => ({ role, groups: recipe.groups.filter((g) => g.role === role) })).filter(
    (x) => x.groups.length > 0,
  )
  const cooked = s.cookCount.get(recipe.id) ?? 0
  const rating = s.ratings.get(recipe.id)

  return (
    <main className="screen detail">
      <header className="screen-header">
        <Link className="icon-btn" to="/recipes" aria-label="뒤로">
          <Icon name="back" size={20} />
        </Link>
        <span className="chip chip--muted" style={{ alignSelf: 'center' }}>
          {recipe.tier === 'basic' ? '기본' : '발견'}
        </span>
      </header>

      <div>
        <p className="eyebrow">
          {KIND_LABEL[recipe.kind]} · {CUISINE_LABEL[recipe.cuisine]}
          {cooked > 0 ? ` · ${cooked}번 해 먹음` : ' · 아직 안 해봄'}
          {rating === 'again' ? ' · 또 할래' : rating === 'meh' ? ' · 별로' : ''}
        </p>
        <h1 className="title">{recipe.title}</h1>
        {recipe.aliases.length > 0 && <p className="meta" style={{ marginTop: 4 }}>{recipe.aliases.join(' · ')}</p>}
      </div>

      <p className="summary">{recipe.summary}</p>

      {rec && <StatusBanner rec={rec} recipeId={recipe.id} />}

      <div className="chips">
        <span className="chip chip--muted">{formatMinutes(recipe.minutes)}</span>
        <span className="chip chip--muted">{DIFFICULTY_LABEL[recipe.difficulty]}</span>
        <span className="chip chip--muted">{METHOD_LABEL[recipe.method]}</span>
        {recipe.tools.map((t) => (
          <span key={t} className="chip">
            {TOOL_LABEL[t]}
          </span>
        ))}
      </div>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">재료</h2>
          <div className="stepper" role="group" aria-label="인분">
            <button aria-label="인분 줄이기" onClick={() => setServings((v) => Math.max(1, v - 1))} disabled={servings <= 1}>
              −
            </button>
            <span>{servings}인분</span>
            <button aria-label="인분 늘리기" onClick={() => setServings((v) => Math.min(3, v + 1))} disabled={servings >= 3}>
              +
            </button>
          </div>
        </div>
        <div className="card" style={{ padding: '6px 16px' }}>
          {groupsByRole.map(({ role, groups }) => (
            <div key={role} className="role-block">
              <p className="role-label">{ROLE_LABEL[role]}</p>
              <ul className="ing-list">
                {groups.map((g) => (
                  <GroupRow key={g.id} group={g} servings={servings} inventory={s.inventory} rec={rec} />
                ))}
              </ul>
            </div>
          ))}
          {recipe.water && recipe.water.length > 0 && (
            <div className="role-block">
              <p className="role-label">물</p>
              <ul className="ing-list">
                {recipe.water.map((w) => (
                  <li key={w.name} className="ing-row">
                    <div className="ing-main">
                      <span className="ing-names">
                        <span className="ing-name">{w.name}</span> <span className="ing-amount">{formatNumber(w.amountMl * servings)}ml</span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <p className="meta legend">
          <span className="ing-name is-have"><span className="dot" />있음</span>
          <span className="ing-name is-low"><span className="dot" />부족</span>
          <span className="ing-name is-none"><span className="dot" />없음</span>
        </p>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">만드는 법</h2>
          <span className="meta">{recipe.steps.length}단계</span>
        </div>
        <ol className="steps">
          {recipe.steps.map((st, i) => (
            <li key={i} className="step">
              <span className="step-num">{i + 1}</span>
              <div className="step-body">
                <p>{st.text}</p>
                {st.timerSeconds ? (
                  <span className="step-timer">
                    <Icon name="clock" size={14} /> {formatTimer(st.timerSeconds)}
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="sticky-cta">
        <Link to={`/cook/${recipe.id}?servings=${servings}`} className="btn btn--primary" style={{ width: '100%' }}>
          조리 시작
        </Link>
      </div>
    </main>
  )
}
