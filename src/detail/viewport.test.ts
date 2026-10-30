import { describe, expect, it } from 'vitest'
import { FULL_VIEW, MIN_VIEW_SIZE, clampView, focusBox, panBy, toImagePoint, zoomAt, zoomLevel } from './viewport'

describe('zoomAt', () => {
  it('zooms around the center by default', () => {
    expect(zoomAt(FULL_VIEW, 2)).toEqual({ x: 160, y: 160, size: 320 })
  })

  it('keeps the given point in the same place on screen', () => {
    const view = zoomAt(FULL_VIEW, 2, { x: 160, y: 480 })
    expect(view).toEqual({ x: 80, y: 240, size: 320 })
    // 160 was a quarter of the way across before and still is.
    expect((160 - view.x) / view.size).toBe(0.25)
  })

  it('stops at the zoom limits', () => {
    expect(zoomAt(FULL_VIEW, 100).size).toBe(MIN_VIEW_SIZE)
    expect(zoomAt({ x: 100, y: 100, size: 200 }, 0.01)).toEqual(FULL_VIEW)
  })
})

describe('panBy', () => {
  it('moves the view and stops at the image edges', () => {
    const view = { x: 100, y: 100, size: 320 }
    expect(panBy(view, 50, -20)).toEqual({ x: 150, y: 80, size: 320 })
    expect(panBy(view, 1000, -1000)).toEqual({ x: 320, y: 0, size: 320 })
  })

  it('cannot pan the full view', () => {
    expect(panBy(FULL_VIEW, 40, 40)).toEqual(FULL_VIEW)
  })
})

describe('clampView', () => {
  it('limits size and position', () => {
    expect(clampView({ x: -10, y: 700, size: 10 })).toEqual({ x: 0, y: 640 - MIN_VIEW_SIZE, size: MIN_VIEW_SIZE })
  })
})

describe('focusBox', () => {
  it('centers on the box at three times its larger side', () => {
    expect(focusBox({ x1: 300, y1: 300, x2: 340, y2: 360 })).toEqual({ x: 230, y: 240, size: 180 })
  })

  it('keeps tiny boxes in context and stays inside the image', () => {
    expect(focusBox({ x1: 0, y1: 0, x2: 4, y2: 4 })).toEqual({ x: 0, y: 0, size: MIN_VIEW_SIZE * 1.5 })
  })
})

describe('toImagePoint', () => {
  it('maps rendered pixels into the current view', () => {
    expect(toImagePoint({ x: 100, y: 200, size: 320 }, 240, 120, 480)).toEqual({ x: 260, y: 280 })
  })
})

describe('zoomLevel', () => {
  it('is 1 for the full image', () => {
    expect(zoomLevel(FULL_VIEW)).toBe(1)
    expect(zoomLevel({ x: 0, y: 0, size: 160 })).toBe(4)
  })
})
