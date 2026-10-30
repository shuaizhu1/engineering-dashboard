import { Suspense, lazy, useMemo } from 'react'
import {
  Link,
  useLoaderData,
  useParams,
  useSearchParams,
  type LoaderFunctionArgs,
  type ShouldRevalidateFunctionArgs,
} from 'react-router'
import { buildSyncedChannelsOption, panelsWithData, syncedChartHeight } from '../charts/telemetryOption'
import { loadFlightTelemetry } from '../data/sift'
import type { Flight, FlightEvent } from '../data/types'
import { filterFlights, parseFilters } from '../filters/filters'
import { neighbors } from '../filters/navigation'
import { useChartColors } from '../hooks/useChartColors'
import { siftMode } from '../modes/sift'
import { useSiftData } from './root-data'

const EChart = lazy(() => import('../charts/EChart'))

/** Query parameter holding the event the detail view is zoomed to. */
const FOCUS_PARAM = 'focus'

export function loader({ params }: LoaderFunctionArgs) {
  return loadFlightTelemetry(params.flightId ?? '')
}

/** Telemetry depends only on the flight, not on the dashboard filters or focus in the query string. */
export function shouldRevalidate({ currentParams, nextParams }: ShouldRevalidateFunctionArgs) {
  return currentParams.flightId !== nextParams.flightId
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return m > 0 ? `${m} min ${s} s` : `${s} s`
}

