// =============================================================================
// Curated theme palettes.
//
// Deliberately SMALL: one well-chosen dark theme per colour family. An earlier
// iteration shipped 123 generated variants ("Royal Purple" vs "Deep Violet" vs
// "Amethyst"…) that differed by a few HSL degrees - nobody could tell them
// apart, and picking one was noise, not choice. The survivors keep their
// original ids, so anyone already using one keeps exactly the same palette.
// =============================================================================

export type ThemeCategory =
  | "purple"
  | "blue"
  | "black"
  | "green"
  | "red"
  | "amber"
  | "teal"
  | "multi"

export type Palette = {
  background: string
  foreground: string
  card: string
  "card-foreground": string
  popover: string
  "popover-foreground": string
  primary: string
  "primary-foreground": string
  secondary: string
  "secondary-foreground": string
  muted: string
  "muted-foreground": string
  accent: string
  "accent-foreground": string
  destructive: string
  "destructive-foreground": string
  success: string
  "success-foreground": string
  warning: string
  "warning-foreground": string
  border: string
  input: string
  ring: string
}

export type Theme = {
  id: string
  name: string
  category: ThemeCategory
  mode: "dark" | "light"
  swatchBg: string
  swatchPrimary: string
  swatchAccent: string
  palette: Palette
  /** When set, primary controls render as a gradient between these two colours
   *  and the app gets a subtle two-hue ambient background (CSS reads them via
   *  --mc-1/--mc-2). This is what makes a multi-colour theme look designed
   *  rather than merely recoloured. */
  gradient?: { from: string; to: string }
}

