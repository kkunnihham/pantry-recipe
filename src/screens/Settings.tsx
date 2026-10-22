import { useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import { getTheme, setTheme, type Theme } from '../lib/theme'
import { exportAll } from '../lib/db'

export default function Settings() {
  const [theme, setThemeState] = useState<Theme>(getTheme())
  const [status, setStatus] = useState<string | null>(null)

  function pick(t: Theme) {
    setTheme(t)
    setThemeState(t)
  }

  async function download() {
    const data = await exportAll()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pantry-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setStatus('백업 파일을 내려받았어요.')
  }

  return (
    <main className="screen">
      <header className="screen-header">
        <Link className="icon-btn" to="/" aria-label="뒤로">
          <Icon name="back" size={20} />
        </Link>
      </header>
      <h1 className="title">설정</h1>

      <section className="section">
        <h2 className="section-title">테마</h2>
        <div className="row-list">
          <button className="row" onClick={() => pick('dark')} aria-pressed={theme === 'dark'}>
            <span>다크</span>
            {theme === 'dark' && <span style={{ color: 'var(--primary)' }}>사용 중</span>}
          </button>
          <button className="row" onClick={() => pick('light')} aria-pressed={theme === 'light'}>
            <span>라이트</span>
            {theme === 'light' && <span style={{ color: 'var(--primary)' }}>사용 중</span>}
          </button>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">백업</h2>
        <div className="row-list">
          <button className="row" onClick={download}>
            <span>JSON으로 내보내기</span>
            <Icon name="chevron" size={18} style={{ color: 'var(--text-sub)' }} />
          </button>
        </div>
        <p className="meta">가져오기는 데이터 구조가 확정되는 1단계 뒤에 붙여요.</p>
        {status && <p className="meta">{status}</p>}
      </section>
    </main>
  )
}
