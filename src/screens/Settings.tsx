import { useRef, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import { getTheme, setTheme, type Theme } from '../lib/theme'
import { exportAll, importAll } from '../lib/db'
import { loadState } from '../state/store'

export default function Settings() {
  const [theme, setThemeState] = useState<Theme>(getTheme())
  const [status, setStatus] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

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

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    input.value = ''
    if (!file || importing) return
    if (!window.confirm('지금 앱에 있는 재고·기록·장보기를 모두 지우고 백업 파일 내용으로 바꿔요. 계속할까요?')) return

    setImporting(true)
    setStatus(null)
    try {
      const data: unknown = JSON.parse(await file.text())
      const counts = await importAll(data)
      await loadState()
      setStatus(`가져왔어요. 재고 ${counts.inventory}, 기록 ${counts.cookLog}, 평가 ${counts.ratings}, 장보기 ${counts.shopping}`)
    } catch (error) {
      setStatus(error instanceof SyntaxError
        ? 'JSON 파일을 읽을 수 없어요. 백업 파일인지 확인해 주세요.'
        : error instanceof Error && error.message === '백업 파일 형식이 아니에요'
          ? error.message
          : '가져오지 못했어요. 백업 파일을 확인하고 다시 시도해 주세요.')
    } finally {
      setImporting(false)
    }
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
          <button className="row" onClick={download} disabled={importing}>
            <span>JSON으로 내보내기</span>
            <Icon name="chevron" size={18} style={{ color: 'var(--text-sub)' }} />
          </button>
          <button type="button" className="row" onClick={() => fileInput.current?.click()} disabled={importing}>
            <span>JSON 가져오기</span>
            <Icon name="chevron" size={18} style={{ color: 'var(--text-sub)' }} />
          </button>
        </div>
        <input ref={fileInput} type="file" accept="application/json,.json" hidden disabled={importing} onChange={upload} />
        {status && <p className="meta" role="status">{status}</p>}
      </section>

      <section className="section">
        <h2 className="section-title">기록</h2>
        <div className="row-list">
          <Link className="row" to="/history">
            <span>조리 기록</span>
            <Icon name="chevron" size={18} style={{ color: 'var(--text-sub)' }} />
          </Link>
        </div>
      </section>
    </main>
  )
}
