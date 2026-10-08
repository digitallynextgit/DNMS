"use client"

import { useEffect, useRef, type DependencyList, type EffectCallback } from "react"

/**
 * useEffect that skips the first mount - for "reset on change" effects (back to page 1 on a
 * filter change) that must not clobber a deep-linked page.
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
