import { Suspense, lazy, useMemo, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { buildParetoOption, buildVibrationTrendOption } from '../charts/dashboardOptions'
import { DateRangeFilter } from '../components/DateRangeFilter'
import { FilterSelect } from '../components/FilterSelect'
import { EVENT_TYPES, FLIGHT_LABELS, type Flight } from '../data/types'
import { eventTypePareto } from '../filters/aggregate'
import { EMPTY_FILTERS, filterEvents, filterFlights, hasActiveFilters } from '../filters/filters'
import { useChartColors } from '../hooks/useChartColors'
import { useFilters } from '../hooks/useFilters'
import { siftMode } from '../modes/sift'
import { useSiftData } from './root-data'

const EChart = lazy(() => import('../charts/EChart'))

/** Phase 1 shows a plain list; virtualization comes with the full dataset. */
const GRID_LIMIT = 100

const dateFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
})

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return m > 0 ? `${m} min ${s} s` : `${s} s`
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      <Suspense fallback={<div className="h-[280px] animate-pulse rounded bg-border/40" role="status" aria-label="Loading chart" />}>
        {children}
      </Suspense>
    </section>
  )
}

export function Dashboard() {
  const { flights, events } = useSiftData()
  const [filters, setFilters] = useFilters()
  const colors = useChartColors()

  const matchingFlights = useMemo(() => filterFlights(flights, events, filters), [flights, events, filters])
  const matchingEvents = useMemo(
    () => filterEvents(events, matchingFlights, filters),
    [events, matchingFlights, filters],
  )

  const trendOption = useMemo(
    () =>
      buildVibrationTrendOption(matchingFlights, {
        labels: siftMode.labels,
        labelColors: siftMode.labelColors,
        thresholdMs2: siftMode.vibrationThresholdMs2,
        colors,
      }),
    [matchingFlights, colors],
  )
  const paretoOption = useMemo(
    () => buildParetoOption(eventTypePareto(matchingEvents, EVENT_TYPES), { names: siftMode.eventTypes, noun: 'events', colors }),
    [matchingEvents, colors],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold">{siftMode.title}</h1>
        <p className="text-sm text-muted" aria-live="polite">
          {matchingFlights.length} of {flights.length} {siftMode.record.plural} · {matchingEvents.length} events
        </p>
      </div>

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
        <ChartCard title="Max vibration per flight">
          <EChart option={trendOption} style={{ height: 280 }} />
        </ChartCard>
        <ChartCard title="Events by type">
          <EChart option={paretoOption} style={{ height: 280 }} />
        </ChartCard>
      </div>

      <FlightGrid flights={matchingFlights} total={flights.length} />
    </div>
  )
}

function FlightGrid({ flights, total }: { flights: Flight[]; total: number }) {
  const { search } = useLocation()

  if (flights.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-surface p-8 text-center">
        <h2 className="font-semibold">No {siftMode.record.plural} match these filters</h2>
        <p className="mt-1 text-sm text-muted">
          Try removing a filter. {total} {siftMode.record.plural} are available.
        </p>
      </section>
    )
  }

  const shown = flights.slice(0, GRID_LIMIT)
  return (
    <section className="overflow-x-auto rounded-lg border border-border bg-surface">
      <h2 className="sr-only">Matching {siftMode.record.plural}</h2>
      <table className="w-full text-left text-sm">
        <thead className="text-muted">
          <tr className="border-b border-border">
            <th scope="col" className="px-3 py-2 font-medium">Flight</th>
            <th scope="col" className="px-3 py-2 font-medium">Label</th>
            <th scope="col" className="px-3 py-2 font-medium">Started (UTC)</th>
            <th scope="col" className="px-3 py-2 font-medium">Duration</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Max vibration (m/s²)</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Events</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((f) => (
            <tr key={f.flightId} className="border-b border-border last:border-0">
              <td className="px-3 py-2 font-mono">
                <Link to={{ pathname: `/flights/${f.flightId}`, search }}>{f.flightId.slice(0, 8)}</Link>
              </td>
              <td className="px-3 py-2">
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-2 rounded-full" style={{ background: siftMode.labelColors[f.label] }} />
                  {siftMode.labels[f.label]}
                </span>
              </td>
              <td className="px-3 py-2">{f.startedAt === null ? '—' : dateFormat.format(f.startedAt)}</td>
              <td className="px-3 py-2">{formatDuration(f.durationS)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{f.maxVibMs2.toFixed(1)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{f.eventCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {flights.length > GRID_LIMIT && (
        <p className="border-t border-border px-3 py-2 text-sm text-muted">
          Showing the first {GRID_LIMIT} of {flights.length}.
        </p>
      )}
    </section>
  )
}
