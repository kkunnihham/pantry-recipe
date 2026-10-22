/**
 * 추천 엔진 (계획서 5절).
 *
 * 입력: 레시피, 재고(있음/부족/없음), 보유 도구, 조리 기록, 평가.
 * 출력: 레시피마다 구역(바로 가능 / 대체해서 가능 / 1~2개만 사면 / 숨김)과 점수, 설명 근거.
 *
 * 수량은 다루지 않는다. "부족"은 관문을 통과시키되 표시와 정렬에만 반영한다.
 */
import type { MatchRule, Recipe, ReqGroup, ReqItem, Role, Tool } from '../data/types'

export type StockState = 'have' | 'low' | 'none'
export type Bucket = 'ready_exact' | 'ready_substituted' | 'near' | 'hidden'

export interface EngineInput {
  /** ingredientId → 상태. 없는 키는 none. */
  inventory: ReadonlyMap<string, StockState>
  ownedTools: ReadonlySet<Tool>
  /** recipeId → 마지막 조리 시각(ms). */
  lastCooked?: ReadonlyMap<string, number>
  /** recipeId → 평가 */
  ratings?: ReadonlyMap<string, 'again' | 'meh'>
  now?: number
  config?: Partial<EngineConfig>
}

export interface EngineConfig {
  /** 핵심 관문을 대체재로 통과시키려면 이 적합도 이상 */
  coreSubstituteMinFit: number
  nearMaxPurchases: number
  nearCoreMinPercent: number
  nearPostPurchaseMinPercent: number
  /** 최근 조리 감점: 이 기간 안이면 recentPenalty 만큼 뺀다 */
  recentDays: number
  recentPenalty: number
  /** "부족" 재료 하나당 정렬 감점 */
  lowPenaltyPerItem: number
  againBonus: number
}

export const DEFAULT_CONFIG: EngineConfig = {
  coreSubstituteMinFit: 0.75,
  nearMaxPurchases: 2,
  nearCoreMinPercent: 25,
  nearPostPurchaseMinPercent: 40,
  recentDays: 7,
  recentPenalty: 30,
  lowPenaltyPerItem: 2,
  againBonus: 5,
}

export interface UsedSubstitution {
  groupId: string
  /** 원래 재료 */
  forIngredientId: string
  /** 대신 쓰는 재료들 */
  viaIngredientIds: string[]
  fit: number
  note?: string
}

export interface MissingCore {
  groupId: string
  groupName: string
  /** 가장 적게 사도 되는 경로의 재료 ID들 (보통 1개) */
  buy: string[]
}

export interface Recommendation {
  recipeId: string
  bucket: Bucket
  /** 숨김 사유 (bucket === 'hidden' 일 때) */
  hiddenReason?: 'tool' | 'meh' | 'core_missing'
  matchPercent: number
  coreMatchPercent: number
  postPurchasePercent: number
  sortScore: number
  purchaseCount: number
  missingCore: MissingCore[]
  usedSubstitutions: UsedSubstitution[]
  /** 쓰이는 재료 중 "부족" 상태인 것 */
  lowIngredientIds: string[]
  /** 핵심이 아닌데 없는 그룹 이름 (안내용) */
  missingOptionalNames: string[]
  cookedRecently: boolean
  neverCooked: boolean
}

interface ItemEval {
  score: number
  /** 관문을 통과시킬 수 있는가 (핵심 그룹 기준) */
  gateOk: boolean
  /** 비핵심 그룹에서 "있다"고 칠 수 있는가 */
  presentOk: boolean
  substitution?: UsedSubstitution
  lowIds: string[]
  /** 이 항목을 충족시키려면 사야 하는 최소 재료 */
  buy: string[]
}

interface GroupEval {
  group: ReqGroup
  score: number
  gateOk: boolean
  substitution?: UsedSubstitution
  lowIds: string[]
  buy: string[]
}

function stateOf(inv: ReadonlyMap<string, StockState>, id: string): StockState {
  return inv.get(id) ?? 'none'
}

function present(s: StockState): boolean {
  return s !== 'none'
}

