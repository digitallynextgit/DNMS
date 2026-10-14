import { create } from "zustand"
import { persist } from "zustand/middleware"
import { DEFAULT_THEME_ID, findTheme, type Palette, type Theme } from "@/lib/themes"

interface ThemeStore {
  paletteId: string | null
  mode: "dark" | "light" | null
  cssVars: Palette | null
  /** Read by public/theme-boot.js before first paint, so the module hues don't flash in. */
  modules: boolean
  setPalette: (id: string | null) => void
  clearPalette: () => void
}

const stateOf = (theme: Theme) => ({
  paletteId: theme.id,
  mode: theme.mode,
  cssVars: theme.palette,
  modules: !!theme.modules,
})
/** No palette: the classic light/dark from globals.css (the picker's Classic buttons). */
const CLASSIC = { paletteId: null, mode: null, cssVars: null, modules: false }
const DEFAULT_STATE = stateOf(findTheme(DEFAULT_THEME_ID)!)

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      ...DEFAULT_STATE,
      setPalette: (id) => {
        if (!id) {
          set(CLASSIC)
          return
        }
        const theme = findTheme(id)
        if (!theme) return
        set(stateOf(theme))
      },
      clearPalette: () => set(CLASSIC),
    }),
    {
      name: "dnms-theme-palette",
      // v3: Module Colours became the default, so a saved "no palette" from before moves to it.
      // A saved theme that no longer exists falls back to the default too.
      version: 3,
      migrate: (persisted) => {
        const id = (persisted as { paletteId?: string } | null)?.paletteId
        const theme = findTheme(id)
        return theme ? stateOf(theme) : DEFAULT_STATE
      },
    },
  ),
)
