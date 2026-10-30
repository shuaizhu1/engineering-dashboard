import { describe, expect, it } from 'vitest'
import { toEvent, toFlight } from './sift'

describe('toFlight', () => {
  it('maps a hyparquet row, converting Date and BigInt values', () => {
    expect(
      toFlight({
        flight_id: 'abc',
        label: 'vibration',
        started_at: new Date('2026-10-19T09:18:16.493Z'),
        duration_s: 715.9,
        airborne_s: 565.9,
        sw_version: 'v1.16.0',
        hardware: 'PX4_FMU_V5',
        max_vib_ms2: 4.4,
        min_battery_v: 14.1,
        event_count: 3n,
      }),
    ).toEqual({
      flightId: 'abc',
      label: 'vibration',
      startedAt: Date.parse('2026-10-19T09:18:16.493Z'),
      durationS: 715.9,
      airborneS: 565.9,
      swVersion: 'v1.16.0',
      hardware: 'PX4_FMU_V5',
      maxVibMs2: 4.4,
      minBatteryV: 14.1,
      eventCount: 3,
    })
  })

  it('keeps missing values as null', () => {
    const flight = toFlight({
      flight_id: 'abc',
      label: 'good',
      started_at: null,
      duration_s: 1,
      airborne_s: 1,
      sw_version: null,
      hardware: null,
      max_vib_ms2: 1,
      min_battery_v: null,
      event_count: 0n,
    })
    expect([flight.startedAt, flight.swVersion, flight.hardware, flight.minBatteryV]).toEqual([null, null, null, null])
  })
})

describe('toEvent', () => {
  it('maps snake_case columns to an event', () => {
    expect(
      toEvent({ event_id: 'e1', flight_id: 'abc', type: 'battery_sag', start_s: 1, end_s: 2, peak: 2.1, unit: '%' }),
    ).toEqual({ eventId: 'e1', flightId: 'abc', type: 'battery_sag', startS: 1, endS: 2, peak: 2.1, unit: '%' })
  })
})