function evalItem(item: ReqItem, group: ReqGroup, inv: ReadonlyMap<string, StockState>, cfg: EngineConfig): ItemEval {
  const direct = stateOf(inv, item.ingredientId)
  if (present(direct)) {
    return { score: 1, gateOk: true, presentOk: true, lowIds: direct === 'low' ? [item.ingredientId] : [], buy: [] }
  }
  // 대체재: 모든 구성 재료가 있어야 함. 적합도가 높은 것부터.
  let best: ItemEval | null = null
  for (const s of [...item.substitutions].sort((a, b) => b.fit - a.fit)) {
    const states = s.ingredientIds.map((id) => stateOf(inv, id))
    if (!states.every(present)) continue
    const gateOk = s.fit >= cfg.coreSubstituteMinFit
    const cand: ItemEval = {
      score: s.fit,
      gateOk,
      presentOk: true,
      substitution: { groupId: group.id, forIngredientId: item.ingredientId, viaIngredientIds: s.ingredientIds, fit: s.fit, note: s.note },
      lowIds: s.ingredientIds.filter((_id, i) => states[i] === 'low'),
      buy: [],
    }
    if (!best || cand.score > best.score) best = cand
  }
  if (best) return best
  return { score: 0, gateOk: false, presentOk: false, lowIds: [], buy: [item.ingredientId] }
}

function evalGroup(group: ReqGroup, inv: ReadonlyMap<string, StockState>, cfg: EngineConfig): GroupEval {
  const items = group.items.map((it) => evalItem(it, group, inv, cfg))
  const rule: MatchRule = group.matchRule
  const isCore = group.isCoreGate
  const okFn = (e: ItemEval) => (isCore ? e.gateOk : e.presentOk)

  if (rule === 'one_of' || rule === 'optional') {
    // 가장 좋은 항목 하나. 직접 보유(score 1)가 대체재보다 우선.
    const ranked = [...items].sort((a, b) => b.score - a.score || (a.substitution ? 1 : 0) - (b.substitution ? 1 : 0))
    const best = ranked[0]
    const ok = ranked.some(okFn)
    const chosen = ranked.find(okFn) ?? best
    return {
      group,
      score: ok ? chosen.score : 0,
      gateOk: rule === 'optional' ? true : ok,
      substitution: ok ? chosen.substitution : undefined,
      lowIds: ok ? chosen.lowIds : [],
      buy: ok ? [] : [group.items[0].ingredientId],
    }
  }
  if (rule === 'all_of') {
    const ok = items.every(okFn)
    const score = items.reduce((a, e) => a + e.score, 0) / items.length
    const subs = items.map((e) => e.substitution).filter((s): s is UsedSubstitution => !!s)
    return {
      group,
      score: ok ? score : score * 0.5,
      gateOk: ok,
      substitution: subs[0],
      lowIds: items.flatMap((e) => e.lowIds),
      buy: items.filter((e) => !okFn(e)).map((e) => e.buy[0]),
    }
  }
  // at_least
  const n = group.minCount ?? 1
  const okItems = items.filter(okFn).sort((a, b) => b.score - a.score)
  const ok = okItems.length >= n
  const top = okItems.slice(0, n)
  const score = ok ? top.reduce((a, e) => a + e.score, 0) / n : okItems.length / n
  const missing = items.filter((e) => !okFn(e)).slice(0, Math.max(0, n - okItems.length))
  return {
    group,
    score,
    gateOk: ok,
    substitution: top.find((e) => e.substitution)?.substitution,
    lowIds: top.flatMap((e) => e.lowIds),
    buy: missing.map((e) => e.buy[0]),
  }
}

function weightedPercent(evals: GroupEval[], pick: (e: GroupEval) => number): number {
  const total = evals.reduce((a, e) => a + e.group.weight, 0)
  if (total === 0) return 100
  return Math.round((100 * evals.reduce((a, e) => a + e.group.weight * pick(e), 0)) / total)
}

const GATE_ROLES: Role[] = ['core', 'major']

