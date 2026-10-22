import { NavLink, useLocation } from 'react-router-dom'
import Icon, { type IconName } from './Icon'

const tabs: { to: string; label: string; icon: IconName; match: (p: string) => boolean }[] = [
  { to: '/fridge', label: '냉장고', icon: 'fridge', match: (p) => p.startsWith('/fridge') || p.startsWith('/shopping') },
  { to: '/', label: '오늘', icon: 'today', match: (p) => p === '/' || p.startsWith('/settings') },
  { to: '/recipes', label: '레시피', icon: 'recipes', match: (p) => p.startsWith('/recipe') },
]

export default function BottomNav() {
  const { pathname } = useLocation()
  // 조리 모드는 화면을 꽉 채우므로 탭을 숨긴다.
  if (pathname.startsWith('/cook/')) return null
  return (
    <nav className="bottom-nav" aria-label="주요 화면">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} className={t.match(pathname) ? 'active' : undefined} end={t.to === '/'}>
          <span className="pill">
            <Icon name={t.icon} />
          </span>
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}
