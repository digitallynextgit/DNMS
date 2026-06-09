import { create } from "zustand"
import { persist } from "zustand/middleware"
import { findTheme, type Palette } from "@/lib/themes"

interface ThemeStore {
  paletteId: string | null
  mode: "dark" | "light" | null
  cssVars: Palette | null
  setPalette: (id: string | null) => void
  clearPalette: () => void
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      paletteId: null,
      mode: null,
      cssVars: null,
      setPalette: (id) => {
        if (!id) {
          set({ paletteId: null, mode: null, cssVars: null })
          return
        }
        const theme = findTheme(id)
        if (!theme) return
        set({ paletteId: id, mode: theme.mode, cssVars: theme.palette })
      },
      clearPalette: () => set({ paletteId: null, mode: null, cssVars: null }),
    }),
    {
      name: "dnms-theme-palette",
      version: 1,
      migrate: (persisted, version) => {
        if (version < 1) {
          const id = (persisted as { paletteId?: string } | null)?.paletteId
          const theme = findTheme(id)
          if (theme) {
            return { paletteId: theme.id, mode: theme.mode, cssVars: theme.palette }
          }
          return { paletteId: null, mode: null, cssVars: null }
        }
        return persisted as ThemeStore
      },
    },
  ),
)
