import { useMemo } from 'react'
import { recipes, recipeById } from '../data/catalog'
import { useAppState } from '../state/store'
import { evaluateAll, type EvaluateAllResult, type Recommendation } from './recommend'
import { dateKey, pickDiscovery, pickNearDiscovery } from './discovery'

export interface RecommendationView extends EvaluateAllResult {
  byId: ReadonlyMap<string, Recommendation>
  discovery: Recommendation | null
  /** 하나만 사면 되는 안 해본 요리 */
  nearDiscovery: Recommendation | null
  today: string
}

export function useRecommendations(): RecommendationView {
  const s = useAppState()
  return useMemo(() => {
    const result = evaluateAll(recipes, {
      inventory: s.inventory,
      ownedTools: s.ownedTools,
      lastCooked: s.lastCooked,
      ratings: s.ratings,
    })
    const today = dateKey()
    const skipIds = new Set(s.discoverySkips.date === today ? s.discoverySkips.ids : [])
    const tierOf = (id: string) => recipeById.get(id)!.tier
    const discovery = pickDiscovery(result.ready, { dateKey: today, skipIds, tierOf })
    const nearSkipIds = new Set(s.nearSkips.date === today ? s.nearSkips.ids : [])
    const nearDiscovery = pickNearDiscovery(result.near, { dateKey: today, skipIds: nearSkipIds, tierOf })
    return { ...result, byId: new Map(result.all.map((r) => [r.recipeId, r])), discovery, nearDiscovery, today }
  }, [s.inventory, s.ownedTools, s.lastCooked, s.ratings, s.discoverySkips, s.nearSkips])
}
