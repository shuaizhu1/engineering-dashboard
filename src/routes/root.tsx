import { useEffect, useRef } from 'react'
import { Link, Outlet, isRouteErrorResponse, useLocation, useNavigation, useRouteError } from 'react-router'
import { appConfig } from '../config'

const shell = 'mx-auto max-w-6xl px-4 py-4'

/** The GitHub mark (octicon mark-github, 16px grid). */
function GitHubIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-5" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}

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
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="font-semibold text-text">
            Line Inspector
          </Link>
          <a
            href={appConfig.repoUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Demo source code on GitHub (opens in a new tab)"
            title="Source code on GitHub"
            className="-mx-2 -my-1 flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-accent hover:underline"
          >
            Demo
            <GitHubIcon />
          </a>
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
