import * as Checkbox from '@radix-ui/react-checkbox'
import { useId } from 'react'
import { Popover, filterButtonClass } from './Popover'

interface FilterSelectProps<T extends string> {
  label: string
  options: readonly T[]
  names: Record<T, string>
  selected: readonly T[]
  onChange: (selected: T[]) => void
}

function summary<T extends string>(selected: readonly T[], names: Record<T, string>): string {
  if (selected.length === 0) return 'All'
  if (selected.length === 1) return names[selected[0]]
  return `${selected.length} selected`
}

/** Multi-select filter: a button that opens a checkbox list. Selecting nothing means "all". */
export function FilterSelect<T extends string>({ label, options, names, selected, onChange }: FilterSelectProps<T>) {
  const id = useId()
  const toggle = (option: T, checked: boolean) =>
    onChange(options.filter((o) => (o === option ? checked : selected.includes(o))))

  return (
    <Popover
      label={`${label} filter`}
      trigger={
        <button type="button" className={filterButtonClass}>
          <span className="text-muted">{label}:</span>
          <span className={selected.length ? 'font-medium' : undefined}>{summary(selected, names)}</span>
          <span aria-hidden="true" className="text-muted">
            ▾
          </span>
        </button>
      }
    >
      <fieldset>
        <legend className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">{label}</legend>
        <ul className="space-y-1">
          {options.map((option) => {
            const checkboxId = `${id}-${option}`
            return (
              <li key={option} className="flex items-center gap-2">
                <Checkbox.Root
                  id={checkboxId}
                  checked={selected.includes(option)}
                  onCheckedChange={(checked) => toggle(option, checked === true)}
                  className="flex size-4 items-center justify-center rounded border border-muted bg-surface data-[state=checked]:border-accent data-[state=checked]:bg-accent"
                >
                  <Checkbox.Indicator className="text-[11px] leading-none text-accent-contrast">✓</Checkbox.Indicator>
                </Checkbox.Root>
                <label htmlFor={checkboxId} className="cursor-pointer text-sm">
                  {names[option]}
                </label>
              </li>
            )
          })}
        </ul>
      </fieldset>
      {selected.length > 0 && (
        <button type="button" onClick={() => onChange([])} className="mt-3 text-sm text-accent hover:underline">
          Clear
        </button>
      )}
    </Popover>
  )
}
