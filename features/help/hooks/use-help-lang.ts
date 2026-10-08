"use client"

import { useCallback, useSyncExternalStore } from "react"
import type { HelpLang } from "../types"

// A store, not state + effect, so every open guide and the switch agree instantly; the server
// render (no storage) is English.

const KEY = "dnms-help-lang"
const listeners = new Set<() => void>()
/** Kept in memory too, so the switch still works where storage is blocked. */
let current: HelpLang | null = null

function read(): HelpLang {
  if (current) return current
  try {
    return localStorage.getItem(KEY) === "hi" ? "hi" : "en"
  } catch {
    return "en"
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  window.addEventListener("storage", onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener("storage", onChange)
  }
}

export function useHelpLang(): [HelpLang, (lang: HelpLang) => void] {
  const lang = useSyncExternalStore(subscribe, read, () => "en" as const)
  const setLang = useCallback((next: HelpLang) => {
    current = next
    try {
      localStorage.setItem(KEY, next)
    } catch {}
    listeners.forEach((fn) => fn())
  }, [])
  return [lang, setLang]
}
