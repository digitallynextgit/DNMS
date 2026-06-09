"use client"

import { useEffect } from "react"
import { useTheme } from "next-themes"
import { useThemeStore } from "@/stores/theme-store"
import { findTheme, PALETTE_KEYS } from "@/lib/themes"

export function CustomThemeApplier() {
  const { paletteId } = useThemeStore()
  const { setTheme, resolvedTheme } = useTheme()

  useEffect(() => {
    const root = document.documentElement
    const theme = findTheme(paletteId)

    if (!theme) {
      for (const key of PALETTE_KEYS) {
        root.style.removeProperty(`--${key}`)
      }
      return
    }

    if (theme.mode === "dark" && resolvedTheme !== "dark") setTheme("dark")
    if (theme.mode === "light" && resolvedTheme !== "light") setTheme("light")

    for (const key of PALETTE_KEYS) {
      root.style.setProperty(`--${key}`, theme.palette[key])
    }
  }, [paletteId, resolvedTheme, setTheme])

  return null
}
