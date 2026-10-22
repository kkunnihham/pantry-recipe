import { useMemo } from 'react'
import { recipes, recipeById } from '../data/catalog'
import { useAppState } from '../state/store'
import { evaluateAll, type EvaluateAllResult, type Recommendation } from './recommend'
import { dateKey, pickDiscovery } from './discovery'

export interface RecommendationView extends EvaluateAllResult {
  byId: ReadonlyMap<string, Recommendation>
  discovery: Recommendation | null
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
    const discovery = pickDiscovery(result.ready, { dateKey: today, skipIds, tierOf: (id) => recipeById.get(id)!.tier })
    return { ...result, byId: new Map(result.all.map((r) => [r.recipeId, r])), discovery, today }
  }, [s.inventory, s.ownedTools, s.lastCooked, s.ratings, s.discoverySkips])
}
