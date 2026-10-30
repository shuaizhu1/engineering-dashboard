/**
 * Chart colors and the shared ECharts theme. The palettes mirror the design tokens in
 * src/index.css; keep the two in sync. Option builders use `ChartColors` only for
 * meaning-carrying marks (selection, thresholds); axes, text, legends and tooltips come from the theme.
 */
export interface ChartColors {
  text: string
  muted: string
  border: string
  surface: string
  accent: string
  danger: string
}

export const LIGHT_COLORS: ChartColors = {
  text: '#1f2328',
  muted: '#59636e',
  border: '#d1d9e0',
  surface: '#ffffff',
  accent: '#0b62d6',
  danger: '#c4302b',
}

export const DARK_COLORS: ChartColors = {
  text: '#e6edf3',
  muted: '#9198a1',
  border: '#3d444d',
  surface: '#151b23',
  accent: '#4493f8',
  danger: '#f85149',
}

export const DEFAULT_CHART_COLORS = LIGHT_COLORS

export type ColorScheme = 'light' | 'dark'

export const CHART_THEME: Record<ColorScheme, string> = { light: 'eda-light', dark: 'eda-dark' }

/** ECharts theme object built from a palette. */
export function buildEChartsTheme(colors: ChartColors) {
  const axis = {
    axisLine: { lineStyle: { color: colors.border } },
    axisTick: { lineStyle: { color: colors.border } },
    axisLabel: { color: colors.muted },
    nameTextStyle: { color: colors.muted },
    splitLine: { lineStyle: { color: colors.border, opacity: 0.6 } },
  }
  return {
    color: [colors.accent, '#f28c28', '#2fb37a', '#b06cf0', colors.danger],
    backgroundColor: 'transparent',
    textStyle: { color: colors.text, fontFamily: 'system-ui, "Segoe UI", Roboto, sans-serif' },
    legend: { textStyle: { color: colors.text } },
    tooltip: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      textStyle: { color: colors.text },
      axisPointer: { lineStyle: { color: colors.muted }, crossStyle: { color: colors.muted } },
    },
    categoryAxis: axis,
    valueAxis: axis,
    timeAxis: axis,
    logAxis: axis,
    dataZoom: {
      borderColor: colors.border,
      textStyle: { color: colors.muted },
      fillerColor: `${colors.accent}26`,
      handleStyle: { color: colors.surface, borderColor: colors.muted },
      moveHandleStyle: { color: colors.border },
      dataBackground: { lineStyle: { color: colors.muted }, areaStyle: { color: colors.border } },
    },
    markArea: { label: { color: colors.muted } },
  }
}

/** Register the light and dark themes with an ECharts instance namespace. */
export function registerChartThemes(echarts: { registerTheme: (name: string, theme: object) => void }) {
  echarts.registerTheme(CHART_THEME.light, buildEChartsTheme(LIGHT_COLORS))
  echarts.registerTheme(CHART_THEME.dark, buildEChartsTheme(DARK_COLORS))
}
