"use client"

import * as React from "react"

const NONE: Readonly<Record<number, number>> = {}

/**
 * Real row heights for a windowed <table>: wrapped text outgrows the estimate and desyncs the
 * spacer rows. Mark body rows `data-row-pos={pos}` and build offsets from the returned
 * `heightOf`, but keep `baseHeightOf` for the cells' `height` style, or rows could never shrink.
 */
export function useMeasuredRowHeights(
  scrollerRef: React.RefObject<HTMLElement | null>,
  baseHeightOf: (pos: number) => number,
  resetKey: string,
): (pos: number) => number {
  const [measured, setMeasured] = React.useState({ key: resetKey, heights: NONE })
  const heights = measured.key === resetKey ? measured.heights : NONE

  const heightOf = React.useCallback(
    (pos: number) => heights[pos] ?? baseHeightOf(pos),
    [heights, baseHeightOf],
  )

  // Every render, no deps on purpose: rows scrolling into view change none of the inputs.
  // Layout effect so corrections land before paint; it settles once nothing differs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useLayoutEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const { changed, shift } = measureRows(el, heightOf)
    if (!changed) return
    if (shift) el.scrollTop += shift
    setMeasured((m) => ({
      key: resetKey,
      heights: { ...(m.key === resetKey ? m.heights : NONE), ...changed },
    }))
  })

  return heightOf
}

/** Rows that differ from the assumed height, plus the scroll shift from rows above the viewport. */
function measureRows(
  el: HTMLElement,
  assumed: (pos: number) => number,
): { changed: Record<number, number> | null; shift: number } {
  // "Above the viewport" means above the sticky header's bottom edge.
  const header = el.querySelector("thead")?.getBoundingClientRect().height ?? 0
  const viewTop = el.getBoundingClientRect().top + header

  let changed: Record<number, number> | null = null
  let shift = 0
  for (const row of el.querySelectorAll<HTMLElement>("[data-row-pos]")) {
    const pos = Number(row.dataset.rowPos)
    const rect = row.getBoundingClientRect()
    const diff = rect.height - assumed(pos)
    if (Math.abs(diff) < 0.5) continue
    ;(changed ??= {})[pos] = rect.height
    if (rect.top < viewTop) shift += diff
  }
  return { changed, shift }
}
