import type { Flight, FlightEvent, SiftData } from './types'

/** Query parameter that adds synthetic flights, e.g. `?stress=5000`. */
export const STRESS_PARAM = 'stress'
export const MAX_STRESS_FLIGHTS = 50_000

/** Separates a synthetic flight's id from the real flight it was cloned from. */
const SYNTHETIC_SEPARATOR = '~s'

const DAY_MS = 24 * 60 * 60 * 1000

/** Small deterministic PRNG (mulberry32) so a stress URL always produces the same data. */
function random(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function parseStressCount(params: URLSearchParams): number {
  const n = Math.floor(Number(params.get(STRESS_PARAM)))
  return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_STRESS_FLIGHTS) : 0
}

/** The real flight a (possibly synthetic) flight id refers to; its telemetry is reused. */
export function sourceFlightId(flightId: string): string {
  const i = flightId.indexOf(SYNTHETIC_SEPARATOR)
  return i === -1 ? flightId : flightId.slice(0, i)
}

export function isSynthetic(flightId: string): boolean {
  return flightId.includes(SYNTHETIC_SEPARATOR)
}

/**
 * Add `count` synthetic flights for scale testing. Each clones a real flight (round robin) with its
 * events, spread over the year before the newest real flight, with max vibration jittered ±25%.
 */
export function addStressFlights(data: SiftData, count: number, seed = 1): SiftData {
  if (count <= 0 || data.flights.length === 0) return data
  const rand = random(seed)
  const eventsByFlight = new Map<string, FlightEvent[]>()
  for (const e of data.events) {
    const list = eventsByFlight.get(e.flightId)
    if (list) list.push(e)
    else eventsByFlight.set(e.flightId, [e])
  }
  const newest = Math.max(...data.flights.map((f) => f.startedAt ?? 0)) || Date.UTC(2026, 0, 1)

  const flights: Flight[] = []
  const events: FlightEvent[] = []
  for (let i = 0; i < count; i++) {
    const source = data.flights[i % data.flights.length]
    const flightId = `${source.flightId}${SYNTHETIC_SEPARATOR}${i + 1}`
    flights.push({
      ...source,
      flightId,
      startedAt: Math.round(newest - rand() * 365 * DAY_MS),
      maxVibMs2: source.maxVibMs2 * (0.75 + rand() * 0.5),
    })
    for (const e of eventsByFlight.get(source.flightId) ?? []) {
      events.push({ ...e, flightId, eventId: `${e.eventId}${SYNTHETIC_SEPARATOR}${i + 1}` })
    }
  }

  const allFlights = [...data.flights, ...flights].sort((a, b) => (b.startedAt ?? -Infinity) - (a.startedAt ?? -Infinity))
  return { flights: allFlights, events: [...data.events, ...events], syntheticCount: count }
}

/** Short id for display: the first 8 characters, plus the clone number for synthetic flights. */
export function shortFlightId(flightId: string): string {
  const i = flightId.indexOf(SYNTHETIC_SEPARATOR)
  return i === -1 ? flightId.slice(0, 8) : `${flightId.slice(0, 8)}${flightId.slice(i)}`
}
