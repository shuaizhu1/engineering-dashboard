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
