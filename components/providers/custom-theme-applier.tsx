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

    // Vibrant themes layer a gradient/glow background + designed controls on top
    // of the palette. We expose the two swatch colours so CSS can build gradients.
    function clearVibrant() {
      delete root.dataset.vibrant
      root.style.removeProperty("--vibrant-c1")
      root.style.removeProperty("--vibrant-c2")
    }

    if (!theme) {
      for (const key of PALETTE_KEYS) {
        root.style.removeProperty(`--${key}`)
      }
      clearVibrant()
      return
    }

    if (theme.mode === "dark" && resolvedTheme !== "dark") setTheme("dark")
    if (theme.mode === "light" && resolvedTheme !== "light") setTheme("light")

    for (const key of PALETTE_KEYS) {
      root.style.setProperty(`--${key}`, theme.palette[key])
    }

    if (theme.category === "vibrant") {
      root.dataset.vibrant = "true"
      root.style.setProperty("--vibrant-c1", theme.swatchPrimary)
      root.style.setProperty("--vibrant-c2", theme.swatchAccent)
    } else {
      clearVibrant()
    }
  }, [paletteId, resolvedTheme, setTheme])

  return null
}
