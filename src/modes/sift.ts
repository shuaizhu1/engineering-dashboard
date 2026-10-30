import type { EventType, FlightLabel } from '../data/types'

/** Everything Sift mode (PX4 flight telemetry) shows that is specific to its dataset. */
export const siftMode = {
  id: 'sift',
  title: 'Flight Telemetry',
  record: { singular: 'flight', plural: 'flights' },
  labels: {
    vibration: 'Vibration',
    'component-failure': 'Component failure',
    'sensor-error': 'Sensor error',
    good: 'Good',
  } satisfies Record<FlightLabel, string>,
  labelColors: {
    vibration: '#d1495b',
    'component-failure': '#e8a33d',
    'sensor-error': '#7b61ff',
    good: '#2e9e6a',
  } satisfies Record<FlightLabel, string>,
  eventTypes: {
    vibration_high: 'Sustained vibration',
    vibration_spike: 'Vibration spike',
    battery_sag: 'Battery sag',
  } satisfies Record<EventType, string>,
  /** Matches VIB_HIGH_MS2 in scripts/seed_sift.py. */
  vibrationThresholdMs2: 4,
} as const

export type SiftMode = typeof siftMode
