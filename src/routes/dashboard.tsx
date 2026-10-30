import type { ECharts } from 'echarts/core'
import { Suspense, lazy, useEffect, useMemo, type ReactNode } from 'react'
import type { EChartEventHandlers } from '../charts/EChart'
import { TREND_BRUSH_ID, buildParetoOption, buildVibrationTrendOption } from '../charts/dashboardOptions'
import { DateRangeFilter } from '../components/DateRangeFilter'
import { FilterSelect } from '../components/FilterSelect'
import { ViewTabs } from '../components/ViewTabs'
import { EVENT_TYPES, FLIGHT_LABELS, type EventType } from '../data/types'
import { eventTypePareto } from '../filters/aggregate'
import {
  EMPTY_FILTERS,
  dateRangeBounds,
  dateRangeFromTimes,
  filterEvents,
  filterFlights,
  hasActiveFilters,
  toggleValue,
} from '../filters/filters'
import { useChartTheme } from '../hooks/useChartTheme'
import { useFilters } from '../hooks/useFilters'
import { siftMode } from '../modes/sift'
import { ParetoTable, TrendTable } from './chart-tables'
import { FlightGrid } from './flight-grid'
import { useSiftData } from './root-data'

const EChart = lazy(() => import('../charts/EChart'))

/** Dragging on the trend chart draws a date range without first picking a toolbox tool. */
function enableDateBrush(chart: ECharts) {
  chart.dispatchAction({
    type: 'takeGlobalCursor',
    key: 'brush',
    brushOption: { brushType: 'lineX', brushMode: 'single' },
  })
}

interface ChartCardProps {
  title: string
  hint?: string
  action?: ReactNode
  /** The chart's data as a table, offered through a Chart/Table switch. */
  table: ReactNode
  children: ReactNode
}

function ChartCard({ title, hint, action, table, children }: ChartCardProps) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <ViewTabs
        label={`${title} view`}
        heading={
          <h2 className="text-sm font-semibold">
            {title}
            {hint && <span className="ml-2 font-normal text-muted">{hint}</span>}
          </h2>
        }
        action={action}
        views={[
          {
            value: 'chart',
            label: 'Chart',
            content: (
              <Suspense
                fallback={
                  <div className="h-[280px] animate-pulse rounded bg-border/40" role="status" aria-label="Loading chart" />
                }
              >
                {children}
              </Suspense>
            ),
          },
          { value: 'table', label: 'Table', content: table },
        ]}
      />
    </section>
  )
}

