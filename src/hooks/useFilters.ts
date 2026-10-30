import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { applyFilters, parseFilters, type Filters } from '../filters/filters'

/** Filters live in the query string, so every view is a shareable link. */
export function useFilters() {
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => parseFilters(params), [params])
  const setFilters = useCallback(
    (next: Filters, options?: { replace?: boolean }) => {
      setParams((current) => applyFilters(current, next), options)
    },
    [setParams],
  )
  return [filters, setFilters] as const
}
