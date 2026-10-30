import type { EChartsCoreOption } from 'echarts/core'
import type { DailyYield, ParetoRow } from '../filters/aggregate'
import { DEFAULT_CHART_COLORS, type ChartColors } from './chartTheme'

export interface YieldConfig {
  /** Active date filter as epoch-ms bounds (end exclusive); shaded on the chart. */
  selectedRange?: { start: number | null; end: number | null }
  colors?: ChartColors
}

/** Id of the brush component, for dispatching brush actions. */
export const TREND_BRUSH_ID = 'dateBrush'

const DATE_ONLY = (time: number) => new Date(time).toISOString().slice(0, 10)
const DAY_MS = 24 * 60 * 60 * 1000

/** Centered message drawn on a chart that has nothing to show. */
export function emptyMessage(text: string, color: string) {
  return {
    type: 'text',
    left: 'center',
    top: 'middle',
    silent: true,
    style: { text, fill: color, fontSize: 14 },
  }
}

/** Lowest y-axis value: 5 points below the worst day, on a multiple of 5, so dips aren't flattened. */
export function yieldAxisMin(rows: DailyYield[]): number {
  const values = rows.flatMap((r) => (r.yieldPct === null ? [] : [r.yieldPct]))
  if (values.length === 0) return 0
  return Math.max(0, Math.floor((Math.min(...values) - 5) / 5) * 5)
}

/**
 * Daily first-pass yield as a line, with the overall yield as a dashed reference.
 * Dragging across the chart (brush) selects a date range; the wheel zooms the time axis.
 * Points sit at the middle of each UTC day so a brush over a point covers that day.
 */
export function buildYieldOption(rows: DailyYield[], config: YieldConfig = {}): EChartsCoreOption {
  const colors = config.colors ?? DEFAULT_CHART_COLORS
  const withBoards = rows.filter((r) => r.yieldPct !== null)
  const inspected = rows.reduce((sum, r) => sum + r.inspected, 0)
  const passed = rows.reduce((sum, r) => sum + r.passed, 0)
  const overall = inspected ? (passed / inspected) * 100 : null
  const worst = withBoards.reduce<DailyYield | null>((min, r) => (min === null || r.yieldPct! < min.yieldPct! ? r : min), null)

  const range = config.selectedRange
  const hasRange = range !== undefined && (range.start !== null || range.end !== null) && rows.length > 0
  const shade = hasRange
    ? [
        { xAxis: range.start ?? rows[0].day, itemStyle: { color: colors.accent, opacity: 0.12 } },
        { xAxis: range.end ?? rows[rows.length - 1].day + DAY_MS },
      ]
    : null
  const rangeText = hasRange
    ? ` Selected range ${range.start === null ? 'start' : DATE_ONLY(range.start)} to ${range.end === null ? 'end' : DATE_ONLY(range.end - 1)}.`
    : ''

  return {
    animation: false,
    aria: {
      enabled: true,
      description:
        withBoards.length === 0
          ? 'No boards match these filters.'
          : `First-pass yield by day for ${inspected} boards over ${rows.length} days, ${overall!.toFixed(1)}% overall. ` +
            `Lowest day ${DATE_ONLY(worst!.day)} at ${worst!.yieldPct!.toFixed(1)}%.${rangeText}`,
    },
    grid: { left: 56, right: 24, top: 32, bottom: 64 },
    brush: {
      id: TREND_BRUSH_ID,
      xAxisIndex: 0,
      brushType: 'lineX',
      brushMode: 'single',
      transformable: false,
      brushStyle: { color: colors.accent, opacity: 0.15, borderColor: colors.accent, borderWidth: 1 },
    },
    dataZoom: [
      { type: 'inside', xAxisIndex: 0, zoomOnMouseWheel: true, moveOnMouseMove: false, moveOnMouseWheel: false },
      { type: 'slider', xAxisIndex: 0, height: 16, bottom: 8 },
    ],
    graphic: withBoards.length === 0 ? [emptyMessage('No boards match these filters', colors.muted)] : [],
    tooltip: {
      trigger: 'axis',
      formatter: (params: { data: [number, number | null, number, number] }[]) => {
        const [day, pct, total, ok] = params[0].data
        return `${DATE_ONLY(day)}<br/>${pct === null ? 'No boards' : `${pct.toFixed(1)}% yield · ${ok} of ${total} passed`}`
      },
    },
    dataset: {
      dimensions: ['day', 'yieldPct', 'inspected', 'passed'],
      source: rows.map((r) => [
        r.day + DAY_MS / 2,
        r.yieldPct === null ? null : Math.round(r.yieldPct * 10) / 10,
        r.inspected,
        r.passed,
      ]),
    },
    xAxis: { type: 'time', splitLine: { show: false } },
    yAxis: { type: 'value', name: 'First-pass yield (%)', min: yieldAxisMin(rows), max: 100 },
    series: [
      {
        type: 'line',
        name: 'Yield',
        encode: { x: 'day', y: 'yieldPct' },
        sampling: 'lttb',
        symbolSize: 6,
        itemStyle: { color: colors.accent },
        markArea: shade ? { silent: true, data: [shade] } : undefined,
        markLine:
          overall !== null
            ? {
                silent: true,
                symbol: 'none',
                lineStyle: { color: colors.muted, type: 'dashed' },
                label: { formatter: `overall ${overall.toFixed(1)}%`, color: colors.muted, position: 'insideStartBottom' },
                data: [{ yAxis: Math.round(overall * 10) / 10 }],
              }
            : undefined,
      },
    ],
  }
}

