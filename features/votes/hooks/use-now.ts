"use client"

import { useSyncExternalStore } from "react"

// One shared 30s clock for the countdowns: reading Date.now() during render would be impure.
let now = 0
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | null = null

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (!timer) {
    now = Date.now()
    timer = setInterval(() => {
      now = Date.now()
      listeners.forEach((l) => l())
    }, 30_000)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && timer) {
      clearInterval(timer)
      timer = null
    }
  }
}

const getSnapshot = (): number => (now === 0 ? (now = Date.now()) : now)
/** 0 on the server: callers hide the countdown until the browser has a clock. */
const getServerSnapshot = (): number => 0

export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
