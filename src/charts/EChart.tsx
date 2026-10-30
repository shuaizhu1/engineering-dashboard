import type { EChartsCoreOption, ECharts } from 'echarts/core'
import { useEffect, useRef, type CSSProperties } from 'react'
import { echarts } from './echarts'

export type EChartEventHandlers = Record<string, (params: unknown) => void>

interface EChartProps {
  option: EChartsCoreOption
  onEvents?: EChartEventHandlers
  className?: string
  style?: CSSProperties
}

/** Thin React wrapper around an ECharts canvas instance. Pass a memoized `option` and `onEvents`. */
export default function EChart({ option, onEvents, className, style }: EChartProps) {
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
    chartRef.current?.setOption(option, { notMerge: true })
  }, [option])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !onEvents) return
    const entries = Object.entries(onEvents)
    for (const [name, handler] of entries) chart.on(name, handler)
    return () => {
      for (const [name, handler] of entries) chart.off(name, handler)
    }
  }, [onEvents])

  return <div ref={containerRef} className={className} style={{ width: '100%', height: 320, ...style }} />
}
