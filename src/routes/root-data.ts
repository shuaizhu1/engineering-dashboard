import { useRouteLoaderData, type LoaderFunctionArgs } from 'react-router'
import { loadSiftData, type SiftData } from '../data/sift'
import { addStressFlights, parseStressCount } from '../data/stress'

export const ROOT_ROUTE_ID = 'root'

/** User Timing mark set when the dashboard data is ready; Lighthouse and DevTools report it. */
export const DATA_READY_MARK = 'sift-data-ready'

export async function rootLoader({ request }: LoaderFunctionArgs): Promise<SiftData> {
  const data = await loadSiftData()
  const stressed = addStressFlights(data, parseStressCount(new URL(request.url).searchParams))
  performance.mark(DATA_READY_MARK)
  return stressed
}

export function useSiftData(): SiftData {
  const data = useRouteLoaderData<SiftData>(ROOT_ROUTE_ID)
  if (!data) throw new Error('useSiftData must be used under the root route')
  return data
}

/** The dataset is static, so filter changes in the query string never need to reload it. */
export function rootShouldRevalidate(): boolean {
  return false
}
