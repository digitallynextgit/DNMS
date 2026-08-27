"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { useThemeStore } from "@/stores/theme-store"
import { findTheme, PALETTE_KEYS } from "@/lib/themes"
import { isMarketingPath } from "@/lib/marketing-routes"

export function CustomThemeApplier() {
  const { paletteId } = useThemeStore()
  const { setTheme, resolvedTheme } = useTheme()
  const pathname = usePathname()

  useEffect(() => {
    const root = document.documentElement
    // Marketing pages get no custom palette. This component lives in the ROOT
    // layout, so without the check it painted the dashboard's chosen colours
    // onto the public site - which is not themeable and hardcodes the brand red.
    // Treated exactly like "no palette selected": the variables are removed
    // rather than overridden, so nothing is left behind for the next page.
    const theme = isMarketingPath(pathname) ? null : findTheme(paletteId)

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
  }, [paletteId, resolvedTheme, setTheme, pathname])

  return null
}
