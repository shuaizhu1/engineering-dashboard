import { query, registerParquetViews } from './duckdb'

export type FlightLabel = 'vibration' | 'component-failure' | 'good'
export type EventType = 'vibration_high' | 'vibration_spike' | 'battery_sag'

export interface Flight {
  flightId: string
  label: FlightLabel
  /** Epoch milliseconds (UTC); null when the log has no GPS time. */
  startedAt: number | null
  durationS: number
  swVersion: string | null
  hardware: string | null
  maxVibMs2: number
  minBatteryV: number | null
  eventCount: number
}

export interface FlightEvent {
  eventId: string
  flightId: string
  type: EventType
  startS: number
  endS: number
  peak: number
  unit: string
}

export interface SiftData {
  flights: Flight[]
  events: FlightEvent[]
}

const DATA_DIR = '/data/sift'

export async function loadSiftData(): Promise<SiftData> {
  await registerParquetViews({
    flights: `${DATA_DIR}/flights.parquet`,
    events: `${DATA_DIR}/events.parquet`,
    telemetry: `${DATA_DIR}/telemetry.parquet`,
  })

  const [flights, events] = await Promise.all([
    query<Flight>(`
      SELECT
        flight_id            AS flightId,
        label,
        epoch_ms(started_at)::DOUBLE AS startedAt,
        duration_s           AS durationS,
        sw_version           AS swVersion,
        hardware,
        max_vib_ms2          AS maxVibMs2,
        min_battery_v        AS minBatteryV,
        event_count::INTEGER AS eventCount
      FROM flights
      ORDER BY started_at DESC NULLS LAST
    `),
    query<FlightEvent>(`
      SELECT
        event_id  AS eventId,
        flight_id AS flightId,
        type,
        start_s   AS startS,
        end_s     AS endS,
        peak,
        unit
      FROM events
      ORDER BY flight_id, start_s
    `),
  ])

  return { flights, events }
}
