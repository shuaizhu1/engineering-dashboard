import { describe, expect, it } from 'vitest'
import type { FlightEvent } from '../data/types'
import { buildChannelOption, toDatasetRows } from './telemetryOption'

function event(type: FlightEvent['type'], startS: number, endS: number): FlightEvent {
  return { eventId: `${type}-${startS}`, flightId: 'f', type, startS, endS, peak: 1, unit: 'm/s²' }
}

const series = {
  tS: new Float32Array([0, 0.1, 0.2, 0.3]),
  values: new Float32Array([1.23456, Number.NaN, 2, 3]),
}

const config = { name: 'Vibration', unit: 'm/s²', eventTypes: ['vibration_high', 'vibration_spike'] as const }

describe('toDatasetRows', () => {
  it('pairs time and value, rounding float32 noise', () => {
    expect(toDatasetRows(series)[0]).toEqual([0, 1.235])
    expect(toDatasetRows(series)[1][0]).toBe(0.1)
  })

  it('turns NaN into null so the line has a gap', () => {
    expect(toDatasetRows(series)[1]).toEqual([0.1, null])
  })

  it('stops at the shorter column', () => {
    expect(toDatasetRows({ tS: [0, 1, 2], values: [5] })).toEqual([[0, 5]])
  })
})

describe('buildChannelOption', () => {
  const events = [event('vibration_high', 10, 20), event('battery_sag', 12, 13), event('vibration_spike', 30, 31)]
  const option = buildChannelOption(series, events, { ...config, eventTypes: [...config.eventTypes] }) as {
    aria: { enabled: boolean; description: string }
    dataset: { source: unknown[] }
    yAxis: { name: string }
    series: { sampling: string; markArea: { data: [{ xAxis: number; name: string }, { xAxis: number }][] } }[]
  }

  it('uses the dataset rows as the source', () => {
    expect(option.dataset.source).toHaveLength(4)
  })

  it('shades only the configured event types', () => {
    expect(option.series[0].markArea.data).toEqual([
      [{ xAxis: 10, name: 'vibration_high' }, { xAxis: 20 }],
      [{ xAxis: 30, name: 'vibration_spike' }, { xAxis: 31 }],
    ])
  })

  it('downsamples with LTTB', () => {
    expect(option.series[0].sampling).toBe('lttb')
  })

  it('labels the axis with the unit and describes the chart for screen readers', () => {
    expect(option.yAxis.name).toBe('Vibration (m/s²)')
    expect(option.aria.enabled).toBe(true)
    expect(option.aria.description).toContain('2 highlighted events')
  })
})
