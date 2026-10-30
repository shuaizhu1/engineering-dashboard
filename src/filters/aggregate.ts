import type { Defect, DefectType, Unit } from '../data/types'

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

export function defectTypePareto(defects: Defect[], types: readonly DefectType[]) {
  return paretoCounts(
    defects.map((d) => d.type),
    types,
  )
}

export interface DailyYield {
  /** Start of the UTC day, epoch ms. */
  day: number
  inspected: number
  passed: number
  /** First-pass yield, 0–100; null on a day with no boards. */
  yieldPct: number | null
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * First-pass yield per UTC day, oldest first, with every day between the first and last board
 * present so gaps show as gaps rather than being bridged.
 */
export function dailyYield(units: Unit[]): DailyYield[] {
  if (units.length === 0) return []
  const byDay = new Map<number, { inspected: number; passed: number }>()
  let first = Infinity
  let last = -Infinity
  for (const u of units) {
    const day = Math.floor(u.inspectedAt / DAY_MS) * DAY_MS
    first = Math.min(first, day)
    last = Math.max(last, day)
    const counts = byDay.get(day) ?? { inspected: 0, passed: 0 }
    counts.inspected++
    if (u.result === 'pass') counts.passed++
    byDay.set(day, counts)
  }
  const rows: DailyYield[] = []
  for (let day = first; day <= last; day += DAY_MS) {
    const { inspected, passed } = byDay.get(day) ?? { inspected: 0, passed: 0 }
    rows.push({ day, inspected, passed, yieldPct: inspected ? (passed / inspected) * 100 : null })
  }
  return rows
}

/** Overall first-pass yield, 0–100; null with no boards. */
export function overallYield(units: Unit[]): number | null {
  if (units.length === 0) return null
  return (units.filter((u) => u.result === 'pass').length / units.length) * 100
}
