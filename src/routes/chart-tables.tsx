import type { DailyYield, ParetoRow } from '../filters/aggregate'

// Table views of the dashboard charts: the same data as text, for screen readers, keyboard users
// and anyone who wants exact values.

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' })

const wrapper = 'max-h-[280px] overflow-auto rounded border border-border'
const th = 'sticky top-0 bg-surface px-3 py-1.5 text-left font-medium text-muted'
const td = 'px-3 py-1.5'

/** Daily yield, newest first. */
export function YieldTable({ rows }: { rows: DailyYield[] }) {
  if (rows.length === 0) {
    return <p className="flex h-[280px] items-center justify-center text-sm text-muted">No boards match these filters.</p>
  }

  return (
    <div className={wrapper}>
      <table className="w-full text-sm">
        <caption className="sr-only">First-pass yield by day, newest first</caption>
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className={th}>Day (UTC)</th>
            <th scope="col" className={`${th} text-right`}>Inspected</th>
            <th scope="col" className={`${th} text-right`}>Passed</th>
            <th scope="col" className={`${th} text-right`}>Yield</th>
          </tr>
        </thead>
        <tbody>
          {[...rows].reverse().map((r) => (
            <tr key={r.day} className="border-b border-border last:border-0">
              <td className={td}>{dateFormat.format(r.day)}</td>
              <td className={`${td} text-right tabular-nums`}>{r.inspected}</td>
              <td className={`${td} text-right tabular-nums`}>{r.passed}</td>
              <td className={`${td} text-right tabular-nums`}>{r.yieldPct === null ? '—' : `${r.yieldPct.toFixed(1)}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface ParetoTableProps<T extends string> {
  rows: ParetoRow<T>[]
  names: Record<T, string>
  /** Column heading for the category, e.g. "Defect type". */
  category: string
  selected: readonly T[]
  onToggle: (key: T) => void
}

/** Counts by category; each row's button toggles that category in the filter, like clicking its bar. */
export function ParetoTable<T extends string>({ rows, names, category, selected, onToggle }: ParetoTableProps<T>) {
  return (
    <div className={wrapper}>
      <table className="w-full text-sm">
        <caption className="sr-only">{category} counts, most frequent first</caption>
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className={th}>{category}</th>
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
                  {names[r.key]}
                </th>
                <td className={`${td} text-right tabular-nums`}>{r.count}</td>
                <td className={`${td} text-right tabular-nums`}>{r.cumulativePct.toFixed(0)}%</td>
                <td className={`${td} text-right`}>
                  <button
                    type="button"
                    aria-pressed={active}
                    aria-label={`Filter by ${names[r.key]}`}
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
