"use client"

import * as React from "react"

const NONE: Readonly<Record<number, number>> = {}

/**
 * The REAL heights of a windowed table's rows, measured as they render.
 *
 * A windowed grid mounts only the visible band and stands two spacer rows in
 * for the rest, both sized from what it believes each row's height is. In a
 * <table> that belief breaks as soon as text wraps: a cell's `height` is only a
 * minimum, and an `h-full overflow-hidden` wrapper cannot clip inside a table
 * cell (a percentage height does not resolve there), so the row grows to fit
 * its content. A 64px estimate against a 110px row put the band and the spacers
 * out of step - scrolling showed the same rows twice and then leapt dozens of
 * rows ahead.
 *
 * Mark every rendered body row with `data-row-pos={pos}` inside `scrollerRef`.
 * The returned `heightOf` is `baseHeightOf` overlaid with every height measured
 * so far: build the offsets and the window from it. Keep `baseHeightOf` for the
 * cells' own `height` style - feeding a measured height back in there would make
 * it the row's minimum, and a row could then never shrink again.
 *
 * When a row ABOVE the viewport turns out taller or shorter than assumed, the
 * scroll position moves by the difference, so the rows on screen stay put.
 *
 * `resetKey` (the sheet's id) starts afresh when another sheet is shown.
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

  // After EVERY render, because any of them can change a row's height: the band
  // moved, a value changed, a column was resized. Layout effect, so a correction
  // lands before paint and is never seen. It settles: a second pass finds every
  // mounted row already matching and sets nothing. No dependency list on
  // purpose - rows scrolling into the band change none of this hook's inputs.
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

/**
 * Every mounted row whose real height differs from what was assumed, plus how
 * far the rows ABOVE the viewport moved everything under them.
 */
function measureRows(
  el: HTMLElement,
  assumed: (pos: number) => number,
): { changed: Record<number, number> | null; shift: number } {
  // The sticky header covers the top of the scroller, so "above the viewport"
  // means above the header's bottom edge.
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
