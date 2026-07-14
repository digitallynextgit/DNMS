"use client"

import { useCallback } from "react"
import { usePathname, useSearchParams } from "next/navigation"

/**
 * Persist a small piece of UI state (active tab, current page, view mode, …) in
 * the URL query string so it survives a full page reload, deep-linking, and the
 * browser back/forward buttons - instead of living in `useState`, which resets
 * to its default every time the component remounts.
 *
 * Mirrors the `useState` API: returns `[value, setValue]`. The value is read
 * live from the `?<key>=` search param (falling back to `defaultValue`), so
 * back/forward navigation updates it automatically. The param is removed
 * entirely when set back to the default, keeping URLs tidy.
 *
 * IMPORTANT - why this uses `window.history.replaceState` and NOT `router.replace`:
 * this state is purely CLIENT-side UI (page number, active tab, view mode). In the
 * App Router, `router.replace()` to a new URL fetches a fresh RSC payload for the
 * segment, which re-runs the dashboard layout (`auth()` + a DB lookup) and the Edge
 * middleware - on EVERY pagination click and every debounced keystroke. The native
 * history API updates the URL (and `useSearchParams`, which Next keeps in sync)
 * with no server round trip at all.
 *
 * When a page hosts more than one stateful control, give each a distinct `key`
 * (e.g. "tab", "page", "reqPage") so they don't clobber one another.
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

/**
 * Numeric variant of {@link useUrlState} for table pagination. Stores the
 * 1-indexed page in `?<key>=` (default key `"page"`); page 1 is omitted so a
 * pristine table has a clean URL. Returns `[page, setPage]` like `useState`.
 */
export function useUrlPage(key = "page"): [number, (page: number) => void] {
  const [raw, setRaw] = useUrlState(key, "1")
  const page = Math.max(1, Number(raw) || 1)
  const setPage = useCallback((next: number) => setRaw(String(next)), [setRaw])
  return [page, setPage]
}
