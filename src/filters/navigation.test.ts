import { describe, expect, it } from 'vitest'
import { focusWindow, neighbors } from './navigation'

describe('neighbors', () => {
  const items = ['a', 'b', 'c']

  it('returns the previous and next items', () => {
    expect(neighbors(items, (i) => i === 'b')).toEqual({ index: 1, prev: 'a', next: 'c' })
  })

  it('has no previous at the start and no next at the end', () => {
    expect(neighbors(items, (i) => i === 'a')).toEqual({ index: 0, prev: null, next: 'b' })
    expect(neighbors(items, (i) => i === 'c')).toEqual({ index: 2, prev: 'b', next: null })
  })

  it('reports -1 and no neighbors for an item outside the list', () => {
    expect(neighbors(items, (i) => i === 'z')).toEqual({ index: -1, prev: null, next: null })
  })
})

describe('focusWindow', () => {
  it('pads short events by the minimum on both sides', () => {
    expect(focusWindow({ startS: 50, endS: 52 }, 0, 300)).toEqual([40, 62])
  })

  it('pads long events by half their length', () => {
    expect(focusWindow({ startS: 100, endS: 160 }, 0, 300)).toEqual([70, 190])
  })

  it('clamps to the flight time range', () => {
    expect(focusWindow({ startS: 2, endS: 295 }, 0, 300)).toEqual([0, 300])
  })
})
