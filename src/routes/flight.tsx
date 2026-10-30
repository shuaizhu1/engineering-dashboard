import { Suspense, lazy, useMemo } from 'react'
import { Link, useLoaderData, useLocation, useParams, type LoaderFunctionArgs } from 'react-router'
import { buildChannelOption } from '../charts/telemetryOption'
import { loadFlightTelemetry } from '../data/sift'
import { useSiftData } from './root-data'

const EChart = lazy(() => import('../charts/EChart'))

export function loader({ params }: LoaderFunctionArgs) {
  return loadFlightTelemetry(params.flightId ?? '')
}

/** Flight detail route; lazy-loaded so it ships in its own chunk. */
export function Component() {
  const { flightId } = useParams()
  const { search } = useLocation()
  const telemetry = useLoaderData<typeof loader>()
  const { flights, events } = useSiftData()
  const flight = flights.find((f) => f.flightId === flightId)
  const flightEvents = useMemo(() => events.filter((e) => e.flightId === flightId), [events, flightId])

  const vibrationOption = useMemo(
    () =>
      telemetry &&
      buildChannelOption({ tS: telemetry.tS, values: telemetry.channels.vib_ms2 }, flightEvents, {
        name: 'Vibration',
        unit: 'm/s²',
        eventTypes: ['vibration_high', 'vibration_spike'],
      }),
    [telemetry, flightEvents],
  )

  if (!flight || !vibrationOption) {
    return (
      <>
        <h1>Flight not found</h1>
        <Link to={{ pathname: '/', search }}>Back to results</Link>
      </>
    )
  }

  return (
    <>
      <Link to={{ pathname: '/', search }}>Back to results</Link>
      <h1>Flight {flight.flightId.slice(0, 8)}</h1>
      <p>
        {flight.label} · {flight.swVersion ?? 'unknown firmware'} · {flight.hardware ?? 'unknown hardware'} ·{' '}
        {flightEvents.length} events
      </p>
      <h2>Vibration</h2>
      <Suspense fallback={<div className="chart-skeleton" role="status" aria-label="Loading chart" />}>
        <EChart option={vibrationOption} />
      </Suspense>
      <ul>
        {flightEvents.map((e) => (
          <li key={e.eventId}>
            {e.type} at {e.startS.toFixed(1)}–{e.endS.toFixed(1)} s, peak {e.peak.toFixed(2)} {e.unit}
          </li>
        ))}
      </ul>
    </>
  )
}
