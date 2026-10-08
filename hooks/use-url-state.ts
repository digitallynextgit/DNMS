"use client"

import { useCallback } from "react"
import { usePathname, useSearchParams } from "next/navigation"

/**
 * useState-like UI state kept in `?<key>=` (survives reload, deep links, back/forward); dropped
 * at its default. Uses history.replaceState, NOT router.replace, which would refetch the RSC
 * payload (layout auth + DB) on every click and keystroke.
 */
export function useUrlState(key: string, defaultValue: string): [string, (value: string) => void] {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const value = searchParams.get(key) ?? defaultValue

  const setValue = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (!next || next === defaultValue) params.delete(key)
      else params.set(key, next)
      const qs = params.toString()
      window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname)
    },
    [key, defaultValue, pathname, searchParams],
  )

  return [value, setValue]
}

/** 1-indexed page for table pagination; page 1 is left out of the URL. */
export function useUrlPage(key = "page"): [number, (page: number) => void] {
  const [raw, setRaw] = useUrlState(key, "1")
  const page = Math.max(1, Number(raw) || 1)
  const setPage = useCallback((next: number) => setRaw(String(next)), [setRaw])
  return [page, setPage]
}
