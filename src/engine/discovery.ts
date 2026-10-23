/**
 * 오늘의 발견: 지금 만들 수 있는 것 중 한 번도 안 해본 레시피를 하루 동안 고정해서 하나 고른다.
 * "다른 것 보기"는 skip 목록에 넣고 다시 고른다.
 */
import type { Recommendation } from './recommend'

/** 문자열에서 결정적인 32비트 해시 (FNV-1a). */
export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

export function dateKey(ts: number = Date.now()): string {
  const d = new Date(ts)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export interface DiscoveryOptions {
  dateKey: string
  skipIds?: ReadonlySet<string>
  /** 발견 후보로 삼을 층. 기본은 'discovery' 층만. */
  tierOf?: (recipeId: string) => 'basic' | 'discovery'
  preferDiscoveryTier?: boolean
}

/**
 * "하나만 사면 새 요리": near 목록에서 구매 1개짜리 안 해본 레시피를 하루 하나 고른다.
 * 발견층을 우선하고, 없으면 기본층도 허용한다.
 */
export function pickNearDiscovery(near: readonly Recommendation[], opts: DiscoveryOptions): Recommendation | null {
  const skip = opts.skipIds ?? new Set<string>()
  let pool = near.filter((r) => r.neverCooked && r.purchaseCount === 1 && !skip.has(r.recipeId))
  if (opts.preferDiscoveryTier !== false && opts.tierOf) {
    const disc = pool.filter((r) => opts.tierOf!(r.recipeId) === 'discovery')
    if (disc.length > 0) pool = disc
  }
  if (pool.length === 0) return null
  const sorted = [...pool].sort((a, b) => a.recipeId.localeCompare(b.recipeId))
  const idx = hashString(`near|${opts.dateKey}|${sorted.map((r) => r.recipeId).join(',')}`) % sorted.length
  return sorted[idx]
}

/**
 * ready 목록(점수순)에서 안 해본 레시피를 모아 날짜 해시로 하나 고른다.
 * 같은 날, 같은 후보 집합이면 항상 같은 결과.
 */
export function pickDiscovery(ready: readonly Recommendation[], opts: DiscoveryOptions): Recommendation | null {
  const skip = opts.skipIds ?? new Set<string>()
  let pool = ready.filter((r) => r.neverCooked && !skip.has(r.recipeId))
  if (opts.preferDiscoveryTier !== false && opts.tierOf) {
    const disc = pool.filter((r) => opts.tierOf!(r.recipeId) === 'discovery')
    if (disc.length > 0) pool = disc
  }
  if (pool.length === 0) return null
  const sorted = [...pool].sort((a, b) => a.recipeId.localeCompare(b.recipeId))
  const idx = hashString(`${opts.dateKey}|${sorted.map((r) => r.recipeId).join(',')}`) % sorted.length
  return sorted[idx]
}
