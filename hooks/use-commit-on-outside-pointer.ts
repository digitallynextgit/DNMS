"use client"

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react"

/**
 * Commit an inline editor when a pointer goes down outside it - onBlur misses scrollbar clicks
 * and prevented mousedowns. Capture phase; `commit` must be idempotent (it pairs with onBlur).
 */
export function useCommitOnOutsidePointer(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  commit: () => void,
) {
  const latest = useRef(commit)
  useLayoutEffect(() => {
    latest.current = commit
  })

  useEffect(() => {
    if (!active) return
    function onDown(e: PointerEvent) {
      const el = ref.current
      if (!el) return
      if (e.target instanceof Node && el.contains(e.target)) return
      latest.current()
    }
    document.addEventListener("pointerdown", onDown, true)
    return () => document.removeEventListener("pointerdown", onDown, true)
  }, [ref, active])
}
