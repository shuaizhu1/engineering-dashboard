import { describe, expect, it } from 'vitest'
import { TELEMETRY_CHANNELS, type FlightEvent, type FlightTelemetry, type TelemetryChannel } from '../data/types'
import { siftMode } from '../modes/sift'
import { buildSyncedChannelsOption, panelsWithData, syncedChartHeight, toDatasetRows, type ChannelPanel } from './telemetryOption'

function telemetry(values: Partial<Record<TelemetryChannel, number[]>>, n = 4): FlightTelemetry {
  const empty = () => new Float32Array(n).fill(Number.NaN)
  const channels = Object.fromEntries(
    TELEMETRY_CHANNELS.map((k) => [k, values[k] ? new Float32Array(values[k]) : empty()]),
  ) as Record<TelemetryChannel, Float32Array>
  return { tS: new Float32Array(Array.from({ length: n }, (_, i) => i * 100)), channels }
}

function event(type: FlightEvent['type'], startS: number, endS: number): FlightEvent {
  return { eventId: `${type}-${startS}`, flightId: 'f', type, startS, endS, peak: 1, unit: 'm/s²' }
}

const panels: ChannelPanel[] = [
  { title: 'Vibration', unit: 'm/s²', series: [{ key: 'vib_ms2', name: 'Vibration' }], eventTypes: ['vibration_high'] },
  { title: 'Battery', unit: 'V', series: [{ key: 'battery_v', name: 'Voltage' }], eventTypes: ['battery_sag'] },
  {
    title: 'Attitude',
    unit: '°',
    series: [
      { key: 'roll_deg', name: 'Roll' },
      { key: 'pitch_deg', name: 'Pitch' },
    ],
    eventTypes: [],
  },
]

const config = { panels, eventNames: siftMode.eventTypes, seriesColors: ['#111', '#222'] }

type Option = {
  aria: { description: string }
  legend?: { data: string[] }
  dataset: { dimensions: string[]; source: (number | null)[][] }
  grid: { top: number }[]
  dataZoom: { xAxisIndex: number[]; startValue?: number; endValue?: number }[]
  series: { name: string; xAxisIndex: number; markArea?: { data: [{ xAxis: number }, { xAxis: number }][] } }[]
}

describe('toDatasetRows', () => {
  it('puts time first and turns NaN into null', () => {
    expect(toDatasetRows([0, 0.1], [new Float32Array([1.23456, Number.NaN])])).toEqual([
      [0, 1.235],
      [0.1, null],
    ])
  })
})

describe('panelsWithData', () => {
  it('drops channels and panels without data', () => {
    const t = telemetry({ vib_ms2: [1, 2, 3, 4], roll_deg: [0, 1, 0, 1] })
    expect(panelsWithData(t, panels).map((p) => [p.title, p.series.map((s) => s.key)])).toEqual([
      ['Vibration', ['vib_ms2']],
      ['Attitude', ['roll_deg']],
    ])
  })
})

describe('buildSyncedChannelsOption', () => {
  const t = telemetry({
    vib_ms2: [1, 2, 3, 4],
    battery_v: [16, 15.5, 15, 14.8],
    roll_deg: [0, 1, 0, 1],
    pitch_deg: [1, 0, 1, 0],
  })
  const events = [event('vibration_high', 100, 110), event('battery_sag', 200, 201)]
  const option = buildSyncedChannelsOption(t, events, config) as Option

  it('stacks one grid per panel and drives them all with one zoom', () => {
    expect(option.grid).toHaveLength(3)
    expect(option.grid[1].top).toBeGreaterThan(option.grid[0].top)
    expect(option.dataZoom.every((z) => z.xAxisIndex.join() === '0,1,2')).toBe(true)
  })

  it('puts every channel in one dataset', () => {
    expect(option.dataset.dimensions).toEqual(['t', 'vib_ms2', 'battery_v', 'roll_deg', 'pitch_deg'])
    expect(option.dataset.source[1]).toEqual([100, 2, 15.5, 1, 0])
  })

  it('shades each event type on its own panel', () => {
    const shades = option.series.map((s) => s.markArea?.data.map(([a]) => a.xAxis) ?? null)
    expect(shades).toEqual([[100], [200], [], null])
  })

  it('adds a legend only for panels with several channels', () => {
    expect(option.legend?.data).toEqual(['Roll', 'Pitch'])
  })

  it('opens zoomed to the focused event and shades it on every panel', () => {
    const focused = buildSyncedChannelsOption(t, events, { ...config, focus: events[1] }) as Option
    expect(focused.dataZoom[0]).toMatchObject({ startValue: 190, endValue: 211 })
    expect(focused.series.filter((s) => s.markArea).every((s) => s.markArea!.data.some(([a]) => a.xAxis === 200))).toBe(true)
    expect(focused.aria.description).toContain('Zoomed to Battery sag at 200.0–201.0 s.')
  })

  it('shows the whole flight without a focus', () => {
    expect(option.dataZoom[0].startValue).toBeUndefined()
  })
})

describe('syncedChartHeight', () => {
  it('grows with the number of panels', () => {
    expect(syncedChartHeight(3)).toBeGreaterThan(syncedChartHeight(2))
  })
})
