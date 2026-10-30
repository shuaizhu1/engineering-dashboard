import { Link, useLocation } from 'react-router'
import { shortFlightId } from '../data/stress'
import type { EventType, Flight } from '../data/types'
import type { ParetoRow } from '../filters/aggregate'
import { siftMode } from '../modes/sift'

// Table views of the dashboard charts: the same data as text, for screen readers, keyboard users
// and anyone who wants exact values.

const TABLE_ROW_LIMIT = 100

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' })

const wrapper = 'max-h-[280px] overflow-auto rounded border border-border'
const th = 'sticky top-0 bg-surface px-3 py-1.5 text-left font-medium text-muted'
const td = 'px-3 py-1.5'

export function TrendTable({ flights }: { flights: Flight[] }) {
  const { search } = useLocation()
  const dated = flights.filter((f) => f.startedAt !== null).sort((a, b) => b.startedAt! - a.startedAt!)
  const shown = dated.slice(0, TABLE_ROW_LIMIT)

  if (dated.length === 0) {
    return <p className="flex h-[280px] items-center justify-center text-sm text-muted">No flights with a start time match these filters.</p>
  }

  return (
    <div className={wrapper}>
      <table className="w-full text-sm">
        <caption className="sr-only">Maximum vibration per flight, newest first</caption>
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className={th}>Started (UTC)</th>
            <th scope="col" className={th}>Flight</th>
            <th scope="col" className={th}>Label</th>
            <th scope="col" className={`${th} text-right`}>Max vibration (m/s²)</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((f) => (
            <tr key={f.flightId} className="border-b border-border last:border-0">
              <td className={td}>{dateFormat.format(f.startedAt!)}</td>
              <td className={`${td} font-mono`}>
                <Link to={{ pathname: `/flights/${f.flightId}`, search }}>{shortFlightId(f.flightId)}</Link>
              </td>
              <td className={td}>{siftMode.labels[f.label]}</td>
              <td className={`${td} text-right tabular-nums`}>{f.maxVibMs2.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {dated.length > TABLE_ROW_LIMIT && (
        <p className="px-3 py-1.5 text-xs text-muted">
          Showing the newest {TABLE_ROW_LIMIT} of {dated.length.toLocaleString()} flights.
        </p>
      )}
    </div>
  )
}

interface ParetoTableProps {
  rows: ParetoRow<EventType>[]
  selected: readonly EventType[]
  onToggle: (type: EventType) => void
}

/** Event counts by type; each row's button toggles that type in the filter, like clicking its bar. */
export function ParetoTable({ rows, selected, onToggle }: ParetoTableProps) {
  return (
    <div className={wrapper}>
      <table className="w-full text-sm">
        <caption className="sr-only">Events by type, most frequent first</caption>
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className={th}>Event type</th>
            <th scope="col" className={`${th} text-right`}>Count</th>
            <th scope="col" className={`${th} text-right`}>Cumulative %</th>
            <th scope="col" className={th}>
              <span className="sr-only">Filter</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const active = selected.includes(r.key)
            return (
              <tr key={r.key} className="border-b border-border last:border-0">
                <th scope="row" className={`${td} text-left font-normal`}>
                  {siftMode.eventTypes[r.key]}
                </th>
                <td className={`${td} text-right tabular-nums`}>{r.count}</td>
                <td className={`${td} text-right tabular-nums`}>{r.cumulativePct.toFixed(0)}%</td>
                <td className={`${td} text-right`}>
                  <button
                    type="button"
                    aria-pressed={active}
                    aria-label={`Filter by ${siftMode.eventTypes[r.key]}`}
                    onClick={() => onToggle(r.key)}
                    className={`rounded border px-2 py-0.5 text-xs ${
                      active ? 'border-accent bg-accent text-accent-contrast' : 'border-border hover:border-muted'
                    }`}
                  >
                    {active ? 'Filtered' : 'Filter'}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
