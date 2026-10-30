export const LINES = ['L1', 'L2', 'L3'] as const
export const STATIONS = ['AOI-1', 'AOI-2'] as const
export const RESULTS = ['pass', 'fail'] as const
/** DeepPCB defect classes, in the dataset's class-ID order. */
export const DEFECT_TYPES = ['open', 'short', 'mousebite', 'spur', 'copper', 'pin-hole'] as const

export type Line = (typeof LINES)[number]
export type Station = (typeof STATIONS)[number]
export type Result = (typeof RESULTS)[number]
export type DefectType = (typeof DEFECT_TYPES)[number]

/** One inspected board. */
export interface Unit {
  serial: string
  line: Line
  station: Station
  /** Epoch milliseconds (UTC). */
  inspectedAt: number
  result: Result
  defectCount: number
  /** Board image file name without extension, under `images/` and `thumbs/`. */
  imageId: string
}

/** One defect box on a failed board, in the board image's pixel coordinates (640 × 640). */
export interface Defect {
  serial: string
  type: DefectType
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface LineData {
  /** Newest first. */
  units: Unit[]
  defects: Defect[]
}
