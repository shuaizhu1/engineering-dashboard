import { Suspense, lazy, useMemo } from 'react'
import {
  Link,
  useLoaderData,
  useLocation,
  useParams,
  type LoaderFunctionArgs,
  type ShouldRevalidateFunctionArgs,
} from 'react-router'
import { buildChannelOption } from '../charts/telemetryOption'
import { loadFlightTelemetry } from '../data/sift'
import { useChartColors } from '../hooks/useChartColors'
import { siftMode } from '../modes/sift'
import { useSiftData } from './root-data'

const EChart = lazy(() => import('../charts/EChart'))

export function loader({ params }: LoaderFunctionArgs) {
  return loadFlightTelemetry(params.flightId ?? '')
}

/** Telemetry depends only on the flight, not on the dashboard filters carried in the query string. */
export function shouldRevalidate({ currentParams, nextParams }: ShouldRevalidateFunctionArgs) {
  return currentParams.flightId !== nextParams.flightId
}

/** Flight detail route; lazy-loaded so it ships in its own chunk. */
export function Component() {
  const { flightId } = useParams()
  const { search } = useLocation()
  const telemetry = useLoaderData<typeof loader>()
  const { flights, events } = useSiftData()
  const flight = flights.find((f) => f.flightId === flightId)
  const flightEvents = useMemo(() => events.filter((e) => e.flightId === flightId), [events, flightId])
  const colors = useChartColors()

  const vibrationOption = useMemo(
    () =>
      telemetry &&
      buildChannelOption({ tS: telemetry.tS, values: telemetry.channels.vib_ms2 }, flightEvents, {
        name: 'Vibration',
        unit: 'm/s²',
        eventTypes: ['vibration_high', 'vibration_spike'],
        colors,
      }),
    [telemetry, flightEvents, colors],
  )

  if (!flight || !vibrationOption) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Flight not found</h1>
        <Link to={{ pathname: '/', search }}>Back to results</Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Link to={{ pathname: '/', search }} className="text-sm">
        ← Back to results
      </Link>
      <div>
        <h1 className="font-mono text-xl font-semibold">Flight {flight.flightId.slice(0, 8)}</h1>
        <p className="text-sm text-muted">
          {siftMode.labels[flight.label]} · {flight.swVersion ?? 'unknown firmware'} ·{' '}
          {flight.hardware ?? 'unknown hardware'} · {flightEvents.length} events
        </p>
      </div>
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-2 text-sm font-semibold">Vibration</h2>
        <Suspense
          fallback={<div className="h-80 animate-pulse rounded bg-border/40" role="status" aria-label="Loading chart" />}
        >
          <EChart option={vibrationOption} />
        </Suspense>
      </section>
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-2 text-sm font-semibold">Events</h2>
        {flightEvents.length === 0 ? (
          <p className="text-sm text-muted">No events detected in this flight.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {flightEvents.map((e) => (
              <li key={e.eventId}>
                <span className="font-medium">{siftMode.eventTypes[e.type]}</span> at {e.startS.toFixed(1)}–
                {e.endS.toFixed(1)} s, peak {e.peak.toFixed(2)} {e.unit}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
