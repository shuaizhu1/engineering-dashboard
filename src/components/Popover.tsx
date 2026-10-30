import * as RadixPopover from '@radix-ui/react-popover'
import type { ReactNode } from 'react'

interface PopoverProps {
  trigger: ReactNode
  children: ReactNode
  /** Accessible name for the popover panel. */
  label: string
}

/** Our one wrapper around Radix Popover; `trigger` must be a single focusable element. */
export function Popover({ trigger, children, label }: PopoverProps) {
  return (
    <RadixPopover.Root>
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          aria-label={label}
          align="start"
          sideOffset={6}
          className="z-50 min-w-56 rounded-lg border border-border bg-surface p-3 text-text shadow-lg"
        >
          {children}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  )
}

export const filterButtonClass =
  'inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:border-muted data-[state=open]:border-accent'
