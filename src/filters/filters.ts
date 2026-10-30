import {
  DEFECT_TYPES,
  LINES,
  RESULTS,
  STATIONS,
  type Defect,
  type DefectType,
  type Line,
  type Result,
  type Station,
  type Unit,
} from '../data/types'

/** Dashboard filters. Empty lists and null dates mean "no restriction". */
export interface Filters {
  lines: Line[]
  stations: Station[]
  results: Result[]
  defectTypes: DefectType[]
  /** Inclusive start date, `YYYY-MM-DD` (UTC). */
  from: string | null
  /** Inclusive end date, `YYYY-MM-DD` (UTC). */
  to: string | null
}

export const EMPTY_FILTERS: Filters = { lines: [], stations: [], results: [], defectTypes: [], from: null, to: null }

const PARAM = {
  lines: 'line',
  stations: 'station',
  results: 'result',
  defectTypes: 'defect',
  from: 'from',
  to: 'to',
} as const

/** The list filters with their allowed values, in canonical order. */
const LISTS = { lines: LINES, stations: STATIONS, results: RESULTS, defectTypes: DEFECT_TYPES } as const
type ListKey = keyof typeof LISTS
const LIST_KEYS = Object.keys(LISTS) as ListKey[]

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 24 * 60 * 60 * 1000

function parseList<T extends string>(value: string | null, allowed: readonly T[]): T[] {
  if (!value) return []
  const wanted = new Set(value.split(','))
  // Keep the canonical order and drop unknown or repeated values.
  return allowed.filter((item) => wanted.has(item))
}

function parseDate(value: string | null): string | null {
  if (!value || !DATE_RE.test(value)) return null
  const time = Date.parse(`${value}T00:00:00Z`)
  return Number.isNaN(time) || new Date(time).toISOString().slice(0, 10) !== value ? null : value
}

/** Read filters from the query string, ignoring anything invalid. */
export function parseFilters(params: URLSearchParams): Filters {
  let from = parseDate(params.get(PARAM.from))
  let to = parseDate(params.get(PARAM.to))
  if (from && to && from > to) [from, to] = [to, from]
  return {
    lines: parseList(params.get(PARAM.lines), LINES),
    stations: parseList(params.get(PARAM.stations), STATIONS),
    results: parseList(params.get(PARAM.results), RESULTS),
    defectTypes: parseList(params.get(PARAM.defectTypes), DEFECT_TYPES),
    from,
    to,
  }
}

/** Write filters to a query string, leaving out empty values so default URLs stay clean. */
export function serializeFilters(filters: Filters): URLSearchParams {
  const params = new URLSearchParams()
  for (const key of LIST_KEYS) {
    const selected: readonly string[] = filters[key]
    if (selected.length) params.set(PARAM[key], LISTS[key].filter((v) => selected.includes(v)).join(','))
  }
  if (filters.from) params.set(PARAM.from, filters.from)
  if (filters.to) params.set(PARAM.to, filters.to)
  return params
}

/** Replace the filter keys in `params`, keeping any other query parameters. */
export function applyFilters(params: URLSearchParams, filters: Filters): URLSearchParams {
  const next = new URLSearchParams(params)
  for (const key of Object.values(PARAM)) next.delete(key)
  for (const [key, value] of serializeFilters(filters)) next.set(key, value)
  return next
}

export function hasActiveFilters(filters: Filters): boolean {
  return LIST_KEYS.some((key) => filters[key].length > 0) || filters.from !== null || filters.to !== null
}

/** Add or remove one value, keeping the canonical order of `order`. */
export function toggleValue<T extends string>(selected: readonly T[], value: T, order: readonly T[]): T[] {
  const next = new Set(selected)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return order.filter((item) => next.has(item))
}

function toUtcDay(time: number): string {
  return new Date(time).toISOString().slice(0, 10)
}

/** Whole UTC days covering a time span, e.g. from a brushed chart range. */
export function dateRangeFromTimes(startMs: number, endMs: number): Pick<Filters, 'from' | 'to'> {
  const [lo, hi] = startMs <= endMs ? [startMs, endMs] : [endMs, startMs]
  return { from: toUtcDay(lo), to: toUtcDay(hi) }
}

/** Epoch-ms bounds of a date filter: `start` inclusive, `end` exclusive (the day after `to`). */
export function dateRangeBounds(from: string | null, to: string | null): { start: number | null; end: number | null } {
  return {
    start: from ? Date.parse(`${from}T00:00:00Z`) : null,
    end: to ? Date.parse(`${to}T00:00:00Z`) + DAY_MS : null,
  }
}

function inDateRange(time: number, start: number | null, end: number | null): boolean {
  return (start === null || time >= start) && (end === null || time < end)
}

/** Boards matching the filters. With defect types selected, a board needs at least one such defect. */
export function filterUnits(units: Unit[], defects: Defect[], filters: Filters): Unit[] {
  const lines = new Set(filters.lines)
  const stations = new Set(filters.stations)
  const results = new Set(filters.results)
  const { start, end } = dateRangeBounds(filters.from, filters.to)
  let withDefectType: Set<string> | null = null
  if (filters.defectTypes.length) {
    const types = new Set(filters.defectTypes)
    withDefectType = new Set(defects.filter((d) => types.has(d.type)).map((d) => d.serial))
  }
  return units.filter(
    (u) =>
      (lines.size === 0 || lines.has(u.line)) &&
      (stations.size === 0 || stations.has(u.station)) &&
      (results.size === 0 || results.has(u.result)) &&
      (withDefectType === null || withDefectType.has(u.serial)) &&
      inDateRange(u.inspectedAt, start, end),
  )
}

/** Defects on the given boards that match the selected defect types. */
export function filterDefects(defects: Defect[], units: Unit[], filters: Filters): Defect[] {
  const serials = new Set(units.map((u) => u.serial))
  const types = new Set(filters.defectTypes)
  return defects.filter((d) => serials.has(d.serial) && (types.size === 0 || types.has(d.type)))
}
