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
    dataZoom: { startValue?: number }[]
  }

  it('creates one series per label present, sorted by start time', () => {
    expect(option.series.map((s) => s.name)).toEqual(['Vibration', 'Good'])
    expect(option.series[0].data.map((d) => d[2])).toEqual(['a', 'c'])
  })

  it('leaves out flights without a start time and says so', () => {
    expect(option.series.flatMap((s) => s.data).map((d) => d[2])).not.toContain('d')
    expect(option.aria.description).toContain('1 flights without a start time')
  })

  it('draws a median reference line once, from the flights shown', () => {
    // Dated flights have max vibration 9, 1 and 7; the undated one is left out.
    expect(option.series[0].markLine?.data).toEqual([{ yAxis: 7 }])
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

  it('handles no flights with a message on the chart', () => {
    const empty = buildVibrationTrendOption([], trendConfig) as { series: unknown[]; graphic: { style: { text: string } }[] }
    expect(empty.series).toEqual([])
    expect(empty.graphic[0].style.text).toBe('No flights with a start time match these filters')
  })

  it('uses a log axis and clamps zero so every flight can be placed', () => {
    const zero = buildVibrationTrendOption([flight('z', 'good', '2026-10-01T00:00:00Z', 0)], trendConfig) as {
      yAxis: { type: string }
      series: { data: [number, number, string][] }[]
    }
    expect(zero.yAxis.type).toBe('log')
    expect(zero.series[0].data[0][1]).toBeGreaterThan(0)
  })

  it('opens on the most recent year when flights span several years', () => {
    const spread = buildVibrationTrendOption(
      [flight('old', 'good', '2021-06-01T00:00:00Z', 1), flight('new', 'good', '2026-10-01T00:00:00Z', 1)],
      trendConfig,
    ) as { dataZoom: { startValue?: number }[] }
    expect(spread.dataZoom[0].startValue).toBe(Date.parse('2026-10-01T00:00:00Z') - 365 * 24 * 60 * 60 * 1000)
    expect(option.dataZoom[0].startValue).toBeUndefined()
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

  it('says so on the chart when there are no events', () => {
    const empty = buildParetoOption(
      rows.map((r) => ({ ...r, count: 0, cumulativePct: 0 })),
      { names: siftMode.eventTypes, noun: 'events' },
    ) as { graphic: { style: { text: string } }[] }
    expect(empty.graphic[0].style.text).toBe('No events match these filters')
    expect((option as unknown as { graphic: unknown[] }).graphic).toEqual([])
  })

  it('lists the counts for screen readers', () => {
    expect(option.aria.description).toBe('5 events by type: Sustained vibration 3, Battery sag 2, Vibration spike 0.')
  })
})