export interface ParetoConfig<T extends string> {
  names: Record<T, string>
  /** Accessible noun for what is counted, e.g. "defects". */
  noun: string
  /** Keys in the active filter; other bars are dimmed. Empty means nothing is filtered. */
  selected?: readonly T[]
  colors?: ChartColors
}

/**
 * Bars sorted by count with a cumulative-percentage line on a second axis.
 * Clicking a bar toggles its key in the filter (handled by the caller); `data[0]` of a bar is its key.
 */
export function buildParetoOption<T extends string>(rows: ParetoRow<T>[], config: ParetoConfig<T>): EChartsCoreOption {
  const colors = config.colors ?? DEFAULT_CHART_COLORS
  const total = rows.reduce((sum, r) => sum + r.count, 0)
  const summary = rows.map((r) => `${config.names[r.key]} ${r.count}`).join(', ')
  const selected = new Set(config.selected ?? [])
  const selectedText = selected.size
    ? ` Filtered to ${rows.filter((r) => selected.has(r.key)).map((r) => config.names[r.key]).join(', ')}.`
    : ''

  return {
    animation: false,
    aria: { enabled: true, description: `${total} ${config.noun} by type: ${summary}.${selectedText}` },
    grid: { left: 48, right: 48, top: 40, bottom: 48 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    graphic: total === 0 ? [emptyMessage(`No ${config.noun} match these filters`, colors.muted)] : [],
    dataset: {
      dimensions: ['key', 'name', 'count', 'cumulativePct'],
      source: rows.map((r) => [r.key, config.names[r.key], r.count, Math.round(r.cumulativePct * 10) / 10]),
    },
    // Long names wrap onto a second line instead of running into their neighbors.
    xAxis: { type: 'category', axisLabel: { interval: 0, width: 72, overflow: 'break' } },
    yAxis: [
      { type: 'value', name: 'Count', minInterval: 1 },
      { type: 'value', name: 'Cumulative %', min: 0, max: 100, splitLine: { show: false } },
    ],
    series: [
      {
        type: 'bar',
        name: 'Count',
        encode: { x: 'name', y: 'count' },
        cursor: 'pointer',
        itemStyle: {
          color: (params: { data: unknown[] }) =>
            selected.size === 0 || selected.has(params.data[0] as T) ? colors.accent : colors.border,
        },
        barMaxWidth: 48,
      },
      {
        type: 'line',
        name: 'Cumulative %',
        yAxisIndex: 1,
        encode: { x: 'name', y: 'cumulativePct' },
        itemStyle: { color: colors.danger },
        lineStyle: { width: 1.5 },
      },
    ],
  }
}
