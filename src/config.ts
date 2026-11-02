import type { DefectType, Line, Result, Station } from './data/types'

/** Display names and colors for the Line Inspector dataset. */
export const appConfig = {
  title: 'Line Inspector',
  repoUrl: 'https://github.com/shuaizhu1/engineering-dashboard#line-inspector',
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
  /** Defect box colors: saturated so they stand out on the black-and-white board images. */
  defectColors: {
    open: '#f76707',
    short: '#e03131',
    mousebite: '#ae3ec9',
    spur: '#1c7ed6',
    copper: '#2f9e44',
    'pin-hole': '#f59f00',
  } satisfies Record<DefectType, string>,
} as const
