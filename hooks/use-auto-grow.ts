"use client"

import { useLayoutEffect, type RefObject } from "react"

/**
 * Grow a textarea to fit its text up to its CSS `max-height` (a `max-h-*` class), then scroll.
 * Borders are added back (offsetHeight - clientHeight), or an empty field shows a scrollbar.
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
