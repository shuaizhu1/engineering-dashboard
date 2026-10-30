import type { ChannelPanel } from '../charts/telemetryOption'
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
  /** Stacked, time-synced panels on the flight detail page, top to bottom. */
  channelPanels: [
    {
      title: 'Vibration',
      unit: 'm/s²',
      series: [{ key: 'vib_ms2', name: 'Vibration' }],
      eventTypes: ['vibration_high', 'vibration_spike'],
    },
    {
      title: 'Battery voltage',
      unit: 'V',
      series: [{ key: 'battery_v', name: 'Voltage' }],
      eventTypes: ['battery_sag'],
    },
    {
      title: 'Battery current',
      unit: 'A',
      series: [{ key: 'battery_a', name: 'Current' }],
      eventTypes: ['battery_sag'],
    },
    { title: 'Height', unit: 'm', series: [{ key: 'height_m', name: 'Height' }], eventTypes: [] },
    {
      title: 'Attitude',
      unit: '°',
      series: [
        { key: 'roll_deg', name: 'Roll' },
        { key: 'pitch_deg', name: 'Pitch' },
      ],
      eventTypes: [],
    },
    {
      // PWM microseconds on most airframes, 0–2000 on DShot; shown as logged.
      title: 'Motor outputs',
      unit: 'raw',
      series: [
        { key: 'motor_0', name: 'Motor 1' },
        { key: 'motor_1', name: 'Motor 2' },
        { key: 'motor_2', name: 'Motor 3' },
        { key: 'motor_3', name: 'Motor 4' },
      ],
      eventTypes: [],
    },
  ] satisfies ChannelPanel[],
  /** Series colors within a panel (roll/pitch, motors 1–4). */
  seriesColors: ['#4c8dff', '#f28c28', '#2fb37a', '#b06cf0'],
  /** Matches VIB_HIGH_MS2 in scripts/seed_sift.py. */
  vibrationThresholdMs2: 4,
} as const

export type SiftMode = typeof siftMode
