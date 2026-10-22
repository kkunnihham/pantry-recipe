import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Icon from '../components/Icon'
import { ingredientById, recipeById } from '../data/catalog'
import type { Rating, StockState } from '../lib/db'
import { formatTimer } from '../lib/format'
import { logCook, rateRecipe, setStocks, useAppState } from '../state/store'

/** 화면 꺼짐 방지. 지원 안 하면 조용히 무시. */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    const request = async () => {
      try {
        lock = await navigator.wakeLock.request('screen')
      } catch {
        lock = null
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !cancelled) void request()
    }
    void request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release()
    }
  }, [active])
}

function beep() {
  try {
    const ctx = new AudioContext()
    const now = ctx.currentTime
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = 880
      o.connect(g)
      g.connect(ctx.destination)
      g.gain.setValueAtTime(0.0001, now + i * 0.35)
      g.gain.exponentialRampToValueAtTime(0.3, now + i * 0.35 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.35 + 0.25)
      o.start(now + i * 0.35)
      o.stop(now + i * 0.35 + 0.3)
    }
  } catch {
    // 오디오를 못 쓰는 환경
  }
  if ('vibrate' in navigator) navigator.vibrate([300, 150, 300, 150, 300])
}

interface TimerState {
  total: number
  /** 실행 중이면 끝나는 시각(ms), 아니면 null */
  endAt: number | null
  /** 멈췄을 때 남은 초 */
  remaining: number
  done: boolean
}

function StepTimer({ seconds }: { seconds: number }) {
  const [t, setT] = useState<TimerState>({ total: seconds, endAt: null, remaining: seconds, done: false })
  const [, tick] = useState(0)
  const doneRef = useRef(false)

  useEffect(() => {
    setT({ total: seconds, endAt: null, remaining: seconds, done: false })
    doneRef.current = false
  }, [seconds])

  useEffect(() => {
    if (t.endAt === null) return
    const iv = setInterval(() => {
      const left = Math.max(0, Math.ceil((t.endAt! - Date.now()) / 1000))
      if (left <= 0 && !doneRef.current) {
        doneRef.current = true
        beep()
        setT((p) => ({ ...p, endAt: null, remaining: 0, done: true }))
      } else tick((n) => n + 1)
    }, 250)
    return () => clearInterval(iv)
  }, [t.endAt])

  const remaining = t.endAt === null ? t.remaining : Math.max(0, Math.ceil((t.endAt - Date.now()) / 1000))
  const running = t.endAt !== null
  const progress = 1 - remaining / t.total

  return (
    <div className={`timer ${t.done ? 'is-done' : ''}`}>
      <div className="timer-ring" style={{ ['--p' as string]: progress }}>
        <span className="timer-text">{t.done ? '완료' : formatTimer(remaining)}</span>
      </div>
      <div className="timer-actions">
        {!running ? (
          <button type="button" className="btn btn--primary" onClick={() => setT((p) => ({ ...p, endAt: Date.now() + p.remaining * 1000, done: false }))} disabled={remaining === 0 && !t.done}>
            <Icon name="play" size={18} /> {t.done ? '다시' : remaining < t.total ? '계속' : '시작'}
          </button>
        ) : (
          <button type="button" className="btn btn--ghost" onClick={() => setT((p) => ({ ...p, endAt: null, remaining }))}>
            <Icon name="pause" size={18} /> 멈춤
          </button>
        )}
        <button
          type="button"
          className="icon-btn"
          aria-label="타이머 초기화"
          onClick={() => {
            doneRef.current = false
            setT({ total: seconds, endAt: null, remaining: seconds, done: false })
          }}
        >
          <Icon name="reset" size={18} />
        </button>
      </div>
    </div>
  )
}

type Usage = 'left' | 'low' | 'used'

