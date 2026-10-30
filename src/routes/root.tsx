import { Link, Outlet, isRouteErrorResponse, useRouteError } from 'react-router'

const shell = 'mx-auto max-w-6xl px-4 py-4'

export function RootLayout() {
  return (
    <>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <Link to="/" className="font-semibold text-text">
            Engineering Data Explorer
          </Link>
        </div>
      </header>
      <main className={shell}>
        <Outlet />
      </main>
    </>
  )
}

export function RootLoading() {
  return (
    <div className={shell}>
      <p role="status" className="text-muted">
        Loading flight data…
      </p>
    </div>
  )
}

export function RootError() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Unknown error'
  return (
    <div className={`${shell} space-y-2`} role="alert">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-muted">{message}</p>
      <Link to="/">Back to the dashboard</Link>
    </div>
  )
}
