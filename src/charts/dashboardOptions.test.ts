import { describe, expect, it } from 'vitest'
import type { Flight } from '../data/types'
import { siftMode } from '../modes/sift'
import { buildParetoOption, buildVibrationTrendOption } from './dashboardOptions'

function flight(flightId: string, label: Flight['label'], startedAt: string | null, maxVibMs2: number): Flight {
  return {
    flightId,
    label,
    startedAt: startedAt === null ? null : Date.parse(startedAt),
    durationS: 60,
    airborneS: 60,
    swVersion: null,
    hardware: null,
    maxVibMs2,
    minBatteryV: null,
    eventCount: 0,
  }
}

const trendConfig = {
  labels: siftMode.labels,
  labelColors: siftMode.labelColors,
  thresholdMs2: siftMode.vibrationThresholdMs2,
}

describe('buildVibrationTrendOption', () => {
  const flights = [
    flight('b', 'good', '2026-10-02T00:00:00Z', 1),
    flight('a', 'vibration', '2026-10-01T00:00:00Z', 9),
    flight('c', 'vibration', '2026-10-03T00:00:00Z', 7),
    flight('d', 'good', null, 0.5),
  ]
  const option = buildVibrationTrendOption(flights, trendConfig) as {
    aria: { description: string }
    series: { name: string; data: [number, number, string][]; markLine?: { data: { yAxis: number }[] } }[]
  }

  it('creates one series per label present, sorted by start time', () => {
    expect(option.series.map((s) => s.name)).toEqual(['Vibration', 'Good'])
    expect(option.series[0].data.map((d) => d[2])).toEqual(['a', 'c'])
  })

  it('leaves out flights without a start time and says so', () => {
    expect(option.series.flatMap((s) => s.data).map((d) => d[2])).not.toContain('d')
    expect(option.aria.description).toContain('1 flights without a start time')
  })

  it('draws the vibration threshold once', () => {
    expect(option.series[0].markLine?.data).toEqual([{ yAxis: 4 }])
    expect(option.series[1].markLine).toBeUndefined()
  })

  it('selects date ranges by brushing along the time axis', () => {
    const brush = (buildVibrationTrendOption(flights, trendConfig) as { brush: { brushType: string; xAxisIndex: number } }).brush
    expect(brush).toMatchObject({ brushType: 'lineX', xAxisIndex: 0 })
  })

  it('shades the selected range and fills an open end from the data', () => {
    const start = Date.parse('2026-10-02T00:00:00Z')
    const shaded = buildVibrationTrendOption(flights, { ...trendConfig, selectedRange: { start, end: null } }) as {
      aria: { description: string }
      series: { markArea?: { data: [{ xAxis: number }, { xAxis: number }][] } }[]
    }
    const [[a, b]] = shaded.series[0].markArea!.data
    expect([a.xAxis, b.xAxis]).toEqual([start, Date.parse('2026-10-03T00:00:00Z')])
    expect(shaded.aria.description).toContain('Selected range 2026-10-02 to end.')
  })

  it('draws no shade without a selected range', () => {
    expect(option.series[0]).not.toHaveProperty('markArea.data')
  })

  it('handles no flights', () => {
    const empty = buildVibrationTrendOption([], trendConfig) as { series: unknown[] }
    expect(empty.series).toEqual([])
  })
})

describe('buildParetoOption', () => {
  const rows = [
    { key: 'vibration_high' as const, count: 3, cumulativePct: 60 },
    { key: 'battery_sag' as const, count: 2, cumulativePct: 100 },
    { key: 'vibration_spike' as const, count: 0, cumulativePct: 100 },
  ]
  const option = buildParetoOption(rows, { names: siftMode.eventTypes, noun: 'events' }) as {
    aria: { description: string }
    dataset: { source: unknown[][] }
    series: { type: string; yAxisIndex?: number }[]
  }

  it('keeps the row order and uses display names', () => {
    expect(option.dataset.source).toEqual([
      ['vibration_high', 'Sustained vibration', 3, 60],
      ['battery_sag', 'Battery sag', 2, 100],
      ['vibration_spike', 'Vibration spike', 0, 100],
    ])
  })

  it('plots bars and a cumulative line on the second axis', () => {
    expect(option.series.map((s) => s.type)).toEqual(['bar', 'line'])
    expect(option.series[1].yAxisIndex).toBe(1)
  })

  it('colors every bar when nothing is selected', () => {
    const color = (option.series[0] as unknown as { itemStyle: { color: (p: { data: unknown[] }) => string } }).itemStyle.color
    expect(color({ data: ['battery_sag'] })).toBe(color({ data: ['vibration_high'] }))
  })

  it('dims bars outside the selection and names the selection', () => {
    const filtered = buildParetoOption(rows, { names: siftMode.eventTypes, noun: 'events', selected: ['battery_sag'] }) as {
      aria: { description: string }
      series: { itemStyle: { color: (p: { data: unknown[] }) => string } }[]
    }
    const color = filtered.series[0].itemStyle.color
    expect(color({ data: ['battery_sag'] })).not.toBe(color({ data: ['vibration_high'] }))
    expect(filtered.aria.description).toContain('Filtered to Battery sag.')
  })

  it('lists the counts for screen readers', () => {
    expect(option.aria.description).toBe('5 events by type: Sustained vibration 3, Battery sag 2, Vibration spike 0.')
  })
})
