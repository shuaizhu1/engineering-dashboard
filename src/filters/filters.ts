import {
  EVENT_TYPES,
  FLIGHT_LABELS,
  type EventType,
  type Flight,
  type FlightEvent,
  type FlightLabel,
} from '../data/types'

/** Dashboard filters. Empty lists and null dates mean "no restriction". */
export interface Filters {
  labels: FlightLabel[]
  eventTypes: EventType[]
  /** Inclusive start date, `YYYY-MM-DD` (UTC). */
  from: string | null
  /** Inclusive end date, `YYYY-MM-DD` (UTC). */
  to: string | null
}

export const EMPTY_FILTERS: Filters = { labels: [], eventTypes: [], from: null, to: null }

const PARAM = { labels: 'label', eventTypes: 'event', from: 'from', to: 'to' } as const

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
    labels: parseList(params.get(PARAM.labels), FLIGHT_LABELS),
    eventTypes: parseList(params.get(PARAM.eventTypes), EVENT_TYPES),
    from,
    to,
  }
}

/** Write filters to a query string, leaving out empty values so default URLs stay clean. */
export function serializeFilters(filters: Filters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.labels.length) {
    params.set(PARAM.labels, FLIGHT_LABELS.filter((l) => filters.labels.includes(l)).join(','))
  }
  if (filters.eventTypes.length) {
    params.set(PARAM.eventTypes, EVENT_TYPES.filter((t) => filters.eventTypes.includes(t)).join(','))
  }
  if (filters.from) params.set(PARAM.from, filters.from)
  if (filters.to) params.set(PARAM.to, filters.to)
  return params
}

/** Replace the filter keys in `params`, keeping any other query parameters (e.g. `mode`). */
export function applyFilters(params: URLSearchParams, filters: Filters): URLSearchParams {
  const next = new URLSearchParams(params)
  for (const key of Object.values(PARAM)) next.delete(key)
  for (const [key, value] of serializeFilters(filters)) next.set(key, value)
  return next
}

export function hasActiveFilters(filters: Filters): boolean {
  return filters.labels.length > 0 || filters.eventTypes.length > 0 || filters.from !== null || filters.to !== null
}

function inDateRange(startedAt: number | null, from: string | null, to: string | null): boolean {
  if (!from && !to) return true
  // A flight without GPS time can't be placed in a date range.
  if (startedAt === null) return false
  if (from && startedAt < Date.parse(`${from}T00:00:00Z`)) return false
  if (to && startedAt >= Date.parse(`${to}T00:00:00Z`) + DAY_MS) return false
  return true
}

/** Flights matching the filters. With event types selected, a flight needs at least one such event. */
export function filterFlights(flights: Flight[], events: FlightEvent[], filters: Filters): Flight[] {
  const labels = new Set(filters.labels)
  let withEventType: Set<string> | null = null
  if (filters.eventTypes.length) {
    const types = new Set(filters.eventTypes)
    withEventType = new Set(events.filter((e) => types.has(e.type)).map((e) => e.flightId))
  }
  return flights.filter(
    (f) =>
      (labels.size === 0 || labels.has(f.label)) &&
      (withEventType === null || withEventType.has(f.flightId)) &&
      inDateRange(f.startedAt, filters.from, filters.to),
  )
}

/** Events that belong to the given flights and match the selected event types. */
export function filterEvents(events: FlightEvent[], flights: Flight[], filters: Filters): FlightEvent[] {
  const flightIds = new Set(flights.map((f) => f.flightId))
  const types = new Set(filters.eventTypes)
  return events.filter((e) => flightIds.has(e.flightId) && (types.size === 0 || types.has(e.type)))
}
