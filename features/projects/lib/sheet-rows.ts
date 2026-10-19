// Closing the gap after rows are deleted, as a spreadsheet does.

/**
 * Where a row at `pos` ends up once the `deleted` positions are gone: up by the number deleted
 * above it, or null when it is one of them.
 */
export function positionAfterDelete(deleted: readonly number[]): (pos: number) => number | null {
  const gone = [...new Set(deleted)].sort((a, b) => a - b)
  const set = new Set(gone)
  return (pos) => {
    if (set.has(pos)) return null
    // Binary search: how many deleted positions sit above pos.
    let lo = 0
    let hi = gone.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (gone[mid]! < pos) lo = mid + 1
      else hi = mid
    }
    return pos - lo
  }
}