function hslToHex(h: number, s: number, l: number): string {
  const sPct = s / 100
  const lPct = l / 100
  const c = (1 - Math.abs(2 * lPct - 1)) * sPct
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = lPct - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0")
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

type DarkSpec = {
  id: string
  name: string
  category: ThemeCategory
  bgHue: number
  bgSat: number
  bgLight: number
  primaryHue: number
  primarySat: number
  primaryLight: number
}

// Unchanged from the original generator - the kept themes must produce the
// exact palettes they always had.
function makeDark(s: DarkSpec): Theme {
  const { bgHue, bgSat, bgLight, primaryHue, primarySat, primaryLight } = s
  const surfaceLight = Math.min(bgLight + 4, 22)
  const elevatedLight = Math.min(bgLight + 8, 28)
  const accentLight = Math.min(bgLight + 14, 34)
  const borderLight = Math.min(bgLight + 10, 30)
  const fgSat = Math.min(bgSat + 15, 55)
  const fgLight = 92
  const mutedFgSat = Math.max(Math.floor(bgSat * 0.6), 10)
  const mutedFgLight = 65

  const hsl = (h: number, sat: number, light: number) => `${h} ${sat}% ${light}%`

  return {
    id: s.id,
    name: s.name,
    category: s.category,
    mode: "dark",
    swatchBg: hslToHex(bgHue, bgSat, bgLight),
    swatchPrimary: hslToHex(primaryHue, primarySat, primaryLight),
    swatchAccent: hslToHex(bgHue, bgSat, accentLight),
    palette: {
      background: hsl(bgHue, bgSat, bgLight),
      foreground: hsl(bgHue, fgSat, fgLight),
      card: hsl(bgHue, bgSat, surfaceLight),
      "card-foreground": hsl(bgHue, fgSat, fgLight),
      popover: hsl(bgHue, bgSat, surfaceLight),
      "popover-foreground": hsl(bgHue, fgSat, fgLight),
      primary: hsl(primaryHue, primarySat, primaryLight),
      "primary-foreground": primaryLight > 60 ? hsl(bgHue, bgSat, bgLight) : "0 0% 100%",
      secondary: hsl(bgHue, Math.floor(bgSat * 0.85), elevatedLight),
      "secondary-foreground": hsl(bgHue, fgSat, fgLight),
      muted: hsl(bgHue, Math.floor(bgSat * 0.85), elevatedLight),
      "muted-foreground": hsl(bgHue, mutedFgSat, mutedFgLight),
      accent: hsl(bgHue, bgSat, accentLight),
      "accent-foreground": hsl(bgHue, fgSat, fgLight),
      destructive: "0 75% 60%",
      "destructive-foreground": "0 0% 100%",
      success: "142 60% 50%",
      "success-foreground": "0 0% 100%",
      warning: "38 90% 58%",
      "warning-foreground": "0 0% 10%",
      border: hsl(bgHue, Math.floor(bgSat * 0.8), borderLight),
      input: hsl(bgHue, Math.floor(bgSat * 0.8), borderLight),
      ring: hsl(primaryHue, primarySat, primaryLight),
    },
  }
}

// One per family - the most distinctive of its former group.
export const themes: Theme[] = [
  makeDark({
    id: "purple-royal",
    name: "Royal Purple",
    category: "purple",
    bgHue: 270,
    bgSat: 30,
    bgLight: 12,
    primaryHue: 270,
    primarySat: 75,
    primaryLight: 65,
  }),
  makeDark({
    id: "blue-tokyo-night",
    name: "Tokyo Night",
    category: "blue",
    bgHue: 232,
    bgSat: 21,
    bgLight: 13,
    primaryHue: 218,
    primarySat: 89,
    primaryLight: 72,
  }),
  makeDark({
    id: "black-charcoal",
    name: "Charcoal",
    category: "black",
    bgHue: 0,
    bgSat: 0,
    bgLight: 9,
    primaryHue: 0,
    primarySat: 0,
    primaryLight: 88,
  }),
  makeDark({
    id: "teal-deep",
    name: "Deep Teal",
    category: "teal",
    bgHue: 180,
    bgSat: 35,
    bgLight: 11,
    primaryHue: 180,
    primarySat: 75,
    primaryLight: 55,
  }),
  makeDark({
    id: "green-emerald",
    name: "Emerald",
    category: "green",
    bgHue: 155,
    bgSat: 35,
    bgLight: 11,
    primaryHue: 150,
    primarySat: 70,
    primaryLight: 55,
  }),
  makeDark({
    id: "red-wine",
    name: "Wine",
    category: "red",
    bgHue: 350,
    bgSat: 35,
    bgLight: 12,
    primaryHue: 350,
    primarySat: 75,
    primaryLight: 60,
  }),
  // Multi-colour: hand-built rather than generated. Deep navy base, violet
  // primary, cyan second accent - the classic "modern dashboard" pairing. The
  // gradient field drives purple->cyan primary buttons + ambient glow.
  {
    id: "multi-aurora",
    name: "Aurora",
    category: "multi",
    mode: "dark",
    swatchBg: hslToHex(233, 34, 12),
    swatchPrimary: hslToHex(270, 85, 67),
    swatchAccent: hslToHex(187, 80, 55),
    gradient: { from: hslToHex(270, 85, 67), to: hslToHex(187, 80, 55) },
    palette: {
      background: "233 34% 11%",
      foreground: "230 40% 94%",
      card: "233 30% 15%",
      "card-foreground": "230 40% 94%",
      popover: "233 30% 15%",
      "popover-foreground": "230 40% 94%",
      primary: "270 85% 67%",
      "primary-foreground": "0 0% 100%",
      secondary: "233 28% 19%",
      "secondary-foreground": "230 40% 94%",
      muted: "233 28% 19%",
      "muted-foreground": "230 18% 68%",
      // The accent surface leans cyan so hover states pick up the second hue.
      accent: "210 35% 22%",
      "accent-foreground": "230 40% 94%",
      destructive: "348 80% 60%",
      "destructive-foreground": "0 0% 100%",
      success: "160 70% 45%",
      "success-foreground": "0 0% 100%",
      warning: "38 90% 58%",
      "warning-foreground": "0 0% 10%",
      border: "233 26% 22%",
      input: "233 26% 22%",
      ring: "270 85% 67%",
    },
  },
  makeDark({
    id: "amber-coffee",
    name: "Coffee",
    category: "amber",
    bgHue: 25,
    bgSat: 28,
    bgLight: 11,
    primaryHue: 30,
    primarySat: 70,
    primaryLight: 60,
  }),
]

export function findTheme(id: string | null | undefined): Theme | undefined {
  if (!id) return undefined
  return themes.find((t) => t.id === id)
}

export const PALETTE_KEYS: Array<keyof Palette> = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "success",
  "success-foreground",
  "warning",
  "warning-foreground",
  "border",
  "input",
  "ring",
]
