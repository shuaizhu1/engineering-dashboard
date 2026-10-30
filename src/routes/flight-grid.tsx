import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'
import { Link, useLocation } from 'react-router'
import { shortFlightId } from '../data/stress'
import type { Flight } from '../data/types'
import { siftMode } from '../modes/sift'

const ROW_HEIGHT = 37
const VISIBLE_ROWS = 12
const COLUMNS = 'grid-cols-[150px_minmax(140px,1fr)_190px_120px_170px_80px]'

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

const cell = 'truncate px-3 py-2'
const numericCell = `${cell} text-right tabular-nums`

/**
 * Matching flights as a virtualized grid: only the rows in view (plus a small overscan) are in the
 * DOM, so thousands of rows scroll smoothly. ARIA table roles keep it a table for screen readers.
 */
export function FlightGrid({ flights, total }: { flights: Flight[]; total: number }) {
  const { search } = useLocation()
  const scrollRef = useRef<HTMLDivElement>(null)
  // The warning concerns React Compiler memoization, which this project doesn't use.
  // oxlint-disable-next-line react/incompatible-library
  const virtualizer = useVirtualizer({
    count: flights.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

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

  const height = Math.min(flights.length, VISIBLE_ROWS) * ROW_HEIGHT

  return (
    <section className="rounded-lg border border-border bg-surface">
      <h2 className="sr-only">Matching {siftMode.record.plural}</h2>
      <div role="table" aria-label={`Matching ${siftMode.record.plural}`} aria-rowcount={flights.length + 1} className="text-sm">
        <div role="rowgroup">
          <div role="row" aria-rowindex={1} className={`grid ${COLUMNS} border-b border-border text-muted`}>
            <span role="columnheader" className={`${cell} font-medium`}>Flight</span>
            <span role="columnheader" className={`${cell} font-medium`}>Label</span>
            <span role="columnheader" className={`${cell} font-medium`}>Started (UTC)</span>
            <span role="columnheader" className={`${cell} font-medium`}>Airborne</span>
            <span role="columnheader" className={`${numericCell} font-medium`}>Max vibration (m/s²)</span>
            <span role="columnheader" className={`${numericCell} font-medium`}>Events</span>
          </div>
        </div>
        {/* Focusable so the list can be scrolled with the keyboard. */}
        <div ref={scrollRef} role="rowgroup" tabIndex={0} className="overflow-y-auto" style={{ height }}>
          <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((item) => {
              const f = flights[item.index]
              return (
                <div
                  key={f.flightId}
                  role="row"
                  aria-rowindex={item.index + 2}
                  className={`absolute inset-x-0 top-0 grid ${COLUMNS} border-b border-border hover:bg-border/30`}
                  style={{ height: ROW_HEIGHT, transform: `translateY(${item.start}px)` }}
                >
                  <span role="cell" className={`${cell} font-mono`}>
                    <Link to={{ pathname: `/flights/${f.flightId}`, search }}>{shortFlightId(f.flightId)}</Link>
                  </span>
                  <span role="cell" className={cell}>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        className="size-2 rounded-full"
                        style={{ background: siftMode.labelColors[f.label] }}
                      />
                      {siftMode.labels[f.label]}
                    </span>
                  </span>
                  <span role="cell" className={cell}>
                    {f.startedAt === null ? '—' : dateFormat.format(f.startedAt)}
                  </span>
                  <span role="cell" className={cell}>
                    {formatDuration(f.airborneS)}
                  </span>
                  <span role="cell" className={numericCell}>
                    {f.maxVibMs2.toFixed(1)}
                  </span>
                  <span role="cell" className={numericCell}>
                    {f.eventCount}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <p className="border-t border-border px-3 py-2 text-xs text-muted">
        {flights.length.toLocaleString()} {flights.length === 1 ? siftMode.record.singular : siftMode.record.plural}
      </p>
    </section>
  )
}
