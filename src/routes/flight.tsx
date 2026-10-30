import { Link, useLocation, useParams } from 'react-router'
import { useSiftData } from './root-data'

/** Placeholder flight detail route; lazy-loaded so it ships in its own chunk. */
export function Component() {
  const { flightId } = useParams()
  const { search } = useLocation()
  const { flights, events } = useSiftData()
  const flight = flights.find((f) => f.flightId === flightId)

  if (!flight) {
    return (
      <>
        <h1>Flight not found</h1>
        <Link to={{ pathname: '/', search }}>Back to results</Link>
      </>
    )
  }

  const flightEvents = events.filter((e) => e.flightId === flight.flightId)
  return (
    <>
      <Link to={{ pathname: '/', search }}>Back to results</Link>
      <h1>Flight {flight.flightId.slice(0, 8)}</h1>
      <p>
        {flight.label} · {flight.swVersion ?? 'unknown firmware'} · {flightEvents.length} events
      </p>
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
