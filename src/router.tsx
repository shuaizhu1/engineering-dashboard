import { createBrowserRouter } from 'react-router'
import { Dashboard } from './routes/dashboard'
import { NotFound } from './routes/not-found'
import { RootError, RootLayout, RootLoading } from './routes/root'
import { ROOT_ROUTE_ID, rootLoader, rootShouldRevalidate } from './routes/root-data'

export const router = createBrowserRouter([
  {
    id: ROOT_ROUTE_ID,
    path: '/',
    loader: rootLoader,
    shouldRevalidate: rootShouldRevalidate,
    Component: RootLayout,
    HydrateFallback: RootLoading,
    ErrorBoundary: RootError,
    children: [
      { index: true, Component: Dashboard },
      { path: 'flights/:flightId', lazy: () => import('./routes/flight') },
      { path: '*', Component: NotFound },
    ],
  },
])
