import type { EChartsCoreOption } from 'echarts/core'
import type { Flight, FlightLabel } from '../data/types'
import type { ParetoRow } from '../filters/aggregate'
import { DEFAULT_CHART_COLORS, axisStyle, type ChartColors } from './chartTheme'

export interface TrendConfig {
  labels: Record<FlightLabel, string>
  labelColors: Record<FlightLabel, string>
  thresholdMs2: number
  colors?: ChartColors
}

/** Max vibration per flight against its start time, one scatter series per label. */
export function buildVibrationTrendOption(flights: Flight[], config: TrendConfig): EChartsCoreOption {
  const colors = config.colors ?? DEFAULT_CHART_COLORS
  const dated = flights.filter((f) => f.startedAt !== null).sort((a, b) => a.startedAt! - b.startedAt!)
  const labels = (Object.keys(config.labels) as FlightLabel[]).filter((l) => dated.some((f) => f.label === l))
  const undated = flights.length - dated.length

  return {
    animation: false,
    aria: {
      enabled: true,
      description:
        `Maximum vibration for ${dated.length} flights by start date` +
        (undated ? `; ${undated} flights without a start time are not shown.` : '.'),
    },
    grid: { left: 56, right: 24, top: 40, bottom: 40 },
    legend: { top: 0, textStyle: { color: colors.text } },
    tooltip: {
      trigger: 'item',
      formatter: (p: { data: [number, number, string]; seriesName: string }) =>
        `${p.data[2].slice(0, 8)} · ${p.seriesName}<br/>${new Date(p.data[0]).toISOString().slice(0, 10)} · ${p.data[1].toFixed(1)} m/s²`,
    },
    xAxis: { type: 'time', ...axisStyle(colors), splitLine: { show: false } },
    yAxis: { type: 'value', name: 'Max vibration (m/s²)', min: 0, ...axisStyle(colors) },
    series: labels.map((label, i) => ({
      type: 'scatter',
      name: config.labels[label],
      symbolSize: 10,
      itemStyle: { color: config.labelColors[label] },
      data: dated.filter((f) => f.label === label).map((f) => [f.startedAt, f.maxVibMs2, f.flightId]),
      // One threshold line is enough; attach it to the first series.
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
  colors?: ChartColors
}

/** Bars sorted by count with a cumulative-percentage line on a second axis. */
export function buildParetoOption<T extends string>(rows: ParetoRow<T>[], config: ParetoConfig<T>): EChartsCoreOption {
  const colors = config.colors ?? DEFAULT_CHART_COLORS
  const total = rows.reduce((sum, r) => sum + r.count, 0)
  const summary = rows.map((r) => `${config.names[r.key]} ${r.count}`).join(', ')

  return {
    animation: false,
    aria: { enabled: true, description: `${total} ${config.noun} by type: ${summary}.` },
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
        itemStyle: { color: colors.accent },
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
