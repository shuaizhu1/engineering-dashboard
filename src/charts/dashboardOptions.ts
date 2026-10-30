import type { EChartsCoreOption } from 'echarts/core'
import type { Flight, FlightLabel } from '../data/types'
import { shortFlightId } from '../data/stress'
import type { ParetoRow } from '../filters/aggregate'
import { DEFAULT_CHART_COLORS, axisStyle, type ChartColors } from './chartTheme'

export interface TrendConfig {
  labels: Record<FlightLabel, string>
  labelColors: Record<FlightLabel, string>
  thresholdMs2: number
  /** Active date filter as epoch-ms bounds (end exclusive); shaded on the chart. */
  selectedRange?: { start: number | null; end: number | null }
  colors?: ChartColors
}

/** Id of the brush component, for dispatching brush actions. */
export const TREND_BRUSH_ID = 'dateBrush'

const DATE_ONLY = (time: number) => new Date(time).toISOString().slice(0, 10)

/**
 * Max vibration per flight against its start time, one scatter series per label.
 * Dragging across the chart (brush) selects a date range; the wheel zooms the time axis.
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
    grid: { left: 56, right: 24, top: 40, bottom: 64 },
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
      { type: 'slider', xAxisIndex: 0, height: 16, bottom: 8, textStyle: { color: colors.muted } },
    ],
    legend: { top: 0, textStyle: { color: colors.text } },
    tooltip: {
      trigger: 'item',
      formatter: (p: { data: [number, number, string]; seriesName: string }) =>
        `${shortFlightId(p.data[2])} · ${p.seriesName}<br/>${new Date(p.data[0]).toISOString().slice(0, 10)} · ${p.data[1].toFixed(1)} m/s²`,
    },
    xAxis: { type: 'time', ...axisStyle(colors), splitLine: { show: false } },
    yAxis: { type: 'value', name: 'Max vibration (m/s²)', min: 0, ...axisStyle(colors) },
    series: labels.map((label, i) => ({
      type: 'scatter',
      name: config.labels[label],
      symbolSize: 10,
      itemStyle: { color: config.labelColors[label] },
      data: dated.filter((f) => f.label === label).map((f) => [f.startedAt, f.maxVibMs2, f.flightId]),
      // One threshold line and one range shade are enough; attach them to the first series.
      markArea: i === 0 && shade ? { silent: true, data: [shade] } : undefined,
      markLine:
        i === 0
          ? {
              silent: true,
              symbol: 'none',
              lineStyle: { color: colors.danger, type: 'dashed' },
              label: { formatter: `${config.thresholdMs2} m/s²`, color: colors.danger },
              data: [{ yAxis: config.thresholdMs2 }],
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
    dataset: {
      dimensions: ['key', 'name', 'count', 'cumulativePct'],
      source: rows.map((r) => [r.key, config.names[r.key], r.count, Math.round(r.cumulativePct * 10) / 10]),
    },
    xAxis: { type: 'category', ...axisStyle(colors), axisLabel: { color: colors.muted, interval: 0 } },
    yAxis: [
      { type: 'value', name: 'Count', minInterval: 1, ...axisStyle(colors) },
      { type: 'value', name: 'Cumulative %', min: 0, max: 100, ...axisStyle(colors), splitLine: { show: false } },
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