export default function Cook() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const s = useAppState()
  const recipe = id ? recipeById.get(id) : undefined
  const servings = Math.min(3, Math.max(1, Number(params.get('servings') ?? 1) || 1))
  const [step, setStep] = useState(0)
  const [finishing, setFinishing] = useState(false)
  const [usage, setUsage] = useState<Record<string, Usage>>({})
  const [rating, setRating] = useState<Rating | null>(null)
  const [photo, setPhoto] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  useWakeLock(!!recipe && !finishing)

  if (!recipe) {
    return (
      <main className="screen">
        <div className="card empty">그런 레시피가 없어요.</div>
        <Link to="/" className="btn btn--primary">
          홈으로
        </Link>
      </main>
    )
  }

  // 조리 완료 때 물어볼 재료: 꼭 필요·중요 재료 중 지금 갖고 있는 것 (대체재 포함)
  const askIds = [
    ...new Set(
      recipe.groups
        .filter((g) => g.role === 'core' || g.role === 'major')
        .flatMap((g) => g.items.flatMap((it) => [it.ingredientId, ...it.substitutions.flatMap((x) => x.ingredientIds)]))
        .filter((iid) => s.inventory.has(iid)),
    ),
  ]

  async function save() {
    setSaving(true)
    const changes: Array<[string, StockState]> = []
    for (const [iid, u] of Object.entries(usage)) {
      if (u === 'used') changes.push([iid, 'none'])
      else if (u === 'low') changes.push([iid, 'low'])
    }
    if (changes.length) await setStocks(changes)
    await logCook(recipe!.id, servings, photo ?? undefined)
    if (rating) await rateRecipe(recipe!.id, rating)
    navigate('/', { replace: true })
  }

  if (finishing) {
    return (
      <main className="screen cook">
        <header className="screen-header">
          <button type="button" className="icon-btn" aria-label="단계로 돌아가기" onClick={() => setFinishing(false)}>
            <Icon name="back" size={20} />
          </button>
        </header>
        <div>
          <p className="eyebrow">{recipe.title}</p>
          <h1 className="title">다 만들었어요</h1>
        </div>

        <section className="section">
          <div className="section-head">
            <h2 className="section-title">재료 정리</h2>
            <span className="meta">안 바꾸면 그대로 남아요</span>
          </div>
          <div className="row-list">
            {askIds.length === 0 && <div className="row meta">정리할 재료가 없어요</div>}
            {askIds.map((iid) => {
              const u = usage[iid] ?? 'left'
              return (
                <div className="row" key={iid}>
                  <span>{ingredientById.get(iid)?.name ?? iid}</span>
                  <div className="segmented" role="group" aria-label={`${ingredientById.get(iid)?.name} 남은 양`}>
                    {(['left', 'low', 'used'] as Usage[]).map((v) => (
                      <button key={v} type="button" aria-pressed={u === v} onClick={() => setUsage((p) => ({ ...p, [iid]: v }))}>
                        {v === 'left' ? '남음' : v === 'low' ? '조금' : '다 씀'}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="section">
          <h2 className="section-title">어땠어요?</h2>
          <div className="segmented segmented--wide" role="group" aria-label="평가">
            <button type="button" aria-pressed={rating === 'again'} onClick={() => setRating(rating === 'again' ? null : 'again')}>
              또 할래
            </button>
            <button type="button" aria-pressed={rating === 'meh'} onClick={() => setRating(rating === 'meh' ? null : 'meh')}>
              별로
            </button>
          </div>
          <p className="meta">"별로"는 추천에서 빠져요. 아무것도 안 누르면 보류예요.</p>
        </section>

        <section className="section">
          <h2 className="section-title">사진</h2>
          <label className="btn btn--ghost photo-btn">
            <Icon name="camera" size={18} /> {photo ? '다시 찍기' : '사진 남기기 (선택)'}
            <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          </label>
          {photo && <img className="photo-preview" src={URL.createObjectURL(photo)} alt="완성 사진" />}
        </section>

        <div className="sticky-cta">
          <button type="button" className="btn btn--primary" style={{ width: '100%' }} onClick={save} disabled={saving}>
            {saving ? '저장 중' : '저장하고 끝내기'}
          </button>
        </div>
      </main>
    )
  }

  const current = recipe.steps[step]
  const last = step === recipe.steps.length - 1

  return (
    <main className="screen cook">
      <header className="screen-header">
        <Link className="icon-btn" to={`/recipe/${recipe.id}`} aria-label="조리 그만두기">
          <Icon name="close" size={20} />
        </Link>
        <div style={{ textAlign: 'right' }}>
          <p className="eyebrow">{recipe.title}</p>
          <p className="meta">
            {servings}인분 · {step + 1} / {recipe.steps.length}
          </p>
        </div>
      </header>

      <div className="progress" aria-hidden="true">
        {recipe.steps.map((_, i) => (
          <span key={i} className={i <= step ? 'is-done' : undefined} />
        ))}
      </div>

      <div className="cook-step" key={step}>
        <span className="step-num" style={{ width: 34, height: 34, fontSize: 16 }}>
          {step + 1}
        </span>
        <p className="cook-text">{current.text}</p>
        {current.timerSeconds ? <StepTimer seconds={current.timerSeconds} /> : null}
      </div>

      <div className="cook-nav">
        <button type="button" className="btn btn--ghost" onClick={() => setStep((v) => Math.max(0, v - 1))} disabled={step === 0}>
          이전
        </button>
        {last ? (
          <button type="button" className="btn btn--primary" style={{ flex: 1 }} onClick={() => setFinishing(true)}>
            다 만들었어요
          </button>
        ) : (
          <button type="button" className="btn btn--primary" style={{ flex: 1 }} onClick={() => setStep((v) => v + 1)}>
            다음
          </button>
        )}
      </div>
    </main>
  )
}
