import { useId } from 'react'
import { Popover, filterButtonClass } from './Popover'

interface DateRangeFilterProps {
  label: string
  /** `YYYY-MM-DD` or null. */
  from: string | null
  to: string | null
  onChange: (from: string | null, to: string | null) => void
}

function summary(from: string | null, to: string | null): string {
  if (from && to) return from === to ? from : `${from} – ${to}`
  if (from) return `from ${from}`
  if (to) return `until ${to}`
  return 'Any time'
}

const inputClass = 'rounded-md border border-border bg-surface px-2 py-1 text-sm text-text'

/** Date range filter with native date inputs (UTC days, both ends inclusive). */
export function DateRangeFilter({ label, from, to, onChange }: DateRangeFilterProps) {
  const id = useId()
  return (
    <Popover
      label={`${label} filter`}
      trigger={
        <button type="button" className={filterButtonClass}>
          <span className="text-muted">{label}:</span>
          <span className={from || to ? 'font-medium' : undefined}>{summary(from, to)}</span>
          <span aria-hidden="true" className="text-muted">
            ▾
          </span>
        </button>
      }
    >
      <fieldset className="space-y-2">
        <legend className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">{label} (UTC)</legend>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor={`${id}-from`} className="text-sm">
            From
          </label>
          <input
            id={`${id}-from`}
            type="date"
            className={inputClass}
            value={from ?? ''}
            max={to ?? undefined}
            onChange={(e) => onChange(e.target.value || null, to)}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor={`${id}-to`} className="text-sm">
            To
          </label>
          <input
            id={`${id}-to`}
            type="date"
            className={inputClass}
            value={to ?? ''}
            min={from ?? undefined}
            onChange={(e) => onChange(from, e.target.value || null)}
          />
        </div>
      </fieldset>
      {(from || to) && (
        <button type="button" onClick={() => onChange(null, null)} className="mt-3 text-sm text-accent hover:underline">
          Clear
        </button>
      )}
    </Popover>
  )
}
