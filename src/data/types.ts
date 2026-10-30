export const FLIGHT_LABELS = ['vibration', 'component-failure', 'good'] as const
export const EVENT_TYPES = ['vibration_high', 'vibration_spike', 'battery_sag'] as const

export type FlightLabel = (typeof FLIGHT_LABELS)[number]
export type EventType = (typeof EVENT_TYPES)[number]

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

export const TELEMETRY_CHANNELS = [
  'battery_v',
  'battery_a',
  'battery_pct',
  'roll_deg',
  'pitch_deg',
  'yaw_deg',
  'height_m',
  'speed_ms',
  'accel_x',
  'accel_y',
  'accel_z',
  'vib_ms2',
  'motor_0',
  'motor_1',
  'motor_2',
  'motor_3',
] as const

export type TelemetryChannel = (typeof TELEMETRY_CHANNELS)[number]

/** One flight's 10 Hz telemetry as columns; NaN where a channel has no data. */
export interface FlightTelemetry {
  tS: Float32Array
  channels: Record<TelemetryChannel, Float32Array>
}