/** Flight detail route: synced telemetry panels around the flight's events. Lazy-loaded. */
export function Component() {
  const { flightId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const telemetry = useLoaderData<typeof loader>()
  const { flights, events } = useSiftData()
  const colors = useChartColors()

  // Dashboard filters ride along in the query string; without the focus they form the "results" link.
  const listSearch = useMemo(() => {
    const params = new URLSearchParams(searchParams)
    params.delete(FOCUS_PARAM)
    const search = params.toString()
    return search ? `?${search}` : ''
  }, [searchParams])

  const flight = flights.find((f) => f.flightId === flightId)
  const flightEvents = useMemo(() => events.filter((e) => e.flightId === flightId), [events, flightId])
  const focusId = searchParams.get(FOCUS_PARAM)
  const focus = useMemo(() => flightEvents.find((e) => e.eventId === focusId) ?? null, [flightEvents, focusId])

  const results = useMemo(
    () => filterFlights(flights, events, parseFilters(searchParams)),
    [flights, events, searchParams],
  )
  const position = neighbors(results, (f) => f.flightId === flightId)

  const shownPanels = useMemo(
    () => (telemetry ? panelsWithData(telemetry, siftMode.channelPanels) : []),
    [telemetry],
  )
  const option = useMemo(
    () =>
      telemetry &&
      buildSyncedChannelsOption(telemetry, flightEvents, {
        panels: siftMode.channelPanels,
        eventNames: siftMode.eventTypes,
        seriesColors: siftMode.seriesColors,
        focus,
        colors,
      }),
    [telemetry, flightEvents, focus, colors],
  )

  const setFocus = (event: FlightEvent | null) =>
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (event) next.set(FOCUS_PARAM, event.eventId)
      else next.delete(FOCUS_PARAM)
      return next
    })

  if (!flight || !telemetry || !option) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Flight not found</h1>
        <p className="text-sm text-muted">There is no flight with the id “{flightId}”.</p>
        <Link to={{ pathname: '/', search: listSearch }}>Back to results</Link>
      </div>
    )
  }

  const chartHeight = syncedChartHeight(shownPanels.length)
  const missing = siftMode.channelPanels.filter((p) => !shownPanels.some((s) => s.title === p.title))

  return (
    <div className="space-y-4">
      <nav aria-label="Flight navigation" className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link to={{ pathname: '/', search: listSearch }}>← Back to results</Link>
        <FlightPager
          prev={position.prev}
          next={position.next}
          index={position.index}
          total={results.length}
          search={listSearch}
        />
      </nav>

      <header className="space-y-1">
        <h1 className="flex items-center gap-3 text-xl font-semibold">
          <span className="font-mono">Flight {flight.flightId.slice(0, 8)}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs font-medium">
            <span
              aria-hidden="true"
              className="size-2 rounded-full"
              style={{ background: siftMode.labelColors[flight.label] }}
            />
            {siftMode.labels[flight.label]}
          </span>
        </h1>
        <p className="text-sm text-muted">
          {flight.hardware ?? 'Unknown hardware'} · {flight.swVersion ?? 'unknown firmware'} ·{' '}
          {flight.startedAt === null ? 'no GPS time' : `${dateFormat.format(flight.startedAt)} UTC`}
        </p>
      </header>

      <dl className="grid grid-cols-4 gap-3">
        <Stat label="Airborne" value={formatDuration(flight.airborneS)} />
        <Stat label="Max vibration" value={`${flight.maxVibMs2.toFixed(1)} m/s²`} />
        <Stat label="Min battery" value={flight.minBatteryV === null ? '—' : `${flight.minBatteryV.toFixed(1)} V`} />
        <Stat label="Events" value={String(flightEvents.length)} />
      </dl>

      <div className="grid grid-cols-[minmax(0,1fr)_300px] items-start gap-4">
        <section className="rounded-lg border border-border bg-surface p-4">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">
              Telemetry
              <span className="ml-2 font-normal text-muted">Drag to pan · Ctrl+scroll or pinch to zoom</span>
            </h2>
            {focus && (
              <button type="button" onClick={() => setFocus(null)} className="text-sm text-accent hover:underline">
                Show whole flight
              </button>
            )}
          </div>
          <Suspense
            fallback={
              <div
                className="animate-pulse rounded bg-border/40"
                style={{ height: chartHeight }}
                role="status"
                aria-label="Loading chart"
              />
            }
          >
            <EChart option={option} style={{ height: chartHeight }} />
          </Suspense>
          {missing.length > 0 && (
            <p className="mt-2 text-xs text-muted">
              Not logged in this flight: {missing.map((p) => p.title).join(', ')}.
            </p>
          )}
        </section>

        <EventList events={flightEvents} focus={focus} onSelect={setFocus} />
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-base font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

interface FlightPagerProps {
  prev: Flight | null
  next: Flight | null
  index: number
  total: number
  search: string
}

/** Previous/next through the dashboard's current results, keeping its filters. */
function FlightPager({ prev, next, index, total, search }: FlightPagerProps) {
  if (index === -1) return <span className="text-muted">Not in the current results</span>
  const linkClass = 'rounded-md border border-border bg-surface px-2.5 py-1 hover:border-muted hover:no-underline'
  const disabledClass = 'rounded-md border border-border px-2.5 py-1 text-muted opacity-50'
  return (
    <div className="flex items-center gap-2">
      {prev ? (
        <Link
          to={{ pathname: `/flights/${prev.flightId}`, search }}
          className={linkClass}
          aria-label={`Previous flight, ${prev.flightId.slice(0, 8)}`}
        >
          ← Prev
        </Link>
      ) : (
        <span className={disabledClass} aria-disabled="true">
          ← Prev
        </span>
      )}
      <span className="text-muted tabular-nums">
        {index + 1} of {total}
      </span>
      {next ? (
        <Link
          to={{ pathname: `/flights/${next.flightId}`, search }}
          className={linkClass}
          aria-label={`Next flight, ${next.flightId.slice(0, 8)}`}
        >
          Next →
        </Link>
      ) : (
        <span className={disabledClass} aria-disabled="true">
          Next →
        </span>
      )}
    </div>
  )
}

interface EventListProps {
  events: FlightEvent[]
  focus: FlightEvent | null
  onSelect: (event: FlightEvent) => void
}

/** Clicking an event zooms every telemetry panel to it. */
function EventList({ events, focus, onSelect }: EventListProps) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="mb-2 text-sm font-semibold">
        Events <span className="font-normal text-muted">({events.length})</span>
      </h2>
      {events.length === 0 ? (
        <p className="text-sm text-muted">No events detected in this flight.</p>
      ) : (
        <ul className="-mx-2 max-h-[640px] space-y-0.5 overflow-y-auto">
          {events.map((e) => {
            const selected = focus?.eventId === e.eventId
            return (
              <li key={e.eventId}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelect(e)}
                  className={`w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-border/40 ${
                    selected ? 'bg-accent/15 ring-1 ring-accent' : ''
                  }`}
                >
                  <span className="block font-medium">{siftMode.eventTypes[e.type]}</span>
                  <span className="block text-xs text-muted tabular-nums">
                    {e.startS.toFixed(1)}–{e.endS.toFixed(1)} s · peak {e.peak.toFixed(2)} {e.unit}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
