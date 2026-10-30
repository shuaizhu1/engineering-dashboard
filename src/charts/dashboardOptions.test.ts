import { describe, expect, it } from 'vitest'
import { appConfig } from '../config'
import type { DailyYield } from '../filters/aggregate'
import { buildParetoOption, buildYieldOption, yieldAxisMin } from './dashboardOptions'

const DAY_MS = 24 * 60 * 60 * 1000

function day(date: string, inspected: number, passed: number): DailyYield {
  return { day: Date.parse(`${date}T00:00:00Z`), inspected, passed, yieldPct: inspected ? (passed / inspected) * 100 : null }
}

describe('buildYieldOption', () => {
  const rows = [day('2026-10-01', 10, 9), day('2026-10-02', 10, 6), day('2026-10-03', 0, 0), day('2026-10-04', 20, 19)]
  const option = buildYieldOption(rows) as {
    aria: { description: string }
    dataset: { source: (number | null)[][] }
    yAxis: { min: number; max: number }
    series: { markLine?: { data: { yAxis: number }[] }; markArea?: { data: [{ xAxis: number }, { xAxis: number }][] } }[]
  }

  it('puts one point per day at midday, keeping empty days as gaps', () => {
    expect(option.dataset.source).toEqual([
      [Date.parse('2026-10-01T12:00:00Z'), 90, 10, 9],
      [Date.parse('2026-10-02T12:00:00Z'), 60, 10, 6],
      [Date.parse('2026-10-03T12:00:00Z'), null, 0, 0],
      [Date.parse('2026-10-04T12:00:00Z'), 95, 20, 19],
    ])
  })

  it('draws the overall yield across all boards as a reference line', () => {
    // 34 of 40 boards passed.
    expect(option.series[0].markLine?.data).toEqual([{ yAxis: 85 }])
  })

  it('names the overall yield and the worst day for screen readers', () => {
    expect(option.aria.description).toBe(
      'First-pass yield by day for 40 boards over 4 days, 85.0% overall. Lowest day 2026-10-02 at 60.0%.',
    )
  })

  it('selects date ranges by brushing along the time axis', () => {
    expect((option as unknown as { brush: object }).brush).toMatchObject({ brushType: 'lineX', xAxisIndex: 0 })
  })

  it('shades the selected range and fills an open end with the end of the last day', () => {
    const start = Date.parse('2026-10-02T00:00:00Z')
    const shaded = buildYieldOption(rows, { selectedRange: { start, end: null } }) as typeof option
    const [[a, b]] = shaded.series[0].markArea!.data
    expect([a.xAxis, b.xAxis]).toEqual([start, Date.parse('2026-10-04T00:00:00Z') + DAY_MS])
    expect(shaded.aria.description).toContain('Selected range 2026-10-02 to end.')
    expect(option.series[0]).not.toHaveProperty('markArea.data')
  })

  it('handles no boards with a message on the chart', () => {
    const empty = buildYieldOption([]) as { aria: { description: string }; graphic: { style: { text: string } }[] }
    expect(empty.graphic[0].style.text).toBe('No boards match these filters')
    expect(empty.aria.description).toBe('No boards match these filters.')
  })
})

describe('yieldAxisMin', () => {
  it('sits 5 points below the worst day, rounded down to a multiple of 5', () => {
    expect(yieldAxisMin([day('2026-10-01', 100, 82)])).toBe(75)
    expect(yieldAxisMin([day('2026-10-01', 100, 85)])).toBe(80)
  })

  it('never goes below 0 and ignores empty days', () => {
    expect(yieldAxisMin([day('2026-10-01', 10, 0), day('2026-10-02', 0, 0)])).toBe(0)
    expect(yieldAxisMin([])).toBe(0)
  })
})

describe('buildParetoOption', () => {
  const rows = [
    { key: 'short' as const, count: 3, cumulativePct: 60 },
    { key: 'open' as const, count: 2, cumulativePct: 100 },
    { key: 'spur' as const, count: 0, cumulativePct: 100 },
  ]
  const option = buildParetoOption(rows, { names: appConfig.defectTypes, noun: 'defects' }) as {
    aria: { description: string }
    dataset: { source: unknown[][] }
    series: { type: string; yAxisIndex?: number }[]
  }

  it('keeps the row order and uses display names', () => {
    expect(option.dataset.source).toEqual([
      ['short', 'Short', 3, 60],
      ['open', 'Open', 2, 100],
      ['spur', 'Spur', 0, 100],
    ])
  })

  it('plots bars and a cumulative line on the second axis', () => {
    expect(option.series.map((s) => s.type)).toEqual(['bar', 'line'])
    expect(option.series[1].yAxisIndex).toBe(1)
  })

  it('colors every bar when nothing is selected', () => {
    const color = (option.series[0] as unknown as { itemStyle: { color: (p: { data: unknown[] }) => string } }).itemStyle.color
    expect(color({ data: ['open'] })).toBe(color({ data: ['short'] }))
  })

  it('dims bars outside the selection and names the selection', () => {
    const filtered = buildParetoOption(rows, { names: appConfig.defectTypes, noun: 'defects', selected: ['open'] }) as {
      aria: { description: string }
      series: { itemStyle: { color: (p: { data: unknown[] }) => string } }[]
    }
    const color = filtered.series[0].itemStyle.color
    expect(color({ data: ['open'] })).not.toBe(color({ data: ['short'] }))
    expect(filtered.aria.description).toContain('Filtered to Open.')
  })

  it('says so on the chart when there are no defects', () => {
    const empty = buildParetoOption(
      rows.map((r) => ({ ...r, count: 0, cumulativePct: 0 })),
      { names: appConfig.defectTypes, noun: 'defects' },
    ) as { graphic: { style: { text: string } }[] }
    expect(empty.graphic[0].style.text).toBe('No defects match these filters')
    expect((option as unknown as { graphic: unknown[] }).graphic).toEqual([])
  })

  it('lists the counts for screen readers', () => {
    expect(option.aria.description).toBe('5 defects by type: Short 3, Open 2, Spur 0.')
  })
})
