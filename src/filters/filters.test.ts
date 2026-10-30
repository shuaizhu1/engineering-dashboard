import { describe, expect, it } from 'vitest'
import type { Flight, FlightEvent } from '../data/types'
import {
  EMPTY_FILTERS,
  applyFilters,
  filterEvents,
  filterFlights,
  hasActiveFilters,
  parseFilters,
  serializeFilters,
  type Filters,
} from './filters'

function flight(flightId: string, label: Flight['label'], startedAt: string | null): Flight {
  return {
    flightId,
    label,
    startedAt: startedAt === null ? null : Date.parse(startedAt),
    durationS: 60,
    swVersion: null,
    hardware: null,
    maxVibMs2: 1,
    minBatteryV: null,
    eventCount: 0,
  }
}

function event(flightId: string, type: FlightEvent['type'], startS = 0): FlightEvent {
  return { eventId: `${flightId}-${type}-${startS}`, flightId, type, startS, endS: startS + 1, peak: 1, unit: 'm/s²' }
}

const flights = [
  flight('a', 'vibration', '2026-10-01T10:00:00Z'),
  flight('b', 'good', '2026-10-15T23:59:00Z'),
  flight('c', 'component-failure', '2026-10-16T00:00:00Z'),
  flight('d', 'good', null),
]

const events = [event('a', 'vibration_high'), event('a', 'battery_sag', 5), event('c', 'vibration_spike')]

describe('parseFilters', () => {
  it('returns empty filters for an empty query string', () => {
    expect(parseFilters(new URLSearchParams())).toEqual(EMPTY_FILTERS)
  })

  it('reads lists and dates', () => {
    const filters = parseFilters(new URLSearchParams('label=good,vibration&event=battery_sag&from=2026-10-01&to=2026-10-15'))
    expect(filters).toEqual<Filters>({
      labels: ['vibration', 'good'],
      eventTypes: ['battery_sag'],
      from: '2026-10-01',
      to: '2026-10-15',
    })
  })

  it('drops unknown and repeated values', () => {
    const filters = parseFilters(new URLSearchParams('label=good,bogus,good&event=nope'))
    expect(filters.labels).toEqual(['good'])
    expect(filters.eventTypes).toEqual([])
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
    const params = serializeFilters({ ...EMPTY_FILTERS, labels: ['good', 'vibration'], to: '2026-10-31' })
    expect(params.toString()).toBe('label=vibration%2Cgood&to=2026-10-31')
  })

  it('round-trips through parseFilters', () => {
    const filters: Filters = {
      labels: ['component-failure'],
      eventTypes: ['vibration_high', 'vibration_spike'],
      from: '2026-07-01',
      to: '2026-10-31',
    }
    expect(parseFilters(serializeFilters(filters))).toEqual(filters)
  })
})

describe('applyFilters', () => {
  it('replaces filter keys and keeps other parameters', () => {
    const params = new URLSearchParams('mode=sift&label=good&from=2026-01-01')
    const next = applyFilters(params, { ...EMPTY_FILTERS, eventTypes: ['battery_sag'] })
    expect(next.toString()).toBe('mode=sift&event=battery_sag')
  })

  it('does not modify the input', () => {
    const params = new URLSearchParams('label=good')
    applyFilters(params, EMPTY_FILTERS)
    expect(params.toString()).toBe('label=good')
  })
})

describe('hasActiveFilters', () => {
  it('is false only for empty filters', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false)
    expect(hasActiveFilters({ ...EMPTY_FILTERS, to: '2026-10-01' })).toBe(true)
  })
})

describe('filterFlights', () => {
  const ids = (filters: Partial<Filters>) =>
    filterFlights(flights, events, { ...EMPTY_FILTERS, ...filters }).map((f) => f.flightId)

  it('returns every flight with no filters', () => {
    expect(ids({})).toEqual(['a', 'b', 'c', 'd'])
  })

  it('filters by label', () => {
    expect(ids({ labels: ['good'] })).toEqual(['b', 'd'])
  })

  it('keeps flights with at least one event of a selected type', () => {
    expect(ids({ eventTypes: ['battery_sag', 'vibration_spike'] })).toEqual(['a', 'c'])
  })

  it('treats the date range as inclusive whole UTC days', () => {
    expect(ids({ from: '2026-10-15', to: '2026-10-15' })).toEqual(['b'])
    expect(ids({ from: '2026-10-16' })).toEqual(['c'])
  })

  it('excludes flights without a start time when a date range is set', () => {
    expect(ids({ to: '2026-12-31' })).not.toContain('d')
  })

  it('combines filters', () => {
    expect(ids({ labels: ['vibration', 'good'], eventTypes: ['vibration_high'], to: '2026-10-10' })).toEqual(['a'])
  })
})

describe('filterEvents', () => {
  it('keeps events of the given flights', () => {
    const result = filterEvents(events, [flights[0]], EMPTY_FILTERS)
    expect(result.map((e) => e.type)).toEqual(['vibration_high', 'battery_sag'])
  })

  it('narrows to the selected event types', () => {
    const result = filterEvents(events, flights, { ...EMPTY_FILTERS, eventTypes: ['vibration_spike'] })
    expect(result.map((e) => e.flightId)).toEqual(['c'])
  })
})
