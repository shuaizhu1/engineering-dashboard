import { useEffect, useState } from 'react'
import { DEFAULT_CHART_COLORS, type ChartColors } from '../charts/chartTheme'

function readColors(): ChartColors {
  const style = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback
  return {
    text: read('--text', DEFAULT_CHART_COLORS.text),
    muted: read('--muted', DEFAULT_CHART_COLORS.muted),
    border: read('--border', DEFAULT_CHART_COLORS.border),
    accent: read('--accent', DEFAULT_CHART_COLORS.accent),
    danger: read('--danger', DEFAULT_CHART_COLORS.danger),
  }
}

/** Chart colors from the CSS design tokens, updated when the color scheme changes. */
export function useChartColors(): ChartColors {
  const [colors, setColors] = useState(readColors)
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setColors(readColors())
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return colors
}
