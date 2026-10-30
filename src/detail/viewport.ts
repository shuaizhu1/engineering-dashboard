// Zoom and pan for the board image, as a square SVG viewBox over the image's pixel coordinates.

/** Board images are 640 × 640 pixels; defect boxes use the same coordinates. */
export const IMAGE_SIZE = 640
/** Smallest viewBox side, i.e. maximum zoom (8×). */
export const MIN_VIEW_SIZE = IMAGE_SIZE / 8

/** Visible square: top-left corner and side length, in image pixels. */
export interface View {
  x: number
  y: number
  size: number
}

export const FULL_VIEW: View = { x: 0, y: 0, size: IMAGE_SIZE }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** Keep the view inside the image and within the zoom limits. */
export function clampView(view: View): View {
  const size = clamp(view.size, MIN_VIEW_SIZE, IMAGE_SIZE)
  return {
    x: clamp(view.x, 0, IMAGE_SIZE - size),
    y: clamp(view.y, 0, IMAGE_SIZE - size),
    size,
  }
}

/**
 * Zoom by `factor` (> 1 zooms in) around a point in image coordinates, which stays under the
 * cursor. Defaults to the view's center, for buttons and keys.
 */
export function zoomAt(view: View, factor: number, at?: { x: number; y: number }): View {
  const cx = at?.x ?? view.x + view.size / 2
  const cy = at?.y ?? view.y + view.size / 2
  const size = clamp(view.size / factor, MIN_VIEW_SIZE, IMAGE_SIZE)
  const ratio = size / view.size
  return clampView({ x: cx - (cx - view.x) * ratio, y: cy - (cy - view.y) * ratio, size })
}

/** Move the view by a distance in image pixels. */
export function panBy(view: View, dx: number, dy: number): View {
  return clampView({ ...view, x: view.x + dx, y: view.y + dy })
}

/** Square view centered on a box, about three times its larger side so its surroundings show. */
export function focusBox(box: { x1: number; y1: number; x2: number; y2: number }): View {
  const size = clamp(Math.max(box.x2 - box.x1, box.y2 - box.y1) * 3, MIN_VIEW_SIZE * 1.5, IMAGE_SIZE)
  return clampView({ x: (box.x1 + box.x2) / 2 - size / 2, y: (box.y1 + box.y2) / 2 - size / 2, size })
}

/** Convert a point on the rendered image (CSS pixels from its top-left) to image coordinates. */
export function toImagePoint(view: View, offsetX: number, offsetY: number, renderedSize: number) {
  return { x: view.x + (offsetX / renderedSize) * view.size, y: view.y + (offsetY / renderedSize) * view.size }
}

export function zoomLevel(view: View): number {
  return IMAGE_SIZE / view.size
}
