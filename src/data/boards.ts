import { parquetReadObjects } from 'hyparquet'
import type { Defect, DefectType, Line, LineData, Result, Station, Unit } from './types'

export * from './types'

export const DATA_DIR = '/data/instrumental'

type Row = Record<string, unknown>

const num = (v: unknown) => (typeof v === 'bigint' ? Number(v) : (v as number))

export function toUnit(row: Row): Unit {
  const inspectedAt = row.inspected_at
  return {
    serial: String(row.serial),
    line: row.line as Line,
    station: row.station as Station,
    inspectedAt: inspectedAt instanceof Date ? inspectedAt.getTime() : num(inspectedAt),
    result: row.result as Result,
    defectCount: num(row.defect_count),
    imageId: String(row.image_id),
  }
}

export function toDefect(row: Row): Defect {
  return {
    serial: String(row.serial),
    type: row.type as DefectType,
    x1: num(row.x1),
    y1: num(row.y1),
    x2: num(row.x2),
    y2: num(row.y2),
  }
}

async function readParquet(path: string): Promise<Row[]> {
  const response = await fetch(path)
  if (!response.ok) throw new Error(`Could not load ${path} (${response.status})`)
  return parquetReadObjects({ file: await response.arrayBuffer() })
}

/** Both tables are small (tens of KB), so hyparquet reads them in full on first load. */
export async function loadLineData(): Promise<LineData> {
  const [unitRows, defectRows] = await Promise.all([
    readParquet(`${DATA_DIR}/units.parquet`),
    readParquet(`${DATA_DIR}/defects.parquet`),
  ])
  const units = unitRows.map(toUnit).sort((a, b) => b.inspectedAt - a.inspectedAt)
  return { units, defects: defectRows.map(toDefect) }
}
