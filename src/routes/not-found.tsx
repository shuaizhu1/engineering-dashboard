import { Link } from 'react-router'

export function NotFound() {
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <Link to="/">Back to the dashboard</Link>
    </div>
  )
}
