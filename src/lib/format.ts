/** 수량을 인분에 맞춰 환산하고 사람이 읽기 좋게 만든다. */
export function scaleAmount(amount: number | null, unit: string, servings: number): string {
  if (amount === null) return '적당량'
  // 꼬집은 인분을 늘려도 1~2 정도로만
  const v = unit === '꼬집' ? Math.min(amount * servings, 2) : amount * servings
  return `${formatNumber(v)}${unit}`
}

export function formatNumber(v: number): string {
  if (Number.isInteger(v)) return String(v)
  const rounded = Math.round(v * 10) / 10
  // 0.5 단위 분수 표기가 자연스러운 단위는 그대로 소수 표시
  return String(rounded)
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min}분`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}시간 ${m}분` : `${h}시간`
}

export function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}초`
  return s ? `${m}분 ${s}초` : `${m}분`
}
