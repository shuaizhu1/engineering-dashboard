import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'
import { Link, useLocation } from 'react-router'
import { appConfig } from '../config'
import type { Unit } from '../data/types'

const ROW_HEIGHT = 37
const VISIBLE_ROWS = 12
const COLUMNS = 'grid-cols-[120px_100px_100px_minmax(190px,1fr)_100px_90px]'

const dateFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
})

const cell = 'truncate px-3 py-2'
const numericCell = `${cell} text-right tabular-nums`
const { record } = appConfig

/**
 * Matching boards as a virtualized grid: only the rows in view (plus a small overscan) are in the
 * DOM, so thousands of rows scroll smoothly. ARIA table roles keep it a table for screen readers.
 */
export function BoardGrid({ units, total }: { units: Unit[]; total: number }) {
  const { search } = useLocation()
  const scrollRef = useRef<HTMLDivElement>(null)
  // The warning concerns React Compiler memoization, which this project doesn't use.
  // oxlint-disable-next-line react/incompatible-library
  const virtualizer = useVirtualizer({
    count: units.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

  if (units.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-surface p-8 text-center">
        <h2 className="font-semibold">No {record.plural} match these filters</h2>
        <p className="mt-1 text-sm text-muted">
          Try removing a filter. {total.toLocaleString()} {record.plural} are available.
        </p>
      </section>
    )
  }

  const height = Math.min(units.length, VISIBLE_ROWS) * ROW_HEIGHT

  return (
    <section className="rounded-lg border border-border bg-surface">
      <h2 className="sr-only">Matching {record.plural}</h2>
      <div role="table" aria-label={`Matching ${record.plural}`} aria-rowcount={units.length + 1} className="text-sm">
        <div role="rowgroup">
          <div role="row" aria-rowindex={1} className={`grid ${COLUMNS} border-b border-border text-muted`}>
            <span role="columnheader" className={`${cell} font-medium`}>Serial</span>
            <span role="columnheader" className={`${cell} font-medium`}>Line</span>
            <span role="columnheader" className={`${cell} font-medium`}>Station</span>
            <span role="columnheader" className={`${cell} font-medium`}>Inspected (UTC)</span>
            <span role="columnheader" className={`${cell} font-medium`}>Result</span>
            <span role="columnheader" className={`${numericCell} font-medium`}>Defects</span>
          </div>
        </div>
        {/* Focusable so the list can be scrolled with the keyboard. */}
        <div ref={scrollRef} role="rowgroup" tabIndex={0} className="overflow-y-auto" style={{ height }}>
          <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((item) => {
              const u = units[item.index]
              return (
                <div
                  key={u.serial}
                  role="row"
                  aria-rowindex={item.index + 2}
                  className={`absolute inset-x-0 top-0 grid ${COLUMNS} border-b border-border hover:bg-border/30`}
                  style={{ height: ROW_HEIGHT, transform: `translateY(${item.start}px)` }}
                >
                  <span role="cell" className={`${cell} font-mono`}>
                    <Link to={{ pathname: `/units/${u.serial}`, search }}>{u.serial}</Link>
                  </span>
                  <span role="cell" className={cell}>
                    {appConfig.lines[u.line]}
                  </span>
                  <span role="cell" className={cell}>
                    {appConfig.stations[u.station]}
                  </span>
                  <span role="cell" className={cell}>
                    {dateFormat.format(u.inspectedAt)}
                  </span>
                  <span role="cell" className={cell}>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        className="size-2 rounded-full"
                        style={{ background: appConfig.resultColors[u.result] }}
                      />
                      {appConfig.results[u.result]}
                    </span>
                  </span>
                  <span role="cell" className={numericCell}>
                    {u.defectCount}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <p className="border-t border-border px-3 py-2 text-xs text-muted">
        {units.length.toLocaleString()} {units.length === 1 ? record.singular : record.plural}
      </p>
    </section>
  )
}
