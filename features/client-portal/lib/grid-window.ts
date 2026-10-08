// Row windowing for the calendar grid: mount the visible band, pad the rest with spacers.

/** Cumulative y of every row: `out[i]` is where row i starts, `out[total]` is the full height. */
export function rowOffsets(total: number, heightOf: (pos: number) => number): number[] {
  const out = new Array<number>(total + 1)
  out[0] = 0
  for (let i = 0; i < total; i++) out[i + 1] = out[i]! + heightOf(i)
  return out
}

/** The row containing y. Binary search, since rows can have different heights. */
export function rowAt(offsets: number[], total: number, y: number): number {
  let lo = 0
  let hi = total
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if ((offsets[mid + 1] ?? 0) <= y) lo = mid + 1
    else hi = mid
  }
  return Math.min(lo, Math.max(0, total - 1))
}

export interface RowWindow {
  firstRow: number
  /** Last row to mount, EXCLUSIVE - it is a slice end, not an index. */
  lastRow: number
  topPad: number
  bottomPad: number
}

/** Rows to mount for a scroll position (plus `overscan` either side) and the spacer heights. */
export function rowWindow(
  offsets: number[],
  total: number,
  scrollTop: number,
  viewport: number,
  overscan: number,
): RowWindow {
  const firstRow = Math.max(0, rowAt(offsets, total, scrollTop) - overscan)
  const lastRow = Math.min(total, rowAt(offsets, total, scrollTop + viewport) + 1 + overscan)
  return {
    firstRow,
    lastRow,
    topPad: offsets[firstRow] ?? 0,
    bottomPad: (offsets[total] ?? 0) - (offsets[lastRow] ?? 0),
  }
}
