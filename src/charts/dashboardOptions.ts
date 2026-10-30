import type { EChartsCoreOption } from 'echarts/core'
import type { Flight, FlightLabel } from '../data/types'
import { shortFlightId } from '../data/stress'
import type { ParetoRow } from '../filters/aggregate'
import { DEFAULT_CHART_COLORS, type ChartColors } from './chartTheme'

export interface TrendConfig {
  labels: Record<FlightLabel, string>
  labelColors: Record<FlightLabel, string>
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

/** Show the most recent year first when the data spans much longer; the slider reaches the rest. */
const INITIAL_WINDOW_MS = 365 * DAY_MS
const LONG_SPAN_MS = 2 * INITIAL_WINDOW_MS

/**
 * Max vibration per flight against its start time, one scatter series per label.
 * Dragging across the chart (brush) selects a date range; the wheel zooms the time axis.
 * The y axis is logarithmic: vibration spans orders of magnitude, and a linear axis lets one
 * crash-like flight flatten all the others.
 */
export function buildVibrationTrendOption(flights: Flight[], config: TrendConfig): EChartsCoreOption {
  const colors = config.colors ?? DEFAULT_CHART_COLORS
  const dated = flights.filter((f) => f.startedAt !== null).sort((a, b) => a.startedAt! - b.startedAt!)
  const labels = (Object.keys(config.labels) as FlightLabel[]).filter((l) => dated.some((f) => f.label === l))
  const undated = flights.length - dated.length

  const range = config.selectedRange
  const hasRange = range !== undefined && (range.start !== null || range.end !== null) && dated.length > 0
  const shade = hasRange
    ? [
        {
          xAxis: range.start ?? dated[0].startedAt!,
          itemStyle: { color: colors.accent, opacity: 0.12 },
        },
        { xAxis: range.end ?? dated[dated.length - 1].startedAt! },
      ]
    : null
  // Reference line: the median across the flights shown, so outliers stand out under any filter.
  const sortedVib = dated.map((f) => f.maxVibMs2).sort((a, b) => a - b)
  const median = sortedVib.length
    ? sortedVib.length % 2
      ? sortedVib[(sortedVib.length - 1) / 2]
      : (sortedVib[sortedVib.length / 2 - 1] + sortedVib[sortedVib.length / 2]) / 2
    : null

  const newest = dated.length ? dated[dated.length - 1].startedAt! : 0
  const window =
    dated.length && newest - dated[0].startedAt! > LONG_SPAN_MS ? { startValue: newest - INITIAL_WINDOW_MS } : {}

  const rangeText = hasRange
    ? ` Selected range ${range.start === null ? 'start' : DATE_ONLY(range.start)} to ${range.end === null ? 'end' : DATE_ONLY(range.end - 1)}.`
    : ''

  return {
    animation: false,
    aria: {
      enabled: true,
      description:
        `Maximum vibration for ${dated.length} flights by start date` +
        (undated ? `; ${undated} flights without a start time are not shown.` : '.') +
        rangeText,
    },
    grid: { left: 56, right: 24, top: 56, bottom: 64 },
    brush: {
      id: TREND_BRUSH_ID,
      xAxisIndex: 0,
      brushType: 'lineX',
      brushMode: 'single',
      transformable: false,
      brushStyle: { color: colors.accent, opacity: 0.15, borderColor: colors.accent, borderWidth: 1 },
    },
    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: 0,
        zoomOnMouseWheel: true,
        moveOnMouseMove: false,
        moveOnMouseWheel: false,
        ...window,
      },
      { type: 'slider', xAxisIndex: 0, height: 16, bottom: 8, ...window },
    ],
    graphic: dated.length === 0 ? [emptyMessage('No flights with a start time match these filters', colors.muted)] : [],
    legend: { top: 0 },
    tooltip: {
      trigger: 'item',
      formatter: (p: { data: [number, number, string]; seriesName: string }) =>
        `${shortFlightId(p.data[2])} · ${p.seriesName}<br/>${new Date(p.data[0]).toISOString().slice(0, 10)} · ${p.data[1].toFixed(1)} m/s²`,
    },
    xAxis: { type: 'time', splitLine: { show: false } },
    yAxis: { type: 'log', name: 'Max vibration (m/s², log scale)', logBase: 10 },
    series: labels.map((label, i) => ({
      type: 'scatter',
      name: config.labels[label],
      symbolSize: 10,
      itemStyle: { color: config.labelColors[label] },
      // A log axis can't place 0; clamp to a floor well below any real reading.
      data: dated.filter((f) => f.label === label).map((f) => [f.startedAt, Math.max(f.maxVibMs2, 0.01), f.flightId]),
      // One reference line and one range shade are enough; attach them to the first series.
      markArea: i === 0 && shade ? { silent: true, data: [shade] } : undefined,
      markLine:
        i === 0 && median !== null
          ? {
              silent: true,
              symbol: 'none',
              lineStyle: { color: colors.muted, type: 'dashed' },
              label: { formatter: `median ${median.toFixed(1)}`, color: colors.muted, position: 'insideEndTop' },
              data: [{ yAxis: median }],
            }
          : undefined,
    })),
  }
}

export interface ParetoConfig<T extends string> {
  names: Record<T, string>
  /** Accessible noun for what is counted, e.g. "events". */
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
    grid: { left: 48, right: 48, top: 40, bottom: 40 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    graphic: total === 0 ? [emptyMessage(`No ${config.noun} match these filters`, colors.muted)] : [],
    dataset: {
      dimensions: ['key', 'name', 'count', 'cumulativePct'],
      source: rows.map((r) => [r.key, config.names[r.key], r.count, Math.round(r.cumulativePct * 10) / 10]),
    },
    xAxis: { type: 'category', axisLabel: { interval: 0 } },
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
