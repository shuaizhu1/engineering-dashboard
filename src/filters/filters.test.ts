import { describe, expect, it } from 'vitest'
import type { Defect, Unit } from '../data/types'
import {
  EMPTY_FILTERS,
  applyFilters,
  dateRangeBounds,
  dateRangeFromTimes,
  filterDefects,
  filterUnits,
  hasActiveFilters,
  parseFilters,
  serializeFilters,
  toggleValue,
  type Filters,
} from './filters'

function unit(serial: string, line: Unit['line'], station: Unit['station'], result: Unit['result'], inspectedAt: string): Unit {
  return { serial, line, station, inspectedAt: Date.parse(inspectedAt), result, defectCount: 0, imageId: serial }
}

function defect(serial: string, type: Defect['type']): Defect {
  return { serial, type, x1: 0, y1: 0, x2: 10, y2: 10 }
}

const units = [
  unit('a', 'L1', 'AOI-1', 'fail', '2026-10-01T10:00:00Z'),
  unit('b', 'L2', 'AOI-2', 'pass', '2026-10-15T23:59:00Z'),
  unit('c', 'L2', 'AOI-1', 'fail', '2026-10-16T00:00:00Z'),
  unit('d', 'L3', 'AOI-2', 'pass', '2026-10-20T08:00:00Z'),
]

const defects = [defect('a', 'open'), defect('a', 'short'), defect('c', 'spur')]

describe('parseFilters', () => {
  it('returns empty filters for an empty query string', () => {
    expect(parseFilters(new URLSearchParams())).toEqual(EMPTY_FILTERS)
  })

  it('reads lists and dates', () => {
    const filters = parseFilters(
      new URLSearchParams('line=L3,L1&station=AOI-2&result=fail&defect=short&from=2026-10-01&to=2026-10-15'),
    )
    expect(filters).toEqual<Filters>({
      lines: ['L1', 'L3'],
      stations: ['AOI-2'],
      results: ['fail'],
      defectTypes: ['short'],
      from: '2026-10-01',
      to: '2026-10-15',
    })
  })

  it('drops unknown and repeated values', () => {
    const filters = parseFilters(new URLSearchParams('line=L2,L9,L2&defect=nope'))
    expect(filters.lines).toEqual(['L2'])
    expect(filters.defectTypes).toEqual([])
  })

  it('ignores malformed and impossible dates', () => {
    const filters = parseFilters(new URLSearchParams('from=2026-02-30&to=yesterday'))
    expect(filters.from).toBeNull()
    expect(filters.to).toBeNull()
  })

  it('swaps a reversed date range', () => {
    const filters = parseFilters(new URLSearchParams('from=2026-10-20&to=2026-10-01'))
    expect([filters.from, filters.to]).toEqual(['2026-10-01', '2026-10-20'])
  })
})

describe('serializeFilters', () => {
  it('omits empty values', () => {
    expect(serializeFilters(EMPTY_FILTERS).toString()).toBe('')
  })

  it('writes values in canonical order', () => {
    const params = serializeFilters({ ...EMPTY_FILTERS, defectTypes: ['spur', 'open'], to: '2026-10-31' })
    expect(params.toString()).toBe('defect=open%2Cspur&to=2026-10-31')
  })

  it('round-trips through parseFilters', () => {
    const filters: Filters = {
      lines: ['L2'],
      stations: ['AOI-1', 'AOI-2'],
      results: ['pass'],
      defectTypes: ['mousebite', 'pin-hole'],
      from: '2026-10-01',
      to: '2026-10-31',
    }
    expect(parseFilters(serializeFilters(filters))).toEqual(filters)
  })
})

describe('applyFilters', () => {
  it('replaces filter keys and keeps other parameters', () => {
    const params = new URLSearchParams('view=table&line=L1&from=2026-01-01')
    const next = applyFilters(params, { ...EMPTY_FILTERS, defectTypes: ['short'] })
    expect(next.toString()).toBe('view=table&defect=short')
  })

  it('does not modify the input', () => {
    const params = new URLSearchParams('line=L1')
    applyFilters(params, EMPTY_FILTERS)
    expect(params.toString()).toBe('line=L1')
  })
})

describe('hasActiveFilters', () => {
  it('is false only for empty filters', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false)
    expect(hasActiveFilters({ ...EMPTY_FILTERS, to: '2026-10-01' })).toBe(true)
    expect(hasActiveFilters({ ...EMPTY_FILTERS, stations: ['AOI-1'] })).toBe(true)
  })
})

describe('filterUnits', () => {
  const serials = (filters: Partial<Filters>) =>
    filterUnits(units, defects, { ...EMPTY_FILTERS, ...filters }).map((u) => u.serial)

  it('returns every board with no filters', () => {
    expect(serials({})).toEqual(['a', 'b', 'c', 'd'])
  })

  it('filters by line, station and result', () => {
    expect(serials({ lines: ['L2'] })).toEqual(['b', 'c'])
    expect(serials({ stations: ['AOI-2'] })).toEqual(['b', 'd'])
    expect(serials({ results: ['fail'] })).toEqual(['a', 'c'])
  })

  it('keeps boards with at least one defect of a selected type', () => {
    expect(serials({ defectTypes: ['short', 'spur'] })).toEqual(['a', 'c'])
  })

  it('treats the date range as inclusive whole UTC days', () => {
    expect(serials({ from: '2026-10-15', to: '2026-10-15' })).toEqual(['b'])
    expect(serials({ from: '2026-10-16' })).toEqual(['c', 'd'])
  })

  it('combines filters', () => {
    expect(serials({ lines: ['L1', 'L2'], defectTypes: ['open', 'spur'], to: '2026-10-10' })).toEqual(['a'])
  })
})

describe('filterDefects', () => {
  it('keeps defects of the given boards', () => {
    expect(filterDefects(defects, [units[0]], EMPTY_FILTERS).map((d) => d.type)).toEqual(['open', 'short'])
  })

  it('narrows to the selected defect types', () => {
    const result = filterDefects(defects, units, { ...EMPTY_FILTERS, defectTypes: ['spur'] })
    expect(result.map((d) => d.serial)).toEqual(['c'])
  })
})

describe('toggleValue', () => {
  const order = ['a', 'b', 'c'] as const

  it('adds a missing value in canonical order', () => {
    expect(toggleValue(['c'], 'a', order)).toEqual(['a', 'c'])
  })

  it('removes a present value', () => {
    expect(toggleValue(['a', 'c'], 'c', order)).toEqual(['a'])
  })
})

describe('dateRangeFromTimes', () => {
  it('covers whole UTC days', () => {
    expect(dateRangeFromTimes(Date.parse('2026-10-01T23:00:00Z'), Date.parse('2026-10-03T00:30:00Z'))).toEqual({
      from: '2026-10-01',
      to: '2026-10-03',
    })
  })

  it('accepts a reversed span', () => {
    expect(dateRangeFromTimes(Date.parse('2026-10-05T00:00:00Z'), Date.parse('2026-10-02T00:00:00Z'))).toEqual({
      from: '2026-10-02',
      to: '2026-10-05',
    })
  })
})

describe('dateRangeBounds', () => {
  it('ends at the start of the day after `to`', () => {
    expect(dateRangeBounds('2026-10-01', '2026-10-01')).toEqual({
      start: Date.parse('2026-10-01T00:00:00Z'),
      end: Date.parse('2026-10-02T00:00:00Z'),
    })
  })

  it('leaves open ends as null', () => {
    expect(dateRangeBounds(null, null)).toEqual({ start: null, end: null })
  })
})
