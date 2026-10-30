import { describe, expect, it } from 'vitest'
import type { Unit } from '../data/types'
import { stationHistory } from './history'

function unit(serial: string, line: Unit['line'], station: Unit['station'], hour: number): Unit {
  return {
    serial,
    line,
    station,
    inspectedAt: Date.UTC(2026, 9, 14, hour),
    result: 'pass',
    defectCount: 0,
    imageId: serial,
  }
}

const units = [
  unit('e', 'L2', 'AOI-2', 9),
  unit('d', 'L2', 'AOI-1', 8),
  unit('c', 'L2', 'AOI-2', 7),
  unit('b', 'L1', 'AOI-2', 6),
  unit('a', 'L2', 'AOI-2', 5),
]

describe('stationHistory', () => {
  it('keeps the same line and station up to the board, oldest first', () => {
    expect(stationHistory(units, units[2]).map((u) => u.serial)).toEqual(['a', 'c'])
    expect(stationHistory(units, units[0]).map((u) => u.serial)).toEqual(['a', 'c', 'e'])
  })

  it('keeps only the most recent boards', () => {
    expect(stationHistory(units, units[0], 2).map((u) => u.serial)).toEqual(['c', 'e'])
  })
})
