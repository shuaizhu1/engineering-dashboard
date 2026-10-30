import * as Tabs from '@radix-ui/react-tabs'
import type { ReactNode } from 'react'

export interface View {
  value: string
  label: string
  content: ReactNode
}

interface ViewTabsProps {
  /** Accessible name for the tab list, e.g. "Max vibration per flight view". */
  label: string
  views: View[]
  /** Rendered on the same row as the tab list, before it. */
  heading: ReactNode
  /** Extra controls between the heading and the tab list. */
  action?: ReactNode
}

/** Our one wrapper around Radix Tabs: a small segmented switch between views of the same data. */
export function ViewTabs({ label, views, heading, action }: ViewTabsProps) {
  return (
    <Tabs.Root defaultValue={views[0].value}>
      <div className="mb-2 flex items-center justify-between gap-2">
        {heading}
        <div className="flex items-center gap-3">
          {action}
          <Tabs.List aria-label={label} className="inline-flex rounded-md border border-border p-0.5 text-xs">
            {views.map((v) => (
              <Tabs.Trigger
                key={v.value}
                value={v.value}
                className="rounded px-2 py-0.5 text-muted hover:text-text data-[state=active]:bg-border/60 data-[state=active]:text-text"
              >
                {v.label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </div>
      </div>
      {views.map((v) => (
        <Tabs.Content key={v.value} value={v.value}>
          {v.content}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  )
}
