/** Red, green and blue, each a whole number 0-255. */
export interface Rgb {
  r: number
  g: number
  b: number
}
/** Hue 0-360, saturation and lightness 0-100. */
export interface Hsl {
  h: number
  s: number
  l: number
}
/** Cyan, magenta, yellow and black, each 0-100. */
export interface Cmyk {
  c: number
  m: number
  y: number
  k: number
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const hex2 = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0")

export function rgbToHex({ r, g, b }: Rgb): string {
  return `#${hex2(r)}${hex2(g)}${hex2(b)}`.toUpperCase()
}

/** "#abc", "#aabbcc" (and 4 / 8 digit forms, alpha ignored), with or without the #. */
export function hexToRgb(input: string): Rgb | null {
  const m = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(input.trim())
  if (!m?.[1]) return null
  let hex = m[1]
  if (hex.length <= 4) hex = [...hex].map((c) => c + c).join("")
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  }
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return { h: 0, s: 0, l: l * 100 }
  const s = d / (1 - Math.abs(2 * l - 1))
  let h: number
  if (max === rn) h = ((gn - bn) / d) % 6
  else if (max === gn) h = (bn - rn) / d + 2
  else h = (rn - gn) / d + 4
  h *= 60
  if (h < 0) h += 360
  return { h, s: s * 100, l: l * 100 }
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const sn = clamp(s, 0, 100) / 100
  const ln = clamp(l, 0, 100) / 100
  const hn = ((h % 360) + 360) % 360
  const c = (1 - Math.abs(2 * ln - 1)) * sn
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1))
  const m = ln - c / 2
  const [r1, g1, b1] =
    hn < 60
      ? [c, x, 0]
      : hn < 120
        ? [x, c, 0]
        : hn < 180
          ? [0, c, x]
          : hn < 240
            ? [0, x, c]
            : hn < 300
              ? [x, 0, c]
              : [c, 0, x]
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  }
}

/** The simple screen-to-print formula - real print colours depend on the printer and paper. */
export function rgbToCmyk({ r, g, b }: Rgb): Cmyk {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const k = 1 - Math.max(rn, gn, bn)
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 }
  return {
    c: ((1 - rn - k) / (1 - k)) * 100,
    m: ((1 - gn - k) / (1 - k)) * 100,
    y: ((1 - bn - k) / (1 - k)) * 100,
    k: k * 100,
  }
}

export function cmykToRgb({ c, m, y, k }: Cmyk): Rgb {
  const kn = clamp(k, 0, 100) / 100
  const f = (v: number) => Math.round(255 * (1 - clamp(v, 0, 100) / 100) * (1 - kn))
  return { r: f(c), g: f(m), b: f(y) }
}

export function formatRgb({ r, g, b }: Rgb): string {
  return `rgb(${r}, ${g}, ${b})`
}

export function formatHsl(rgb: Rgb): string {
  const { h, s, l } = rgbToHsl(rgb)
  return `hsl(${Math.round(h) % 360}, ${Math.round(s)}%, ${Math.round(l)}%)`
}

export function formatCmyk(rgb: Rgb): string {
  const { c, m, y, k } = rgbToCmyk(rgb)
  return `cmyk(${Math.round(c)}%, ${Math.round(m)}%, ${Math.round(y)}%, ${Math.round(k)}%)`
}

function readNumber(token: string): { value: number; percent: boolean } | null {
  const m = /^([+-]?(?:\d+\.?\d*|\.\d+))(%|deg)?$/.exec(token)
  if (!m?.[1]) return null
  return { value: Number(m[1]), percent: m[2] === "%" }
}

function readRgb(tokens: string[]): Rgb | null {
  if (tokens.length < 3 || tokens.length > 4) return null
  const out: number[] = []
  for (const t of tokens.slice(0, 3)) {
    const n = readNumber(t)
    if (!n) return null
    const v = n.percent ? (n.value / 100) * 255 : n.value
    if (v < 0 || v > 255) return null
    out.push(Math.round(v))
  }
  const [r = 0, g = 0, b = 0] = out
  return { r, g, b }
}

function readHsl(tokens: string[]): Rgb | null {
  if (tokens.length < 3 || tokens.length > 4) return null
  const [h, s, l] = tokens.slice(0, 3).map(readNumber)
  if (!h || !s || !l || h.percent) return null
  if (s.value < 0 || s.value > 100 || l.value < 0 || l.value > 100) return null
  return hslToRgb({ h: h.value, s: s.value, l: l.value })
}

function readCmyk(tokens: string[]): Rgb | null {
  if (tokens.length !== 4) return null
  const values: number[] = []
  for (const t of tokens) {
    const n = readNumber(t)
    if (!n || n.value < 0 || n.value > 100) return null
    values.push(n.value)
  }
  const [c = 0, m = 0, y = 0, k = 0] = values
  return cmykToRgb({ c, m, y, k })
}

/** "#26e", "rgb(37, 99, 235)", "37 99 235", "hsl(221 83% 53%)", "cmyk(84, 58, 0, 8)"... Alpha is ignored. */
export function parseColour(input: string): Rgb | null {
  const text = input.trim().toLowerCase().replace(/;$/, "")
  if (!text) return null
  const hex = hexToRgb(text)
  if (hex) return hex

  const fn = /^(rgba?|hsla?|cmyk)\s*\((.*)\)$/.exec(text)
  const kind = fn ? fn[1] : "rgb"
  const body = fn ? (fn[2] ?? "") : text
  const tokens = body.split(/[\s,/]+/).filter(Boolean)
  if (kind === "hsl" || kind === "hsla") return readHsl(tokens)
  if (kind === "cmyk") return readCmyk(tokens)
  // Bare numbers ("37, 99, 235") are read as RGB - but only three of them.
  if (!fn && tokens.length !== 3) return null
  return readRgb(tokens)
}

