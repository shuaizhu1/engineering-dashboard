import { useEffect, useState } from 'react'
import { CHART_THEME, DARK_COLORS, LIGHT_COLORS, type ChartColors, type ColorScheme } from '../charts/chartTheme'

const query = () => window.matchMedia('(prefers-color-scheme: dark)')

/** The registered ECharts theme and palette for the current color scheme, updated when it changes. */
export function useChartTheme(): { theme: string; colors: ChartColors } {
  const [scheme, setScheme] = useState<ColorScheme>(() => (query().matches ? 'dark' : 'light'))
  useEffect(() => {
    const mq = query()
    const update = () => setScheme(mq.matches ? 'dark' : 'light')
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return { theme: CHART_THEME[scheme], colors: scheme === 'dark' ? DARK_COLORS : LIGHT_COLORS }
}