export function Dashboard() {
  const { flights, events, syntheticCount } = useSiftData()
  const [filters, setFilters] = useFilters()
  const { theme: chartTheme, colors } = useChartTheme()

  // Load DuckDB-WASM and the telemetry view while the user looks at the dashboard,
  // so opening a flight doesn't wait for the WebAssembly download.
  useEffect(() => {
    const warmUp = () => void import('../data/telemetry').then((m) => m.warmUpTelemetry()).catch(() => {})
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(warmUp, { timeout: 3000 })
      return () => cancelIdleCallback(id)
    }
    const id = setTimeout(warmUp, 1000)
    return () => clearTimeout(id)
  }, [])

  const matchingFlights = useMemo(() => filterFlights(flights, events, filters), [flights, events, filters])
  const matchingEvents = useMemo(
    () => filterEvents(events, matchingFlights, filters),
    [events, matchingFlights, filters],
  )

  // Each chart ignores the filter it controls, so it keeps showing what else can be selected:
  // the trend chart shows every date (the selection is shaded), the Pareto every event type.
  const trendFlights = useMemo(
    () => filterFlights(flights, events, { ...filters, from: null, to: null }),
    [flights, events, filters],
  )
  const paretoEvents = useMemo(() => {
    const withoutTypes = { ...filters, eventTypes: [] }
    return filterEvents(events, filterFlights(flights, events, withoutTypes), withoutTypes)
  }, [flights, events, filters])

  const trendOption = useMemo(
    () =>
      buildVibrationTrendOption(trendFlights, {
        labels: siftMode.labels,
        labelColors: siftMode.labelColors,
        thresholdMs2: siftMode.vibrationThresholdMs2,
        selectedRange: dateRangeBounds(filters.from, filters.to),
        colors,
      }),
    [trendFlights, filters.from, filters.to, colors],
  )
  const paretoRows = useMemo(() => eventTypePareto(paretoEvents, EVENT_TYPES), [paretoEvents])
  const paretoOption = useMemo(
    () =>
      buildParetoOption(paretoRows, {
        names: siftMode.eventTypes,
        noun: 'events',
        selected: filters.eventTypes,
        colors,
      }),
    [paretoRows, filters.eventTypes, colors],
  )

  const trendEvents = useMemo<EChartEventHandlers>(
    () => ({
      brushEnd: (params, chart) => {
        const area = (params as { areas?: { coordRange?: [number, number] }[] }).areas?.[0]
        if (!area?.coordRange) return
        // The shaded mark area takes over from the brush rectangle.
        chart.dispatchAction({ type: 'brush', brushId: TREND_BRUSH_ID, areas: [] })
        setFilters({ ...filters, ...dateRangeFromTimes(area.coordRange[0], area.coordRange[1]) })
      },
    }),
    [filters, setFilters],
  )
  const toggleEventType = (type: EventType) =>
    setFilters({ ...filters, eventTypes: toggleValue(filters.eventTypes, type, EVENT_TYPES) })
  const paretoClickEvents = useMemo<EChartEventHandlers>(
    () => ({
      click: (params) => {
        const { seriesType, data } = params as { seriesType?: string; data?: unknown[] }
        if (seriesType !== 'bar' || !data) return
        setFilters({ ...filters, eventTypes: toggleValue(filters.eventTypes, data[0] as EventType, EVENT_TYPES) })
      },
    }),
    [filters, setFilters],
  )

  return (
    <div className="space-y-4">
      <title>{`${siftMode.title} · Engineering Data Explorer`}</title>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold">{siftMode.title}</h1>
        <p className="text-sm text-muted" aria-live="polite">
          {matchingFlights.length} of {flights.length} {siftMode.record.plural} · {matchingEvents.length} events
        </p>
      </div>

      {syntheticCount > 0 && (
        <p role="note" className="rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-sm">
          Stress test: {syntheticCount.toLocaleString()} synthetic flights cloned from{' '}
          {(flights.length - syntheticCount).toLocaleString()} real ones. Remove <code>stress</code> from the URL and
          reload for real data only.
        </p>
      )}

      <div role="group" aria-label="Filters" className="flex flex-wrap items-center gap-2">
        <FilterSelect
          label="Label"
          options={FLIGHT_LABELS}
          names={siftMode.labels}
          selected={filters.labels}
          onChange={(labels) => setFilters({ ...filters, labels })}
        />
        <FilterSelect
          label="Event"
          options={EVENT_TYPES}
          names={siftMode.eventTypes}
          selected={filters.eventTypes}
          onChange={(eventTypes) => setFilters({ ...filters, eventTypes })}
        />
        <DateRangeFilter
          label="Date"
          from={filters.from}
          to={filters.to}
          // Typing a date fires many changes; keep them out of the back-button history.
          onChange={(from, to) => setFilters({ ...filters, from, to }, { replace: true })}
        />
        {hasActiveFilters(filters) && (
          <button
            type="button"
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="px-2 py-1.5 text-sm text-accent hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Max vibration per flight"
          hint="Drag to select dates"
          table={<TrendTable flights={trendFlights} />}
          action={
            (filters.from || filters.to) && (
              <button
                type="button"
                onClick={() => setFilters({ ...filters, from: null, to: null })}
                className="text-sm text-accent hover:underline"
              >
                Clear dates
              </button>
            )
          }
        >
          <EChart
            theme={chartTheme}
            option={trendOption}
            onEvents={trendEvents}
            onAfterSetOption={enableDateBrush}
            style={{ height: 280 }}
          />
        </ChartCard>
        <ChartCard
          title="Events by type"
          hint="Click a bar to filter"
          table={<ParetoTable rows={paretoRows} selected={filters.eventTypes} onToggle={toggleEventType} />}
          action={
            filters.eventTypes.length > 0 && (
              <button
                type="button"
                onClick={() => setFilters({ ...filters, eventTypes: [] })}
                className="text-sm text-accent hover:underline"
              >
                Clear types
              </button>
            )
          }
        >
          <EChart theme={chartTheme} option={paretoOption} onEvents={paretoClickEvents} style={{ height: 280 }} />
        </ChartCard>
      </div>

      <FlightGrid flights={matchingFlights} total={flights.length} />
    </div>
  )
}
