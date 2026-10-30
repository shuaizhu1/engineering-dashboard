import type { EChartsCoreOption } from 'echarts/core'
import type { FlightEvent } from '../data/types'

export interface ChannelSeries {
  tS: ArrayLike<number>
  values: ArrayLike<number>
}

export interface ChannelChartConfig {
  name: string
  unit: string
  /** Event types to shade on this chart. */
  eventTypes: FlightEvent['type'][]
}

/** Rows for `dataset.source`; NaN becomes null so ECharts draws a gap. */
export function toDatasetRows({ tS, values }: ChannelSeries): [number, number | null][] {
  const n = Math.min(tS.length, values.length)
  const rows: [number, number | null][] = new Array(n)
  for (let i = 0; i < n; i++) {
    const v = values[i]
    rows[i] = [Math.round(tS[i] * 10) / 10, Number.isNaN(v) ? null : Math.round(v * 1000) / 1000]
  }
  return rows
}

/** Line chart of one telemetry channel over flight time, with matching events shaded. */
export function buildChannelOption(
  series: ChannelSeries,
  events: FlightEvent[],
  config: ChannelChartConfig,
): EChartsCoreOption {
  const shaded = events.filter((e) => config.eventTypes.includes(e.type))
  const label = `${config.name} (${config.unit})`

  return {
    animation: false,
    aria: {
      enabled: true,
      description: `${label} over flight time, ${series.tS.length} samples, ${shaded.length} highlighted events.`,
    },
    grid: { left: 56, right: 24, top: 32, bottom: 72 },
    dataset: { source: toDatasetRows(series) },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'value', name: 'Time (s)', nameLocation: 'middle', nameGap: 28, min: 'dataMin', max: 'dataMax' },
    yAxis: { type: 'value', name: label },
    dataZoom: [
      { type: 'inside', xAxisIndex: 0 },
      { type: 'slider', xAxisIndex: 0, bottom: 8 },
    ],
    series: [
      {
        type: 'line',
        name: config.name,
        encode: { x: 0, y: 1 },
        showSymbol: false,
        sampling: 'lttb',
        lineStyle: { width: 1 },
        connectNulls: false,
        markArea: {
          silent: true,
          itemStyle: { color: 'rgba(220, 38, 38, 0.12)' },
          data: shaded.map((e) => [{ xAxis: e.startS, name: e.type }, { xAxis: e.endS }]),
        },
      },
    ],
  }
}
