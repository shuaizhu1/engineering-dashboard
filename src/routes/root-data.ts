import { useRouteLoaderData } from 'react-router'
import { loadSiftData, type SiftData } from '../data/sift'

export const ROOT_ROUTE_ID = 'root'

export function rootLoader(): Promise<SiftData> {
  return loadSiftData()
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
