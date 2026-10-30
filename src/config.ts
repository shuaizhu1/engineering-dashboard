import type { DefectType, Line, Result, Station } from './data/types'

/** Display names and colors for the Line Inspector dataset. */
export const appConfig = {
  title: 'Line Inspector',
  record: { singular: 'board', plural: 'boards' },
  lines: { L1: 'Line 1', L2: 'Line 2', L3: 'Line 3' } satisfies Record<Line, string>,
  stations: { 'AOI-1': 'AOI 1', 'AOI-2': 'AOI 2' } satisfies Record<Station, string>,
  results: { pass: 'Pass', fail: 'Fail' } satisfies Record<Result, string>,
  resultColors: { pass: '#2e9e6a', fail: '#d1495b' } satisfies Record<Result, string>,
  defectTypes: {
    open: 'Open',
    short: 'Short',
    mousebite: 'Mousebite',
    spur: 'Spur',
    copper: 'Spurious copper',
    'pin-hole': 'Pin hole',
  } satisfies Record<DefectType, string>,
} as const
