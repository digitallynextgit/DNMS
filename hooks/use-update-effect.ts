"use client"

import { useEffect, useRef, type DependencyList, type EffectCallback } from "react"

/**
 * Like {@link useEffect}, but skips the initial mount - the callback only runs on
 * subsequent dependency changes. Use for "reset on change" effects (e.g. jumping a
 * paginated list back to page 1 when a filter/view changes) so they don't clobber a
 * deep-linked/refreshed page on first render.
 */
export function useUpdateEffect(effect: EffectCallback, deps?: DependencyList) {
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    return effect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
