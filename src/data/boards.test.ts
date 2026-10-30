import { describe, expect, it } from 'vitest'
import { toDefect, toUnit } from './boards'

describe('toUnit', () => {
  it('maps a hyparquet row, converting Date and BigInt values', () => {
    expect(
      toUnit({
        serial: 'SN100004',
        line: 'L2',
        station: 'AOI-2',
        inspected_at: new Date('2026-10-14T09:18:16Z'),
        result: 'fail',
        defect_count: 7n,
        image_id: '00041060_test',
      }),
    ).toEqual({
      serial: 'SN100004',
      line: 'L2',
      station: 'AOI-2',
      inspectedAt: Date.parse('2026-10-14T09:18:16Z'),
      result: 'fail',
      defectCount: 7,
      imageId: '00041060_test',
    })
  })
})

describe('toDefect', () => {
  it('maps a defect box', () => {
    expect(toDefect({ serial: 'SN100004', type: 'short', x1: 233, y1: 315, x2: 258, y2: 372 })).toEqual({
      serial: 'SN100004',
      type: 'short',
      x1: 233,
      y1: 315,
      x2: 258,
      y2: 372,
    })
  })
})
