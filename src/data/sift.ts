import { query, queryColumns, registerParquetViews } from './duckdb'
import {
  TELEMETRY_CHANNELS,
  type Flight,
  type FlightEvent,
  type FlightTelemetry,
  type SiftData,
  type TelemetryChannel,
} from './types'

export * from './types'

const DATA_DIR = '/data/sift'

let viewsReady: Promise<void> | undefined

/** Register the Parquet views once; loaders that run in parallel share the same promise. */
function ensureViews(): Promise<void> {
  viewsReady ??= registerParquetViews({
    flights: `${DATA_DIR}/flights.parquet`,
    events: `${DATA_DIR}/events.parquet`,
    telemetry: `${DATA_DIR}/telemetry.parquet`,
  }).catch((error: unknown) => {
    viewsReady = undefined
    throw error
  })
  return viewsReady
}

export async function loadSiftData(): Promise<SiftData> {
  await ensureViews()

  const [flights, events] = await Promise.all([
    query<Flight>(`
      SELECT
        flight_id            AS flightId,
        label,
        epoch_ms(started_at)::DOUBLE AS startedAt,
        duration_s           AS durationS,
        airborne_s           AS airborneS,
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

/** All telemetry channels for one flight, or null when the flight has no rows. */
export async function loadFlightTelemetry(flightId: string): Promise<FlightTelemetry | null> {
  await ensureViews()
  // Nulls become NaN so typed arrays keep gaps instead of reading them as 0.
  const channelSql = TELEMETRY_CHANNELS.map((name) => `coalesce(${name}, 'NaN'::FLOAT) AS ${name}`).join(', ')
  const columns = await queryColumns(
    `SELECT t_s, ${channelSql} FROM telemetry WHERE flight_id = ? ORDER BY t_s`,
    flightId,
  )
  const tS = columns.t_s as Float32Array
  if (tS.length === 0) return null
  const channels = Object.fromEntries(
    TELEMETRY_CHANNELS.map((name) => [name, columns[name] as Float32Array]),
  ) as Record<TelemetryChannel, Float32Array>
  return { tS, channels }
}
