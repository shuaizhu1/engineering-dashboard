import { queryColumns, registerParquetViews } from './duckdb'
import { DATA_DIR } from './sift'
import { TELEMETRY_CHANNELS, type FlightTelemetry, type TelemetryChannel } from './types'

// Only the flight route and the dashboard's idle-time warm-up import this module,
// so DuckDB-WASM stays out of the dashboard's first load.

let viewReady: Promise<void> | undefined

/** Start DuckDB and register the telemetry view once; callers share the same promise. */
export function warmUpTelemetry(): Promise<void> {
  viewReady ??= registerParquetViews({ telemetry: `${DATA_DIR}/telemetry.parquet` }).catch((error: unknown) => {
    viewReady = undefined
    throw error
  })
  return viewReady
}

/** All telemetry channels for one flight, or null when the flight has no rows. */
export async function loadFlightTelemetry(flightId: string): Promise<FlightTelemetry | null> {
  await warmUpTelemetry()
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