function channel(v: number): number {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG contrast ratio, from 1 (same colour) to 21 (black on white). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Cut (not rounded) to 2 decimals, so a ratio that just misses 4.5 never shows as "4.50". */
export function formatRatio(ratio: number): string {
  return `${(Math.floor(ratio * 100) / 100).toFixed(2)} : 1`
}

export interface WcagChecks {
  /** Normal text, level AA - needs 4.5:1. */
  aaNormal: boolean
  /** Large text (24px, or 18.5px bold), level AA - needs 3:1. */
  aaLarge: boolean
  /** Normal text, level AAA - needs 7:1. */
  aaaNormal: boolean
  /** Large text, level AAA - needs 4.5:1. */
  aaaLarge: boolean
}

export function wcagChecks(ratio: number): WcagChecks {
  return {
    aaNormal: ratio >= 4.5,
    aaLarge: ratio >= 3,
    aaaNormal: ratio >= 7,
    aaaLarge: ratio >= 4.5,
  }
}

export function textColourOn(bg: Rgb): "#000000" | "#FFFFFF" {
  const black = contrastRatio(bg, { r: 0, g: 0, b: 0 })
  const white = contrastRatio(bg, { r: 255, g: 255, b: 255 })
  return black >= white ? "#000000" : "#FFFFFF"
}

export interface PaletteColour {
  rgb: Rgb
  hex: string
  /** Share of the (non-transparent) pixels, 0-1. */
  share: number
}

interface Bin {
  r: number
  g: number
  b: number
  n: number
}

/** Rough "how different do these look" - green counts most, blue least. */
function distance(a: Bin, b: Bin): number {
  const dr = a.r - b.r
  const dg = a.g - b.g
  const db = a.b - b.b
  return 2 * dr * dr + 4 * dg * dg + 3 * db * db
}

/**
 * Most common first. `pixels` is RGBA (canvas getImageData) - downsample first. Pixels are
 * bucketed, then common-and-distinct starting colours are refined by k-means. Deterministic.
 */
export function extractPalette(pixels: ArrayLike<number>, count: number): PaletteColour[] {
  const k = clamp(Math.round(count), 1, 16)
  const bins = new Map<number, Bin>()
  let total = 0
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const r = pixels[i] ?? 0
    const g = pixels[i + 1] ?? 0
    const b = pixels[i + 2] ?? 0
    const a = pixels[i + 3] ?? 255
    if (a < 128) continue // mostly see-through: not part of the picture
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)
    const bin = bins.get(key)
    if (bin) {
      bin.r += r
      bin.g += g
      bin.b += b
      bin.n++
    } else bins.set(key, { r, g, b, n: 1 })
    total++
  }
  if (!total) return []
  const points: Bin[] = [...bins.values()].map((p) => ({
    r: p.r / p.n,
    g: p.g / p.n,
    b: p.b / p.n,
    n: p.n,
  }))

  // Starting centres: the most common bucket, then repeatedly the bucket that
  // is both common and far from every centre so far.
  const centres: Bin[] = []
  const nearest = new Array<number>(points.length).fill(Infinity)
  let first = points[0] as Bin
  for (const p of points) if (p.n > first.n) first = p
  centres.push({ ...first })
  while (centres.length < k) {
    const last = centres[centres.length - 1] as Bin
    let best = -1
    let bestScore = 0
    points.forEach((p, i) => {
      const d = Math.min(nearest[i] ?? Infinity, distance(p, last))
      nearest[i] = d
      const score = d * p.n
      if (score > bestScore) {
        bestScore = score
        best = i
      }
    })
    if (best < 0) break // fewer distinct colours than asked for
    centres.push({ ...(points[best] as Bin) })
  }

  // k-means, weighted by how many pixels each bucket holds.
  const assign = new Array<number>(points.length).fill(0)
  for (let round = 0; round < 10; round++) {
    points.forEach((p, i) => {
      let bestC = 0
      let bestD = Infinity
      centres.forEach((c, ci) => {
        const d = distance(p, c)
        if (d < bestD) {
          bestD = d
          bestC = ci
        }
      })
      assign[i] = bestC
    })
    const sums = centres.map(() => ({ r: 0, g: 0, b: 0, n: 0 }))
    points.forEach((p, i) => {
      const s = sums[assign[i] ?? 0]
      if (!s) return
      s.r += p.r * p.n
      s.g += p.g * p.n
      s.b += p.b * p.n
      s.n += p.n
    })
    let moved = false
    sums.forEach((s, ci) => {
      const c = centres[ci]
      if (!c) return
      if (!s.n) {
        c.n = 0
        return
      }
      const next = { r: s.r / s.n, g: s.g / s.n, b: s.b / s.n, n: s.n }
      if (distance(c, next) > 0.25) moved = true
      Object.assign(c, next)
    })
    if (!moved) break
  }

  // Merge any centres that round to the same HEX, most common first.
  const byHex = new Map<string, PaletteColour & { n: number }>()
  for (const c of centres) {
    if (!c.n) continue
    const rgb = { r: Math.round(c.r), g: Math.round(c.g), b: Math.round(c.b) }
    const hex = rgbToHex(rgb)
    const seen = byHex.get(hex)
    if (seen) seen.n += c.n
    else byHex.set(hex, { rgb, hex, share: 0, n: c.n })
  }
  return [...byHex.values()]
    .sort((a, b) => b.n - a.n)
    .map(({ rgb, hex, n }) => ({ rgb, hex, share: n / total }))
}
