import type { FlightEvent } from '../data/types'

export interface ParetoRow<T extends string> {
  key: T
  count: number
  /** Running share of all counts up to and including this row, 0–100. */
  cumulativePct: number
}

/**
 * Count items per key for a Pareto chart: highest count first, ties in `keys` order,
 * zero-count keys kept at the end so every category stays visible (and clickable).
 */
export function paretoCounts<T extends string>(values: T[], keys: readonly T[]): ParetoRow<T>[] {
  const counts = new Map<T, number>(keys.map((k) => [k, 0]))
  for (const v of values) {
    if (counts.has(v)) counts.set(v, counts.get(v)! + 1)
  }
  const total = values.filter((v) => counts.has(v)).length
  const sorted = keys
    .map((key, order) => ({ key, order, count: counts.get(key)! }))
    .sort((a, b) => b.count - a.count || a.order - b.order)

  let running = 0
  return sorted.map(({ key, count }) => {
    running += count
    return { key, count, cumulativePct: total === 0 ? 0 : (running / total) * 100 }
  })
}

export function eventTypePareto(events: FlightEvent[], types: readonly FlightEvent['type'][]) {
  return paretoCounts(
    events.map((e) => e.type),
    types,
  )
}
