"use client"

import { useCallback, useState, useSyncExternalStore } from "react"

const subscribeNever = () => () => {}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/**
 * A string kept in this browser under `key` (no key: plain state). Starts at `initial` on the server
 * and while hydrating, so the markup matches, then switches to the saved value.
 */
export function useStoredState(
  key: string | undefined,
  initial: string,
): [string, (next: string) => void] {
  const [value, setValue] = useState(initial)
  const stored = useSyncExternalStore<string | null | undefined>(
    subscribeNever,
    () => (key ? read(key) : null),
    () => undefined,
  )
  const [restoredKey, setRestoredKey] = useState<string | null>(null)
  if (key && stored !== undefined && restoredKey !== key) {
    setRestoredKey(key)
    if (stored != null) setValue(stored)
  }

  const update = useCallback(
    (next: string) => {
      setValue(next)
      if (!key) return
      try {
        localStorage.setItem(key, next)
      } catch {}
    },
    [key],
  )

  return [value, update]
}
