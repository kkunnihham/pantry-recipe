/** 수량을 인분에 맞춰 환산하고 사람이 읽기 좋게 만든다. */
export function scaleAmount(amount: number | null, unit: string, servings: number): string {
  if (amount === null) return '적당량'
  const raw = amount * servings
  if (servings === 1) return `${formatNumber(raw)}${unit}`
  // 꼬집은 인분을 늘려도 1~2 정도로만
  if (unit === '꼬집') return `${Math.min(Math.max(1, Math.round(raw)), 2)}${unit}`
  // 무게·부피는 5 단위로
  if (unit === 'g' || unit === 'ml') return `${Math.max(5, Math.round(raw / 5) * 5)}${unit}`
  // 숟가락은 0.5 단위, 반 큰술 미만이면 작은술로
  if (unit === '큰술' && raw < 0.5) return `${Math.max(0.5, Math.round(raw * 3 * 2) / 2)}작은술`
  if (unit === '큰술' || unit === '작은술' || unit === '컵') return `${Math.max(0.5, Math.round(raw * 2) / 2)}${unit}`
  // 개수 단위는 0.5 단위
  return `${formatNumber(Math.max(0.5, Math.round(raw * 2) / 2))}${unit}`
}

/** 물 양을 인분에 맞춰 환산한다. 5ml 단위로 반올림해 162.5ml 같은 값이 안 나오게 한다. */
export function scaleWater(amountMl: number, factor: number): string {
  if (factor === 1) return `${formatNumber(amountMl)}ml`
  return `${Math.max(5, Math.round((amountMl * factor) / 5) * 5)}ml`
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
