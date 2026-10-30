import { describe, expect, it } from 'vitest'
import { buildParetoOption, buildYieldOption } from '../charts/dashboardOptions'
import { appConfig } from '../config'
import { DEFECT_TYPES, LINES, STATIONS, type Defect, type LineData, type Unit } from '../data/types'
import { dailyYield, defectTypePareto, overallYield } from './aggregate'
import { EMPTY_FILTERS, dateRangeBounds, filterDefects, filterUnits, type Filters } from './filters'

const DAY_MS = 24 * 60 * 60 * 1000

/** `total` boards over 30 days; every 10th fails with 6 defects. */
function dataset(total: number): LineData {
  const units: Unit[] = []
  const defects: Defect[] = []
  const start = Date.UTC(2026, 9, 1)
  for (let i = 0; i < total; i++) {
    const serial = `SN${100001 + i}`
    const failed = i % 10 === 0
    units.push({
      serial,
      line: LINES[i % LINES.length],
      station: STATIONS[i % STATIONS.length],
      inspectedAt: start + Math.floor((i / total) * 30 * DAY_MS),
      result: failed ? 'fail' : 'pass',
      defectCount: failed ? 6 : 0,
      imageId: serial,
    })
    if (failed) {
      for (let j = 0; j < 6; j++) {
        defects.push({ serial, type: DEFECT_TYPES[(i + j) % DEFECT_TYPES.length], x1: 0, y1: 0, x2: 10, y2: 10 })
      }
    }
  }
  return { units: units.reverse(), defects }
}

/** Everything the dashboard recomputes when a filter changes. */
function dashboardUpdate({ units, defects }: LineData, filters: Filters) {
  const matching = filterUnits(units, defects, filters)
  filterDefects(defects, matching, filters)
  overallYield(matching)
  const trendUnits = filterUnits(units, defects, { ...filters, from: null, to: null, results: [], defectTypes: [] })
  const withoutTypes = { ...filters, defectTypes: [] }
  const paretoDefects = filterDefects(defects, filterUnits(units, defects, withoutTypes), withoutTypes)
  buildYieldOption(dailyYield(trendUnits), { selectedRange: dateRangeBounds(filters.from, filters.to) })
  buildParetoOption(defectTypePareto(paretoDefects, DEFECT_TYPES), { names: appConfig.defectTypes, noun: 'defects' })
}

function medianMs(run: () => void, repeats = 7): number {
  const times: number[] = []
  for (let i = 0; i < repeats; i++) {
    const start = performance.now()
    run()
    times.push(performance.now() - start)
  }
  return times.sort((a, b) => a - b)[Math.floor(repeats / 2)]
}

describe('filter performance', () => {
  const data = dataset(10_000)
  const filters: Filters = {
    ...EMPTY_FILTERS,
    lines: ['L1', 'L2'],
    stations: ['AOI-2'],
    defectTypes: ['short'],
    from: '2026-10-05',
    to: '2026-10-20',
  }

  it('recomputes the dashboard for 10,000 boards and 6,000 defects within the 100 ms budget', () => {
    expect(data.units).toHaveLength(10_000)
    expect(data.defects).toHaveLength(6_000)
    // Budget is the < 100 ms filter-update target; this covers the data work, not React or canvas rendering.
    const ms = medianMs(() => dashboardUpdate(data, filters))
    console.info(`dashboard update, 10k boards: ${ms.toFixed(1)} ms (median of 7)`)
    expect(ms).toBeLessThan(100)
  })
})
