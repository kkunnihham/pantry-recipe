import { Link } from 'react-router-dom'
import { recipes } from '../data/catalog'
import { KIND_LABEL } from '../data/types'
import { CUISINE_LABEL, DIFFICULTY_LABEL, TIER_LABEL } from '../data/labels'
import { formatMinutes } from '../lib/format'
import Icon from '../components/Icon'

export default function Recipes() {
  const tiers: Array<'basic' | 'discovery'> = ['basic', 'discovery']
  return (
    <main className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">레시피 {recipes.length}개</p>
          <h1 className="title">레시피</h1>
        </div>
      </header>

      {tiers.map((tier) => {
        const list = recipes.filter((r) => r.tier === tier)
        return (
          <section className="section" key={tier}>
            <div className="section-head">
              <h2 className="section-title">{TIER_LABEL[tier]}</h2>
              <span className="meta">{list.length}개</span>
            </div>
            <div className="row-list">
              {list.map((r) => (
                <Link key={r.id} to={`/recipe/${r.id}`} className="row">
                  <div className="card-body" style={{ gap: 2 }}>
                    <span className="card-title" style={{ fontSize: 16 }}>
                      {r.title}
                    </span>
                    <span className="meta">
                      {KIND_LABEL[r.kind]} · {CUISINE_LABEL[r.cuisine]} · {formatMinutes(r.minutes)} · {DIFFICULTY_LABEL[r.difficulty]}
                    </span>
                  </div>
                  <Icon name="chevron" size={18} style={{ color: 'var(--text-muted)' }} />
                </Link>
              ))}
            </div>
          </section>
        )
      })}
    </main>
  )
}
