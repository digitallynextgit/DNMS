import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import { DEFAULT_THEME_ID, findTheme, PALETTE_KEYS, themes } from "./themes"

// public/theme-boot.js can't import, so it carries its own copy of the default theme.
const bootSource = readFileSync(
  fileURLToPath(new URL("../public/theme-boot.js", import.meta.url)),
  "utf8",
)

describe("themes", () => {
  it("has a default that exists and lights up the module hues", () => {
    const theme = findTheme(DEFAULT_THEME_ID)
    expect(theme).toBeDefined()
    expect(theme?.modules).toBe(true)
    expect(theme?.mode).toBe("dark")
  })

  it("gives every theme every palette key, and unique ids", () => {
    for (const t of themes) {
      for (const key of PALETTE_KEYS) expect(t.palette[key], `${t.id}.${key}`).toBeTruthy()
    }
    expect(new Set(themes.map((t) => t.id)).size).toBe(themes.length)
  })

  it("has a light and a dark Module Colours theme", () => {
    expect(findTheme("module-dark")?.mode).toBe("dark")
    expect(findTheme("module-light")?.mode).toBe("light")
    expect(findTheme("module-light")?.modules).toBe(true)
  })
})

describe("theme-boot.js", () => {
  it("paints exactly the default theme before React loads", () => {
    const line = bootSource.match(/var DEFAULT_THEME = (\{.*\})\s*$/m)
    expect(line, "DEFAULT_THEME line in public/theme-boot.js").not.toBeNull()
    const boot = JSON.parse(line![1]!) as {
      mode: string
      modules: boolean
      cssVars: Record<string, string>
    }
    const theme = findTheme(DEFAULT_THEME_ID)!
    expect(boot.mode).toBe(theme.mode)
    expect(boot.modules).toBe(!!theme.modules)
    expect(boot.cssVars).toEqual(theme.palette)
  })
})
