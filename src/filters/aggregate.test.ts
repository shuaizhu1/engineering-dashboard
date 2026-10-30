import { describe, expect, it } from 'vitest'
import { paretoCounts } from './aggregate'

const keys = ['a', 'b', 'c'] as const

describe('paretoCounts', () => {
  it('sorts by count, highest first, with a running percentage', () => {
    expect(paretoCounts(['b', 'a', 'b', 'b'], keys)).toEqual([
      { key: 'b', count: 3, cumulativePct: 75 },
      { key: 'a', count: 1, cumulativePct: 100 },
      { key: 'c', count: 0, cumulativePct: 100 },
    ])
  })

  it('breaks ties in key order', () => {
    expect(paretoCounts(['c', 'a'], keys).map((r) => r.key)).toEqual(['a', 'c', 'b'])
  })

  it('keeps every key with zero percent when there is nothing to count', () => {
    expect(paretoCounts([], keys)).toEqual([
      { key: 'a', count: 0, cumulativePct: 0 },
      { key: 'b', count: 0, cumulativePct: 0 },
      { key: 'c', count: 0, cumulativePct: 0 },
    ])
  })

  it('ignores values outside the key list', () => {
    expect(paretoCounts(['a', 'z' as 'a'], keys)[0]).toEqual({ key: 'a', count: 1, cumulativePct: 100 })
  })
})
