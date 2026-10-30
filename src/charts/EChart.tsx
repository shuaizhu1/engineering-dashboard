import type { EChartsCoreOption, ECharts } from 'echarts/core'
import { useEffect, useRef, type CSSProperties } from 'react'
import { echarts } from './echarts'

export type EChartEventHandlers = Record<string, (params: unknown, chart: ECharts) => void>

interface EChartProps {
  option: EChartsCoreOption
  onEvents?: EChartEventHandlers
  /** Runs after every `setOption`, e.g. to re-enable a brush cursor. Pass a stable function. */
  onAfterSetOption?: (chart: ECharts) => void
  className?: string
  style?: CSSProperties
}

/** Thin React wrapper around an ECharts canvas instance. Pass a memoized `option` and `onEvents`. */
export default function EChart({ option, onEvents, onAfterSetOption, className, style }: EChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ECharts | null>(null)

  useEffect(() => {
    const container = containerRef.current!
    const chart = echarts.init(container, undefined, { renderer: 'canvas' })
    chartRef.current = chart
    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(container)
    return () => {
      observer.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    chart.setOption(option, { notMerge: true })
    onAfterSetOption?.(chart)
  }, [option, onAfterSetOption])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !onEvents) return
    const bound = Object.entries(onEvents).map(([name, handler]) => [name, (params: unknown) => handler(params, chart)] as const)
    for (const [name, handler] of bound) chart.on(name, handler)
    return () => {
      for (const [name, handler] of bound) chart.off(name, handler)
    }
  }, [onEvents])

  return <div ref={containerRef} className={className} style={{ width: '100%', height: 320, ...style }} />
}
