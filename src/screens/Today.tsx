import { useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import { ingredientById, recipeById } from '../data/catalog'
import { KIND_LABEL } from '../data/types'
import type { Recommendation } from '../engine/recommend'
import { useRecommendations } from '../engine/useRecommendations'
import { formatMinutes } from '../lib/format'
import { getTheme, toggleTheme } from '../lib/theme'
import { addDiscoverySkip, addToShopping, useAppState } from '../state/store'

function todayLabel() {
  const d = new Date()
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${days[d.getDay()]}요일`
}

const name = (id: string) => ingredientById.get(id)?.name ?? id

function ReadyRow({ rec }: { rec: Recommendation }) {
  const r = recipeById.get(rec.recipeId)!
  const hints: string[] = []
  if (rec.bucket === 'ready_substituted') {
    hints.push(...rec.usedSubstitutions.map((s) => `${name(s.forIngredientId)} 대신 ${s.viaIngredientIds.map(name).join('+')}`))
  }
  if (rec.lowIngredientIds.length) hints.push(`${rec.lowIngredientIds.map(name).join(', ')} 부족`)
  if (rec.missingOptionalNames.length) hints.push(`없음: ${rec.missingOptionalNames.slice(0, 3).join(', ')}`)
  return (
    <Link to={`/recipe/${r.id}`} className="card card-row">
      <div className="card-body">
        <span className="card-title">
          {r.title}
          {rec.cookedRecently && <span className="tag">최근에 먹음</span>}
        </span>
        <span className="meta">
          {KIND_LABEL[r.kind]} · {formatMinutes(r.minutes)}
          {rec.bucket === 'ready_substituted' ? ' · 대체해서 가능' : ''}
        </span>
        {hints.length > 0 && <span className="meta hint">{hints.join(' · ')}</span>}
      </div>
      <Icon name="chevron" size={20} style={{ color: 'var(--text-muted)' }} />
    </Link>
  )
}

function NearRow({ rec }: { rec: Recommendation }) {
  const s = useAppState()
  const r = recipeById.get(rec.recipeId)!
  const buy = rec.missingCore.flatMap((m) => m.buy)
  return (
    <div className="card card-row">
      <div className="card-body">
        <Link to={`/recipe/${r.id}`} className="card-title">
          {r.title}
        </Link>
        <div className="chips">
          {buy.map((id) => {
            const inList = s.shopping.has(id)
            return (
              <button
                key={id}
                type="button"
                className={`stock-chip ${inList ? 'is-have' : 'is-none'}`}
                onClick={() => addToShopping(id, r.id)}
                aria-label={`${name(id)} 장보기에 담기`}
              >
                {inList ? <Icon name="check" size={14} /> : <Icon name="cart" size={14} />} {name(id)}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function Today() {
  const s = useAppState()
  const rec = useRecommendations()
  const [theme, setThemeState] = useState(getTheme())
  const [showAll, setShowAll] = useState(false)
  const inventoryCount = s.inventory.size
  const readyShown = showAll ? rec.ready : rec.ready.slice(0, 5)
  const discoveryRecipe = rec.discovery ? recipeById.get(rec.discovery.recipeId) : null

  return (
    <main className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{todayLabel()}</p>
          <h1 className="title">오늘 뭐 해 먹지</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="icon-btn"
            aria-label={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
            onClick={() => setThemeState(toggleTheme())}
          >
            <Icon name="theme" size={20} />
          </button>
          <Link className="icon-btn" to="/settings" aria-label="설정">
            <Icon name="settings" size={20} />
          </Link>
        </div>
      </header>

      <Link to="/fridge" className="card card-row" style={{ padding: '12px 14px' }}>
        <Icon name="fridge" size={18} style={{ color: 'var(--primary)' }} />
        <span style={{ flex: 1, fontSize: 14 }}>냉장고 재료 {inventoryCount}개</span>
        <span className="meta">
          {inventoryCount === 0 ? '재료를 먼저 등록해요' : `바로 가능 ${rec.ready.length} · 1~2개만 사면 ${rec.near.length}`}
        </span>
      </Link>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">지금 바로 가능</h2>
          {rec.ready.length > 5 && (
            <button type="button" className="link" onClick={() => setShowAll((v) => !v)}>
              {showAll ? '접기' : `${rec.ready.length}개 모두`}
            </button>
          )}
        </div>
        {rec.ready.length === 0 ? (
          <div className="card empty">
            {inventoryCount === 0 ? (
              <>
                냉장고에 재료를 넣으면
                <br />
                지금 만들 수 있는 요리가 여기 나와요.
              </>
            ) : (
              <>
                지금 재료로 바로 만들 수 있는 요리가 없어요.
                <br />
                아래 "1~2개만 사면"을 봐요.
              </>
            )}
          </div>
        ) : (
          readyShown.map((x) => <ReadyRow key={x.recipeId} rec={x} />)
        )}
      </section>

      <section className="accent-card">
        <p className="accent-label">
          <Icon name="spark" size={16} />
          오늘의 발견
        </p>
        {discoveryRecipe && rec.discovery ? (
          <>
            <p style={{ fontSize: 20, fontWeight: 700 }}>{discoveryRecipe.title}</p>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--accent-label)' }}>{discoveryRecipe.summary}</p>
            {rec.discovery.bucket === 'ready_substituted' && (
              <p className="meta" style={{ color: 'var(--accent-label)' }}>
                {rec.discovery.usedSubstitutions.map((x) => `${name(x.forIngredientId)} 대신 ${x.viaIngredientIds.map(name).join('+')}`).join(' · ')}
              </p>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <Link to={`/recipe/${discoveryRecipe.id}`} className="btn btn--primary">
                보러 가기
              </Link>
              <button className="btn btn--ghost" style={{ color: 'var(--accent-label)' }} onClick={() => addDiscoverySkip(rec.today, discoveryRecipe.id)}>
                다른 것 보기
              </button>
            </div>
          </>
        ) : (
          <p style={{ fontSize: 14, lineHeight: 1.5 }}>
            {inventoryCount === 0 ? '재료가 있는데 아직 안 해본 요리를 하루에 하나씩 보여줘요.' : '지금 재료로 만들 수 있는 안 해본 요리가 없어요. 재료가 늘면 다시 보여줘요.'}
          </p>
        )}
      </section>

      {rec.near.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2 className="section-title">1~2개만 사면</h2>
            <span className="meta">누르면 장보기에 담겨요</span>
          </div>
          {rec.near.slice(0, 6).map((x) => (
            <NearRow key={x.recipeId} rec={x} />
          ))}
        </section>
      )}
    </main>
  )
}
