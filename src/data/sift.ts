import { parquetReadObjects } from 'hyparquet'
import type { EventType, Flight, FlightEvent, FlightLabel, SiftData } from './types'

export * from './types'

export const DATA_DIR = '/data/sift'

type Row = Record<string, unknown>

const num = (v: unknown) => (typeof v === 'bigint' ? Number(v) : (v as number))
const optionalNum = (v: unknown) => (v === null || v === undefined ? null : num(v))
const optionalStr = (v: unknown) => (v === null || v === undefined ? null : String(v))

export function toFlight(row: Row): Flight {
  const startedAt = row.started_at
  return {
    flightId: String(row.flight_id),
    label: row.label as FlightLabel,
    startedAt: startedAt instanceof Date ? startedAt.getTime() : optionalNum(startedAt),
    durationS: num(row.duration_s),
    airborneS: num(row.airborne_s),
    swVersion: optionalStr(row.sw_version),
    hardware: optionalStr(row.hardware),
    maxVibMs2: num(row.max_vib_ms2),
    minBatteryV: optionalNum(row.min_battery_v),
    eventCount: num(row.event_count),
  }
}

export function toEvent(row: Row): FlightEvent {
  return {
    eventId: String(row.event_id),
    flightId: String(row.flight_id),
    type: row.type as EventType,
    startS: num(row.start_s),
    endS: num(row.end_s),
    peak: num(row.peak),
    unit: String(row.unit),
  }
}

async function readParquet(path: string): Promise<Row[]> {
  const response = await fetch(path)
  if (!response.ok) throw new Error(`Could not load ${path} (${response.status})`)
  return parquetReadObjects({ file: await response.arrayBuffer() })
}

/**
 * The dashboard's summary tables (about 16 KB) read with hyparquet, a small pure-JS Parquet reader,
 * so the first screen doesn't wait for DuckDB-WASM. DuckDB loads later for telemetry (see telemetry.ts).
 */
export async function loadSiftData(): Promise<SiftData> {
  const [flightRows, eventRows] = await Promise.all([
    readParquet(`${DATA_DIR}/flights.parquet`),
    readParquet(`${DATA_DIR}/events.parquet`),
  ])
  const flights = flightRows.map(toFlight).sort((a, b) => (b.startedAt ?? -Infinity) - (a.startedAt ?? -Infinity))
  const events = eventRows
    .map(toEvent)
    .sort((a, b) => a.flightId.localeCompare(b.flightId) || a.startS - b.startS)
  return { flights, events, syntheticCount: 0 }
}
