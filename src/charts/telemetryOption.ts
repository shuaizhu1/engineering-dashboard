import type { EChartsCoreOption } from 'echarts/core'
import type { EventType, FlightEvent, FlightTelemetry, TelemetryChannel } from '../data/types'
import { focusWindow } from '../filters/navigation'
import { DEFAULT_CHART_COLORS, type ChartColors } from './chartTheme'

/** One stacked plot in the detail view: one or more channels sharing a y axis. */
export interface ChannelPanel {
  title: string
  unit: string
  series: readonly { key: TelemetryChannel; name: string }[]
  /** Event types shaded on this panel. */
  eventTypes: readonly EventType[]
}

export interface SyncedChannelsConfig {
  panels: readonly ChannelPanel[]
  eventNames: Record<EventType, string>
  /** Event to zoom to and highlight on every panel. */
  focus?: FlightEvent | null
  /** Colors for the series within a panel, in order. */
  seriesColors: readonly string[]
  colors?: ChartColors
}

export const PANEL_HEIGHT = 110
const PANEL_GAP = 36
const TOP = 28
const BOTTOM = 56

/** Pixel height of the chart for a number of panels. */
export function syncedChartHeight(panelCount: number): number {
  return TOP + panelCount * (PANEL_HEIGHT + PANEL_GAP) - PANEL_GAP + BOTTOM
}

function hasData(values: ArrayLike<number>): boolean {
  for (let i = 0; i < values.length; i++) if (!Number.isNaN(values[i])) return true
  return false
}

/** Panels with at least one channel that has data; the rest are left out of the chart. */
export function panelsWithData(telemetry: FlightTelemetry, panels: readonly ChannelPanel[]): ChannelPanel[] {
  return panels
    .map((p) => ({ ...p, series: p.series.filter((s) => hasData(telemetry.channels[s.key])) }))
    .filter((p) => p.series.length > 0)
}

/** Rows for `dataset.source`: time first, then each column. NaN becomes null so lines show gaps. */
export function toDatasetRows(tS: ArrayLike<number>, columns: ArrayLike<number>[]): (number | null)[][] {
  const rows: (number | null)[][] = new Array(tS.length)
  for (let i = 0; i < tS.length; i++) {
    const row: (number | null)[] = [Math.round(tS[i] * 10) / 10]
    for (const column of columns) {
      const v = column[i]
      row.push(v === undefined || Number.isNaN(v) ? null : Math.round(v * 1000) / 1000)
    }
    rows[i] = row
  }
  return rows
}

/**
 * Stacked telemetry panels on one shared time axis: one dataZoom drives every panel and the
 * hover line is linked, so channels stay in sync. With `focus`, the view opens zoomed to that event.
 */
export function buildSyncedChannelsOption(
  telemetry: FlightTelemetry,
  events: FlightEvent[],
  config: SyncedChannelsConfig,
): EChartsCoreOption {
  const colors = config.colors ?? DEFAULT_CHART_COLORS
  const panels = panelsWithData(telemetry, config.panels)
  const keys = panels.flatMap((p) => p.series.map((s) => s.key))
  const tStart = telemetry.tS[0]
  const tEnd = telemetry.tS[telemetry.tS.length - 1]
  const axisIndexes = panels.map((_, i) => i)
  const focus = config.focus ?? null
  const window = focus ? focusWindow(focus, tStart, tEnd) : null

  const shadeFor = (panel: ChannelPanel) => [
    ...events
      .filter((e) => panel.eventTypes.includes(e.type) && e.eventId !== focus?.eventId)
      .map((e) => [{ xAxis: e.startS, itemStyle: { color: colors.danger, opacity: 0.1 } }, { xAxis: e.endS }]),
    ...(focus ? [[{ xAxis: focus.startS, itemStyle: { color: colors.accent, opacity: 0.22 } }, { xAxis: focus.endS }]] : []),
  ]

  const duration = Math.round(tEnd - tStart)

  return {
    animation: false,
    aria: {
      enabled: true,
      description:
        `Telemetry over ${duration} s of flight time in ${panels.length} synced panels: ` +
        `${panels.map((p) => `${p.title} (${p.unit})`).join(', ')}.` +
        (focus
          ? ` Zoomed to ${config.eventNames[focus.type]} at ${focus.startS.toFixed(1)}–${focus.endS.toFixed(1)} s.`
          : ''),
    },
    // One legend per multi-channel panel, at its top right, so colors are read within that panel.
    legend: panels.flatMap((p, i) =>
      p.series.length > 1
        ? [
            {
              data: p.series.map((s) => s.name),
              top: TOP + i * (PANEL_HEIGHT + PANEL_GAP) - 22,
              right: 24,
              itemWidth: 14,
              itemHeight: 8,
            },
          ]
        : [],
    ),
    tooltip: { trigger: 'axis', axisPointer: { type: 'line' } },
    axisPointer: { link: [{ xAxisIndex: 'all' }] },
    dataset: {
      dimensions: ['t', ...keys],
      source: toDatasetRows(
        telemetry.tS,
        keys.map((k) => telemetry.channels[k]),
      ),
    },
    grid: panels.map((_, i) => ({
      left: 64,
      right: 24,
      top: TOP + i * (PANEL_HEIGHT + PANEL_GAP),
      height: PANEL_HEIGHT,
    })),
    xAxis: panels.map((_, i) => ({
      type: 'value',
      gridIndex: i,
      // Whole seconds at the ends so the axis labels stay readable.
      min: Math.floor(tStart),
      max: Math.ceil(tEnd),
      splitLine: { show: false },
      axisLabel: {
        show: i === panels.length - 1,
        formatter: (value: number) => `${Math.round(value)} s`,
      },
    })),
    yAxis: panels.map((p, i) => ({
      type: 'value',
      gridIndex: i,
      name: `${p.title} (${p.unit})`,
      nameLocation: 'end',
      nameGap: 8,
      scale: true,
      splitNumber: 3,
      nameTextStyle: { color: colors.text, align: 'left', fontWeight: 600 },
    })),
    dataZoom: [
      {
        // Drag pans; Ctrl+wheel (and trackpad pinch) zooms, so plain scrolling still scrolls the page.
        type: 'inside',
        xAxisIndex: axisIndexes,
        filterMode: 'none',
        zoomOnMouseWheel: 'ctrl',
        moveOnMouseWheel: false,
        moveOnMouseMove: true,
        ...(window ? { startValue: window[0], endValue: window[1] } : {}),
      },
      {
        type: 'slider',
        xAxisIndex: axisIndexes,
        filterMode: 'none',
        height: 16,
        bottom: 12,
        ...(window ? { startValue: window[0], endValue: window[1] } : {}),
      },
    ],
    series: panels.flatMap((panel, i) =>
      panel.series.map((s, j) => ({
        type: 'line',
        name: s.name,
        xAxisIndex: i,
        yAxisIndex: i,
        encode: { x: 't', y: s.key },
        showSymbol: false,
        sampling: 'lttb',
        connectNulls: false,
        lineStyle: { width: 1 },
        itemStyle: { color: config.seriesColors[j % config.seriesColors.length] },
        markArea: j === 0 ? { silent: true, data: shadeFor(panel) } : undefined,
      })),
    ),
  }
}
