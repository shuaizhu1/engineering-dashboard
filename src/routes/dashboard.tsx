import { Link, useLocation } from 'react-router'
import { useSiftData } from './root-data'

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

export function Dashboard() {
  const { flights, events } = useSiftData()
  const { search } = useLocation()

  return (
    <>
      <h1>Flights</h1>
      <p>
        {flights.length} flights, {events.length} detected events
      </p>
      <table>
        <thead>
          <tr>
            <th scope="col">Flight</th>
            <th scope="col">Label</th>
            <th scope="col">Started (UTC)</th>
            <th scope="col">Duration</th>
            <th scope="col">Max vibration (m/s²)</th>
            <th scope="col">Events</th>
          </tr>
        </thead>
        <tbody>
          {flights.map((f) => (
            <tr key={f.flightId}>
              <td>
                <Link to={{ pathname: `/flights/${f.flightId}`, search }}>{f.flightId.slice(0, 8)}</Link>
              </td>
              <td>{f.label}</td>
              <td>{f.startedAt === null ? '—' : dateFormat.format(f.startedAt)}</td>
              <td>{formatDuration(f.durationS)}</td>
              <td>{f.maxVibMs2.toFixed(1)}</td>
              <td>{f.eventCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
