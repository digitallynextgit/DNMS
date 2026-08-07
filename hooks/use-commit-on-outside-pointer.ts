"use client"

import { useEffect, useRef, type RefObject } from "react"

/**
 * Close an open inline editor when a pointer goes down anywhere outside it.
 *
 * `onBlur` alone is not enough to mean "clicked away": it never fires when the
 * pointer lands on a scroll container's own scrollbar, on a target whose
 * mousedown is prevented, or when focus leaves the document altogether. An
 * editor that silently keeps unsaved text in those cases is the worst outcome,
 * so this runs in the CAPTURE phase - ahead of anything that might swallow the
 * event - and the commit it calls is expected to be idempotent, so pairing it
 * with onBlur is safe.
 */
export function useCommitOnOutsidePointer(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  commit: () => void,
) {
  const latest = useRef(commit)
  latest.current = commit

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
