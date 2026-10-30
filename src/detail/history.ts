import type { Unit } from '../data/types'

/**
 * The boards inspected at the same line and station up to and including `unit`, oldest first,
 * at most `count` of them. Shows whether a failure is a one-off or part of a run.
 */
export function stationHistory(units: Unit[], unit: Unit, count = 20): Unit[] {
  return units
    .filter((u) => u.line === unit.line && u.station === unit.station && u.inspectedAt <= unit.inspectedAt)
    .sort((a, b) => a.inspectedAt - b.inspectedAt || a.serial.localeCompare(b.serial))
    .slice(-count)
}
