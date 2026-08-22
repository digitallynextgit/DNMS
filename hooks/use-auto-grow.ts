"use client"

import { useLayoutEffect, type RefObject } from "react"

/**
 * Grow a textarea to fit its text, up to its own `max-height`, and only then let
 * it scroll - the behaviour every messenger composer has.
 *
 * Two details that are easy to get wrong, and were:
 *
 *   - `scrollHeight` measures the CONTENT box, while `height` under `border-box`
 *     sizing includes the borders. Assigning one straight to the other leaves the
 *     box two pixels short, and the browser answers with a scrollbar on an EMPTY
 *     field. `offsetHeight - clientHeight` is exactly those borders.
 *   - Overflow is toggled rather than left on `auto`, so a scrollbar cannot
 *     flicker in while the box is still growing.
 *
 * The cap comes from the element's computed `max-height`, so the caller sets it
 * with a `max-h-*` class and this needs no magic number.
 */
export function useAutoGrow(ref: RefObject<HTMLTextAreaElement | null>, value: string): void {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    const borders = el.offsetHeight - el.clientHeight
    const max = parseFloat(getComputedStyle(el).maxHeight) || Infinity
    const wanted = el.scrollHeight + borders
    el.style.height = `${Math.min(wanted, max)}px`
    el.style.overflowY = wanted > max ? "auto" : "hidden"
  }, [ref, value])
}
