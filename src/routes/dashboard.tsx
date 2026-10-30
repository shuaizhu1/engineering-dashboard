import type { ECharts } from 'echarts/core'
import { Suspense, lazy, useMemo, type ReactNode } from 'react'
import type { EChartEventHandlers } from '../charts/EChart'
import { TREND_BRUSH_ID, buildParetoOption, buildYieldOption } from '../charts/dashboardOptions'
import { DateRangeFilter } from '../components/DateRangeFilter'
import { FilterSelect } from '../components/FilterSelect'
import { ViewTabs } from '../components/ViewTabs'
import { appConfig } from '../config'
import { DEFECT_TYPES, LINES, RESULTS, STATIONS, type DefectType } from '../data/types'
import { dailyYield, defectTypePareto, overallYield } from '../filters/aggregate'
import {
  EMPTY_FILTERS,
  dateRangeBounds,
  dateRangeFromTimes,
  filterDefects,
  filterUnits,
  hasActiveFilters,
  toggleValue,
} from '../filters/filters'
import { useChartTheme } from '../hooks/useChartTheme'
import { useFilters } from '../hooks/useFilters'
import { BoardGrid } from './board-grid'
import { ParetoTable, YieldTable } from './chart-tables'
import { useLineData } from './root-data'

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
  const { units, defects } = useLineData()
  const [filters, setFilters] = useFilters()
  const { theme: chartTheme, colors } = useChartTheme()

  const matchingUnits = useMemo(() => filterUnits(units, defects, filters), [units, defects, filters])
  const matchingDefects = useMemo(
    () => filterDefects(defects, matchingUnits, filters),
    [defects, matchingUnits, filters],
  )
  // Filtering by result or defect type pins yield at 0% or 100%, so it isn't shown then.
  const showYield = filters.results.length === 0 && filters.defectTypes.length === 0
  const matchingYield = showYield ? overallYield(matchingUnits) : null

  // Each chart ignores the filters it controls or that would make it meaningless, so it keeps
  // showing what else can be selected. The yield chart shows every date (the selection is shaded)
  // and ignores result and defect type, which would pin yield at 0% or 100%. The Pareto shows every
  // defect type.
  const trendUnits = useMemo(
    () => filterUnits(units, defects, { ...filters, from: null, to: null, results: [], defectTypes: [] }),
    [units, defects, filters],
  )
  const paretoDefects = useMemo(() => {
    const withoutTypes = { ...filters, defectTypes: [] }
    return filterDefects(defects, filterUnits(units, defects, withoutTypes), withoutTypes)
  }, [units, defects, filters])

  const yieldRows = useMemo(() => dailyYield(trendUnits), [trendUnits])
  const trendOption = useMemo(
    () => buildYieldOption(yieldRows, { selectedRange: dateRangeBounds(filters.from, filters.to), colors }),
    [yieldRows, filters.from, filters.to, colors],
  )
  const paretoRows = useMemo(() => defectTypePareto(paretoDefects, DEFECT_TYPES), [paretoDefects])
  const paretoOption = useMemo(
    () =>
      buildParetoOption(paretoRows, {
        names: appConfig.defectTypes,
        noun: 'defects',
        selected: filters.defectTypes,
        colors,
      }),
    [paretoRows, filters.defectTypes, colors],
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
  const toggleDefectType = (type: DefectType) =>
    setFilters({ ...filters, defectTypes: toggleValue(filters.defectTypes, type, DEFECT_TYPES) })
  const paretoClickEvents = useMemo<EChartEventHandlers>(
    () => ({
      click: (params) => {
        const { seriesType, data } = params as { seriesType?: string; data?: unknown[] }
        if (seriesType !== 'bar' || !data) return
        setFilters({ ...filters, defectTypes: toggleValue(filters.defectTypes, data[0] as DefectType, DEFECT_TYPES) })
      },
    }),
    [filters, setFilters],
  )

  return (
    <div className="space-y-4">
      <title>{appConfig.title}</title>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold">Inspection results</h1>
        <p className="text-sm text-muted" aria-live="polite">
          {matchingUnits.length.toLocaleString()} of {units.length.toLocaleString()} {appConfig.record.plural}
          {matchingYield !== null && ` · ${matchingYield.toFixed(1)}% yield`} · {matchingDefects.length.toLocaleString()}{' '}
          defects
        </p>
      </div>

      <div role="group" aria-label="Filters" className="flex flex-wrap items-center gap-2">
        <FilterSelect
          label="Line"
          options={LINES}
          names={appConfig.lines}
          selected={filters.lines}
          onChange={(lines) => setFilters({ ...filters, lines })}
        />
        <FilterSelect
          label="Station"
          options={STATIONS}
          names={appConfig.stations}
          selected={filters.stations}
          onChange={(stations) => setFilters({ ...filters, stations })}
        />
        <FilterSelect
          label="Result"
          options={RESULTS}
          names={appConfig.results}
          selected={filters.results}
          onChange={(results) => setFilters({ ...filters, results })}
        />
        <FilterSelect
          label="Defect"
          options={DEFECT_TYPES}
          names={appConfig.defectTypes}
          selected={filters.defectTypes}
          onChange={(defectTypes) => setFilters({ ...filters, defectTypes })}
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
          title="First-pass yield by day"
          hint="Drag to select dates"
          table={<YieldTable rows={yieldRows} />}
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
          title="Defects by type"
          hint="Click a bar to filter"
          table={
            <ParetoTable
              rows={paretoRows}
              names={appConfig.defectTypes}
              category="Defect type"
              selected={filters.defectTypes}
              onToggle={toggleDefectType}
            />
          }
          action={
            filters.defectTypes.length > 0 && (
              <button
                type="button"
                onClick={() => setFilters({ ...filters, defectTypes: [] })}
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

      <BoardGrid units={matchingUnits} total={units.length} />
    </div>
  )
}
