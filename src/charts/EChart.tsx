import type { EChartsCoreOption, ECharts } from 'echarts/core'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { echarts } from './echarts'

export type EChartEventHandlers = Record<string, (params: unknown, chart: ECharts) => void>

interface EChartProps {
  option: EChartsCoreOption
  /** Registered theme name (see chartTheme.ts); changing it re-creates the chart. */
  theme?: string
  onEvents?: EChartEventHandlers
  /** Runs after every `setOption`, e.g. to re-enable a brush cursor. Pass a stable function. */
  onAfterSetOption?: (chart: ECharts) => void
  className?: string
  style?: CSSProperties
}

/** Thin React wrapper around an ECharts canvas instance. Pass a memoized `option` and `onEvents`. */
export default function EChart({ option, theme, onEvents, onAfterSetOption, className, style }: EChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [chart, setChart] = useState<ECharts | null>(null)

  // ECharts applies a theme only at init, so a theme change means a new instance.
  useEffect(() => {
    const container = containerRef.current!
    const instance = echarts.init(container, theme, { renderer: 'canvas' })
    setChart(instance)
    const observer = new ResizeObserver(() => instance.resize())
    observer.observe(container)
    return () => {
      observer.disconnect()
      instance.dispose()
      setChart(null)
    }
  }, [theme])

  useEffect(() => {
    if (!chart) return
    chart.setOption(option, { notMerge: true })
    onAfterSetOption?.(chart)
  }, [chart, option, onAfterSetOption])

  useEffect(() => {
    if (!chart || !onEvents) return
    const bound = Object.entries(onEvents).map(([name, handler]) => [name, (params: unknown) => handler(params, chart)] as const)
    for (const [name, handler] of bound) chart.on(name, handler)
    return () => {
      for (const [name, handler] of bound) chart.off(name, handler)
    }
  }, [chart, onEvents])

  return <div ref={containerRef} className={className} style={{ width: '100%', height: 320, ...style }} />
}
