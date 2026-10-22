import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import { recipeById } from '../data/catalog'
import { getDB, type CookLogRow } from '../lib/db'
import { useAppState } from '../state/store'

function dateTitle(date: Date, today: Date): string {
  if (date.toDateString() === today.toDateString()) return '오늘'
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return '어제'
  const monthDay = `${date.getMonth() + 1}월 ${date.getDate()}일`
  return date.getFullYear() === today.getFullYear() ? monthDay : `${date.getFullYear()}년 ${monthDay}`
}

export default function History() {
  const { ratings } = useAppState()
  const [rows, setRows] = useState<CookLogRow[] | null>(null)
  const [photoUrls, setPhotoUrls] = useState<ReadonlyMap<CookLogRow, string>>(new Map())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const db = await getDB()
        const logs = await db.getAll('cookLog')
        if (!cancelled) setRows(logs.sort((a, b) => b.cookedAt - a.cookedAt))
      } catch {
        if (!cancelled) setError('조리 기록을 불러오지 못했어요. 잠시 후 다시 열어 주세요.')
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const urls = new Map<CookLogRow, string>()
    for (const row of rows ?? []) {
      if (row.photo instanceof Blob) urls.set(row, URL.createObjectURL(row.photo))
    }
    setPhotoUrls(urls)
    return () => { for (const url of urls.values()) URL.revokeObjectURL(url) }
  }, [rows])

  const today = new Date()
  const groups = new Map<string, { date: Date; rows: CookLogRow[] }>()
  for (const row of rows ?? []) {
    const date = new Date(row.cookedAt)
    const key = date.toDateString()
    const group = groups.get(key)
    if (group) group.rows.push(row)
    else groups.set(key, { date, rows: [row] })
  }

  return (
    <main className="screen">
      <header className="screen-header history-header">
        <Link className="icon-btn" to="/settings" aria-label="뒤로">
          <Icon name="back" size={20} />
        </Link>
        <div>
          <h1 className="title">조리 기록</h1>
          <p className="eyebrow">전체 {rows?.length ?? 0}번</p>
        </div>
      </header>

      {error && <p className="meta" role="status">{error}</p>}
      {rows?.length === 0 && <div className="card empty">아직 조리 기록이 없어요. 조리 모드를 끝까지 마치면 여기에 쌓여요.</div>}
      {[...groups].map(([key, group]) => (
        <section className="section" key={key}>
          <h2 className="section-title">{dateTitle(group.date, today)}</h2>
          <div className="row-list">
            {group.rows.map((row) => {
              const title = recipeById.get(row.recipeId)?.title ?? row.recipeId
              const rating = ratings.get(row.recipeId)
              const photoUrl = photoUrls.get(row)
              return (
                <Link className="row history-row" to={`/recipe/${encodeURIComponent(row.recipeId)}`} key={row.id}>
                  {photoUrl && <img className="history-photo" src={photoUrl} alt={`${title} 조리 사진`} width={56} height={56} />}
                  <div className="card-body">
                    <span className="card-title">{title}</span>
                    <span className="meta">{row.servings}인분 · {new Date(row.cookedAt).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                  </div>
                  {rating && <span className={`chip${rating === 'meh' ? ' chip--muted' : ''}`}>{rating === 'again' ? '또 할래' : '별로'}</span>}
                </Link>
              )
            })}
          </div>
        </section>
      ))}
    </main>
  )
}
