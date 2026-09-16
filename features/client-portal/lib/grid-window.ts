/**
 * Which rows of a tall grid are worth putting in the DOM.
 *
 * The calendar grid offers a hundred rows and will offer more on request, but
 * only a dozen are ever on screen. Mounting all of them means every arrow key
 * re-renders thousands of cells, so the grid mounts the visible band and props
 * two spacer rows either side of it - the scrollbar then measures the whole
 * grid even though most of it does not exist.
 *
 * Pulled out of the component because it is the one piece of arithmetic here
 * that can be wrong in a way you cannot see: an off-by-one leaves a blank strip
 * at the edge of a fast scroll, or silently drops the last row.
 */

/** Cumulative y of every row: `out[i]` is where row i starts, `out[total]` is the full height. */
export function rowOffsets(total: number, heightOf: (pos: number) => number): number[] {
  const out = new Array<number>(total + 1)
  out[0] = 0
  for (let i = 0; i < total; i++) out[i + 1] = out[i]! + heightOf(i)
  return out
}

/**
 * The first row whose BOTTOM edge is past y - i.e. the row containing y.
 *
 * Binary search rather than a division, because rows do not all share a height:
 * the team can make one taller and the portal renders it at that height so the
 * two views line up.
 */
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
  /** First row to mount, inclusive. */
  firstRow: number
  /** Last row to mount, EXCLUSIVE - it is a slice end, not an index. */
  lastRow: number
  /** Height of the spacer standing in for the rows above `firstRow`. */
  topPad: number
  /** Height of the spacer standing in for the rows from `lastRow` down. */
  bottomPad: number
}

/**
 * The band to mount for a given scroll position, plus the two spacer heights.
 *
 * `overscan` rows are kept either side so a flick does not expose a blank strip
 * before the next render lands.
 */
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
