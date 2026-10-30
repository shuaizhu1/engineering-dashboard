import { Link, Outlet, isRouteErrorResponse, useRouteError } from 'react-router'

export function RootLayout() {
  return (
    <div className="app">
      <header className="app-header">
        <Link to="/">Engineering Data Explorer</Link>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}

export function RootLoading() {
  return (
    <div className="app">
      <p role="status">Loading flight data…</p>
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
    <div className="app" role="alert">
      <h1>Something went wrong</h1>
      <p>{message}</p>
      <Link to="/">Back to the dashboard</Link>
    </div>
  )
}
