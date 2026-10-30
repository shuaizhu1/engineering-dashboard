/** Position of an item in a list plus its neighbors, for previous/next links. */
export function neighbors<T>(items: readonly T[], isCurrent: (item: T) => boolean) {
  const index = items.findIndex(isCurrent)
  return {
    /** -1 when the item isn't in the list (e.g. filters exclude it). */
    index,
    prev: index > 0 ? items[index - 1] : null,
    next: index >= 0 && index < items.length - 1 ? items[index + 1] : null,
  }
}

/**
 * Time window around an event, padded on both sides so the lead-up and recovery are visible.
 * Padding is half the event's length, at least `minPadS`, clamped to the flight's time range.
 */
export function focusWindow(
  event: { startS: number; endS: number },
  flightStartS: number,
  flightEndS: number,
  minPadS = 10,
): [number, number] {
  const pad = Math.max(minPadS, (event.endS - event.startS) / 2)
  return [Math.max(flightStartS, event.startS - pad), Math.min(flightEndS, event.endS + pad)]
}
