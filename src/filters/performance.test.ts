import { describe, expect, it } from 'vitest'
import { buildParetoOption, buildVibrationTrendOption } from '../charts/dashboardOptions'
import { addStressFlights } from '../data/stress'
import { EVENT_TYPES, FLIGHT_LABELS, type Flight, type FlightEvent, type SiftData } from '../data/types'
import { siftMode } from '../modes/sift'
import { eventTypePareto } from './aggregate'
import { EMPTY_FILTERS, dateRangeBounds, filterEvents, filterFlights, type Filters } from './filters'

/** 20 base flights with 5 events each, scaled to `total` flights like `?stress=N`. */
function dataset(total: number): SiftData {
  const flights: Flight[] = []
  const events: FlightEvent[] = []
  for (let i = 0; i < 20; i++) {
    const flightId = `flight-${i}`
    flights.push({
      flightId,
      label: FLIGHT_LABELS[i % FLIGHT_LABELS.length],
      startedAt: Date.UTC(2026, 0, 1 + i * 10),
      durationS: 300,
      airborneS: 280,
      swVersion: null,
      hardware: null,
      maxVibMs2: 1 + i,
      minBatteryV: 14,
      eventCount: 5,
    })
    for (let j = 0; j < 5; j++) {
      events.push({
        eventId: `${flightId}-${j}`,
        flightId,
        type: EVENT_TYPES[(i + j) % EVENT_TYPES.length],
        startS: j * 10,
        endS: j * 10 + 2,
        peak: 1,
        unit: 'm/s²',
      })
    }
  }
  return addStressFlights({ flights, events, syntheticCount: 0 }, total - flights.length)
}

/** Everything the dashboard recomputes when a filter changes. */
function dashboardUpdate(data: SiftData, filters: Filters) {
  const matching = filterFlights(data.flights, data.events, filters)
  filterEvents(data.events, matching, filters)
  const trendFlights = filterFlights(data.flights, data.events, { ...filters, from: null, to: null })
  const withoutTypes = { ...filters, eventTypes: [] }
  const paretoEvents = filterEvents(data.events, filterFlights(data.flights, data.events, withoutTypes), withoutTypes)
  buildVibrationTrendOption(trendFlights, {
    labels: siftMode.labels,
    labelColors: siftMode.labelColors,
    thresholdMs2: siftMode.vibrationThresholdMs2,
    selectedRange: dateRangeBounds(filters.from, filters.to),
  })
  buildParetoOption(eventTypePareto(paretoEvents, EVENT_TYPES), { names: siftMode.eventTypes, noun: 'events' })
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
    labels: ['vibration', 'sensor-error'],
    eventTypes: ['vibration_spike'],
    from: '2026-03-01',
    to: '2026-09-30',
  }

  it('recomputes the dashboard for 10,000 flights and 50,000 events within the 100 ms budget', () => {
    expect(data.flights).toHaveLength(10_000)
    expect(data.events).toHaveLength(50_000)
    // Budget is the < 100 ms filter-update target; this covers the data work, not React or canvas rendering.
    const ms = medianMs(() => dashboardUpdate(data, filters))
    console.info(`dashboard update, 10k flights: ${ms.toFixed(1)} ms (median of 7)`)
    expect(ms).toBeLessThan(100)
  })
})
