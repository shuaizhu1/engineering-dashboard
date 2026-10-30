import { describe, expect, it } from 'vitest'
import { addStressFlights, isSynthetic, parseStressCount, shortFlightId, sourceFlightId } from './stress'
import type { Flight, FlightEvent, SiftData } from './types'

function flight(flightId: string, startedAt: number | null): Flight {
  return {
    flightId,
    label: 'vibration',
    startedAt,
    durationS: 100,
    airborneS: 90,
    swVersion: null,
    hardware: null,
    maxVibMs2: 10,
    minBatteryV: null,
    eventCount: 1,
  }
}

const event: FlightEvent = { eventId: 'a-000', flightId: 'a', type: 'vibration_spike', startS: 1, endS: 2, peak: 5, unit: 'm/s²' }

const data: SiftData = {
  flights: [flight('a', Date.UTC(2026, 9, 1)), flight('b', null)],
  events: [event],
  syntheticCount: 0,
}

describe('parseStressCount', () => {
  it('reads a positive count and caps it', () => {
    expect(parseStressCount(new URLSearchParams('stress=5000'))).toBe(5000)
    expect(parseStressCount(new URLSearchParams('stress=999999'))).toBe(50_000)
  })

  it('ignores missing or invalid values', () => {
    expect(parseStressCount(new URLSearchParams())).toBe(0)
    expect(parseStressCount(new URLSearchParams('stress=lots'))).toBe(0)
    expect(parseStressCount(new URLSearchParams('stress=-3'))).toBe(0)
  })
})

describe('addStressFlights', () => {
  const stressed = addStressFlights(data, 5)

  it('adds the requested number of flights and records it', () => {
    expect(stressed.flights).toHaveLength(7)
    expect(stressed.syntheticCount).toBe(5)
  })

  it('clones events with the synthetic flight', () => {
    const clonesOfA = stressed.flights.filter((f) => isSynthetic(f.flightId) && sourceFlightId(f.flightId) === 'a')
    expect(clonesOfA).toHaveLength(3)
    expect(stressed.events.filter((e) => e.flightId === clonesOfA[0].flightId)).toHaveLength(1)
  })

  it('gives every synthetic flight a start time within the year before the newest real one', () => {
    const newest = Date.UTC(2026, 9, 1)
    for (const f of stressed.flights.filter((f) => isSynthetic(f.flightId))) {
      expect(f.startedAt).toBeLessThanOrEqual(newest)
      expect(f.startedAt).toBeGreaterThan(newest - 366 * 24 * 60 * 60 * 1000)
    }
  })

  it('is deterministic', () => {
    expect(addStressFlights(data, 5)).toEqual(stressed)
  })

  it('returns the data unchanged for zero', () => {
    expect(addStressFlights(data, 0)).toBe(data)
  })
})

describe('sourceFlightId', () => {
  it('maps a synthetic id back to its real flight', () => {
    expect(sourceFlightId('abc~s12')).toBe('abc')
    expect(sourceFlightId('abc')).toBe('abc')
  })
})

describe('shortFlightId', () => {
  it('keeps the clone number for synthetic flights', () => {
    expect(shortFlightId('8d51bf1d-d461-415b~s12')).toBe('8d51bf1d~s12')
    expect(shortFlightId('8d51bf1d-d461-415b')).toBe('8d51bf1d')
  })
})
