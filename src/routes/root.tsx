import { useEffect, useRef } from 'react'
import { Link, Outlet, isRouteErrorResponse, useLocation, useNavigation, useRouteError } from 'react-router'

const shell = 'mx-auto max-w-6xl px-4 py-4'

/**
 * After client-side navigation to a new page, move focus to its heading so keyboard and
 * screen-reader users start at the new content. Query-string changes (filters) keep focus where it is.
 */
function useFocusHeadingOnNavigate(container: React.RefObject<HTMLElement | null>) {
  const { pathname } = useLocation()
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    const heading = container.current?.querySelector('h1')
    if (!heading) return
    heading.setAttribute('tabindex', '-1')
    heading.focus()
  }, [pathname, container])
}

export function RootLayout() {
  const mainRef = useRef<HTMLElement>(null)
  const navigation = useNavigation()
  useFocusHeadingOnNavigate(mainRef)

  return (
    <>
      <a
        href="#main"
        className="sr-only rounded-md bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50"
      >
        Skip to content
      </a>
      {navigation.state === 'loading' && (
        <div role="status" className="fixed inset-x-0 top-0 z-40 h-0.5 animate-pulse bg-accent">
          <span className="sr-only">Loading…</span>
        </div>
      )}
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <Link to="/" className="font-semibold text-text">
            Line Inspector
          </Link>
        </div>
      </header>
      <main id="main" ref={mainRef} tabIndex={-1} className={`${shell} focus:outline-none`}>
        <Outlet />
      </main>
    </>
  )
}

export function RootLoading() {
  return (
    <div className={`${shell} space-y-4`} role="status" aria-label="Loading inspection data">
      <div className="h-7 w-48 animate-pulse rounded bg-border/50" />
      <div className="h-8 w-80 animate-pulse rounded bg-border/40" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-[340px] animate-pulse rounded-lg bg-border/30" />
        <div className="h-[340px] animate-pulse rounded-lg bg-border/30" />
      </div>
    </div>
  )
}

export function RootError() {
  const error = useRouteError()
  return (
    <div className={shell}>
      <title>Error · Line Inspector</title>
      <ErrorPanel title="The inspection data couldn't be loaded" error={error} />
    </div>
  )
}

/** Shared error message with a retry; used by the root route and detail pages. */
export function ErrorPanel({ title, error }: { title: string; error: unknown }) {
  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Unknown error'
  return (
    <div role="alert" className="space-y-3 rounded-lg border border-danger/50 bg-surface p-6">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-muted">
        Check your connection and try again. If it keeps happening, the data files may be missing from this deployment.
      </p>
      <p className="font-mono text-xs text-muted">{detail}</p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md bg-accent px-3 py-1.5 text-sm text-accent-contrast"
        >
          Retry
        </button>
        <Link to="/" className="px-1 py-1.5 text-sm">
          Back to the dashboard
        </Link>
      </div>
    </div>
  )
}
