import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import { ingredientById, recipeById } from '../data/catalog'
import { checkShopping, removeFromShopping, useAppState } from '../state/store'

export default function Shopping() {
  const { shopping } = useAppState()
  const rows = [...shopping.values()].sort((a, b) => a.addedAt - b.addedAt)

  return (
    <main className="screen">
      <header className="screen-header shopping-header">
        <Link className="icon-btn" to="/fridge" aria-label="뒤로">
          <Icon name="back" size={20} />
        </Link>
        <div>
          <h1 className="title">장보기</h1>
          <p className="eyebrow">{rows.length}개</p>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="card empty">장보기 목록이 비어 있어요. 오늘 탭의 '1~2개만 사면'에서 재료를 누르면 여기에 담겨요.</div>
      ) : (
        <div className="row-list">
          {rows.map((row) => {
            const titles = row.fromRecipeIds.flatMap((id) => {
              const recipe = recipeById.get(id)
              return recipe ? [recipe.title] : []
            })
            return (
              <div className="row shopping-row" key={row.ingredientId}>
                <div className="card-body">
                  <span className="card-title shopping-name">{ingredientById.get(row.ingredientId)?.name ?? row.ingredientId}</span>
                  {titles.length > 0 && <span className="meta">{titles.join(', ')}에 필요</span>}
                </div>
                <div className="shopping-actions">
                  <button type="button" className="icon-btn shopping-check" aria-label="샀어요" onClick={() => checkShopping(row.ingredientId)}>
                    <Icon name="check" size={20} />
                  </button>
                  <button type="button" className="icon-btn" aria-label="빼기" onClick={() => removeFromShopping(row.ingredientId)}>
                    <Icon name="close" size={20} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <p className="meta">체크하면 냉장고에 '있음'으로 들어가요.</p>
    </main>
  )
}
