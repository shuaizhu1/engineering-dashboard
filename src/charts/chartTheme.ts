/** Colors read from the page's design tokens so charts follow light and dark mode. */
export interface ChartColors {
  text: string
  muted: string
  border: string
  accent: string
  danger: string
}

export const DEFAULT_CHART_COLORS: ChartColors = {
  text: '#1f2328',
  muted: '#59636e',
  border: '#d1d9e0',
  accent: '#0b62d6',
  danger: '#c4302b',
}

export function axisStyle(colors: ChartColors) {
  return {
    nameTextStyle: { color: colors.muted },
    axisLabel: { color: colors.muted },
    axisLine: { lineStyle: { color: colors.border } },
    splitLine: { lineStyle: { color: colors.border, opacity: 0.6 } },
  }
}
