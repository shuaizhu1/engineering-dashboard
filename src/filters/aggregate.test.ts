import { describe, expect, it } from 'vitest'
import type { Unit } from '../data/types'
import { dailyYield, overallYield, paretoCounts } from './aggregate'

const keys = ['a', 'b', 'c'] as const

describe('paretoCounts', () => {
  it('sorts by count, highest first, with a running percentage', () => {
    expect(paretoCounts(['b', 'a', 'b', 'b'], keys)).toEqual([
      { key: 'b', count: 3, cumulativePct: 75 },
      { key: 'a', count: 1, cumulativePct: 100 },
      { key: 'c', count: 0, cumulativePct: 100 },
    ])
  })

  it('breaks ties in key order', () => {
    expect(paretoCounts(['c', 'a'], keys).map((r) => r.key)).toEqual(['a', 'c', 'b'])
  })

  it('keeps every key with zero percent when there is nothing to count', () => {
    expect(paretoCounts([], keys)).toEqual([
      { key: 'a', count: 0, cumulativePct: 0 },
      { key: 'b', count: 0, cumulativePct: 0 },
      { key: 'c', count: 0, cumulativePct: 0 },
    ])
  })

  it('ignores values outside the key list', () => {
    expect(paretoCounts(['a', 'z' as 'a'], keys)[0]).toEqual({ key: 'a', count: 1, cumulativePct: 100 })
  })
})

function unit(serial: string, inspectedAt: string, result: Unit['result']): Unit {
  return { serial, line: 'L1', station: 'AOI-1', inspectedAt: Date.parse(inspectedAt), result, defectCount: 0, imageId: 'x' }
}

describe('dailyYield', () => {
  it('groups boards by UTC day, oldest first', () => {
    const rows = dailyYield([
      unit('a', '2026-10-06T23:59:00Z', 'fail'),
      unit('b', '2026-10-05T06:00:00Z', 'pass'),
      unit('c', '2026-10-06T00:00:00Z', 'pass'),
      unit('d', '2026-10-06T12:00:00Z', 'pass'),
    ])
    expect(rows).toEqual([
      { day: Date.parse('2026-10-05T00:00:00Z'), inspected: 1, passed: 1, yieldPct: 100 },
      { day: Date.parse('2026-10-06T00:00:00Z'), inspected: 3, passed: 2, yieldPct: (2 / 3) * 100 },
    ])
  })

  it('fills days without boards with a null yield', () => {
    const rows = dailyYield([unit('a', '2026-10-05T10:00:00Z', 'pass'), unit('b', '2026-10-07T10:00:00Z', 'fail')])
    expect(rows.map((r) => r.yieldPct)).toEqual([100, null, 0])
    expect(rows[1]).toMatchObject({ day: Date.parse('2026-10-06T00:00:00Z'), inspected: 0, passed: 0 })
  })

  it('returns no rows for no boards', () => {
    expect(dailyYield([])).toEqual([])
  })
})

describe('overallYield', () => {
  it('is the pass share across all boards', () => {
    expect(overallYield([unit('a', '2026-10-05T00:00:00Z', 'pass'), unit('b', '2026-10-05T00:00:00Z', 'fail')])).toBe(50)
    expect(overallYield([])).toBeNull()
  })
})
