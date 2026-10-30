import { useRouteLoaderData } from 'react-router'
import { loadLineData, type LineData } from '../data/boards'

export const ROOT_ROUTE_ID = 'root'

/** User Timing mark set when the dashboard data is ready; Lighthouse and DevTools report it. */
export const DATA_READY_MARK = 'line-data-ready'

export async function rootLoader(): Promise<LineData> {
  const data = await loadLineData()
  performance.mark(DATA_READY_MARK)
  return data
}

export function useLineData(): LineData {
  const data = useRouteLoaderData<LineData>(ROOT_ROUTE_ID)
  if (!data) throw new Error('useLineData must be used under the root route')
  return data
}

/** The dataset is static, so filter changes in the query string never need to reload it. */
export function rootShouldRevalidate(): boolean {
  return false
}
