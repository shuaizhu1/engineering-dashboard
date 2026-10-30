import { describe, expect, it } from 'vitest'
import { neighbors } from './navigation'

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