export function evaluateRecipe(recipe: Recipe, input: EngineInput): Recommendation {
  const cfg: EngineConfig = { ...DEFAULT_CONFIG, ...(input.config ?? {}) }
  const now = input.now ?? Date.now()
  const last = input.lastCooked?.get(recipe.id)
  const cookedRecently = last !== undefined && now - last < cfg.recentDays * 24 * 3600 * 1000
  const neverCooked = last === undefined
  const rating = input.ratings?.get(recipe.id)

  const evals = recipe.groups.map((g) => evalGroup(g, input.inventory, cfg))
  const coreEvals = evals.filter((e) => e.group.isCoreGate)
  const matchPercent = weightedPercent(evals, (e) => e.score)
  const coreMatchPercent = weightedPercent(coreEvals, (e) => e.score)
  const postPurchasePercent = weightedPercent(evals, (e) => (e.group.isCoreGate && !e.gateOk ? 1 : e.score))

  const missingCore: MissingCore[] = coreEvals
    .filter((e) => !e.gateOk)
    .map((e) => ({ groupId: e.group.id, groupName: e.group.name, buy: e.buy }))
  const purchaseCount = missingCore.reduce((a, m) => a + m.buy.length, 0)
  const usedSubstitutions = evals
    .filter((e) => GATE_ROLES.includes(e.group.role))
    .map((e) => e.substitution)
    .filter((s): s is UsedSubstitution => !!s)
  const lowIngredientIds = [...new Set(evals.flatMap((e) => e.lowIds))]
  const missingOptionalNames = evals.filter((e) => !e.group.isCoreGate && e.score === 0).map((e) => e.group.name)

  const base = {
    recipeId: recipe.id,
    matchPercent,
    coreMatchPercent,
    postPurchasePercent,
    purchaseCount,
    missingCore,
    usedSubstitutions,
    lowIngredientIds,
    missingOptionalNames,
    cookedRecently,
    neverCooked,
  }

  const toolMissing = recipe.tools.some((t) => !input.ownedTools.has(t))
  if (toolMissing) return { ...base, bucket: 'hidden', hiddenReason: 'tool', sortScore: 0 }
  if (rating === 'meh') return { ...base, bucket: 'hidden', hiddenReason: 'meh', sortScore: 0 }

  let bucket: Bucket
  if (missingCore.length === 0) {
    bucket = usedSubstitutions.some((s) => recipe.groups.find((g) => g.id === s.groupId)?.isCoreGate) ? 'ready_substituted' : 'ready_exact'
  } else if (
    purchaseCount >= 1 &&
    purchaseCount <= cfg.nearMaxPurchases &&
    coreMatchPercent >= cfg.nearCoreMinPercent &&
    postPurchasePercent >= cfg.nearPostPurchaseMinPercent
  ) {
    bucket = 'near'
  } else {
    return { ...base, bucket: 'hidden', hiddenReason: 'core_missing', sortScore: 0 }
  }

  let sortScore = bucket === 'near' ? postPurchasePercent : matchPercent
  sortScore -= lowIngredientIds.length * cfg.lowPenaltyPerItem
  if (cookedRecently) sortScore -= cfg.recentPenalty
  if (rating === 'again') sortScore += cfg.againBonus
  return { ...base, bucket, sortScore: Math.round(sortScore * 10) / 10 }
}

export interface EvaluateAllResult {
  all: Recommendation[]
  ready: Recommendation[]
  near: Recommendation[]
  hidden: Recommendation[]
}

const BUCKET_ORDER: Record<Bucket, number> = { ready_exact: 0, ready_substituted: 1, near: 2, hidden: 3 }

export function evaluateAll(recipes: readonly Recipe[], input: EngineInput): EvaluateAllResult {
  const all = recipes.map((r) => evaluateRecipe(r, input))
  const byScore = (a: Recommendation, b: Recommendation) =>
    BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket] || b.sortScore - a.sortScore || a.recipeId.localeCompare(b.recipeId)
  const ready = all.filter((r) => r.bucket === 'ready_exact' || r.bucket === 'ready_substituted').sort(byScore)
  const near = all.filter((r) => r.bucket === 'near').sort(byScore)
  const hidden = all.filter((r) => r.bucket === 'hidden')
  return { all, ready, near, hidden }
}
