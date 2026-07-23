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

    // Multi-colour treatment: [data-multicolor] switches on the gradient
    // primary controls + two-hue ambient background in globals.css.
    function clearGradient() {
      delete root.dataset.multicolor
      root.style.removeProperty("--mc-1")
      root.style.removeProperty("--mc-2")
    }

    if (!theme) {
      for (const key of PALETTE_KEYS) {
        root.style.removeProperty(`--${key}`)
      }
      clearGradient()
      return
    }

    if (theme.mode === "dark" && resolvedTheme !== "dark") setTheme("dark")
    if (theme.mode === "light" && resolvedTheme !== "light") setTheme("light")

    for (const key of PALETTE_KEYS) {
      root.style.setProperty(`--${key}`, theme.palette[key])
    }

    if (theme.gradient) {
      root.dataset.multicolor = "true"
      root.style.setProperty("--mc-1", theme.gradient.from)
      root.style.setProperty("--mc-2", theme.gradient.to)
    } else {
      clearGradient()
    }
  }, [paletteId, resolvedTheme, setTheme])

  return null
}
