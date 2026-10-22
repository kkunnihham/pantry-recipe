import { Link } from 'react-router-dom'
import Icon from '../components/Icon'

export default function Shopping() {
  return (
    <main className="screen">
      <header className="screen-header">
        <Link className="icon-btn" to="/fridge" aria-label="뒤로">
          <Icon name="back" size={20} />
        </Link>
      </header>
      <h1 className="title">장보기</h1>
      <div className="card empty">"1개만 사면" 카드에서 담은 재료가 여기 모여요. 체크하면 냉장고로 들어가요.</div>
    </main>
  )
}
