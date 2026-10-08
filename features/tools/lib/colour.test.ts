import { describe, expect, it } from "vitest"
import {
  contrastRatio,
  extractPalette,
  formatCmyk,
  formatHsl,
  formatRatio,
  formatRgb,
  hexToRgb,
  hslToRgb,
  parseColour,
  rgbToHex,
  rgbToHsl,
  textColourOn,
  wcagChecks,
} from "./colour"

const BLUE = { r: 37, g: 99, b: 235 }

describe("parseColour", () => {
  it("reads HEX in its common shapes", () => {
    expect(parseColour("#2563eb")).toEqual(BLUE)
    expect(parseColour("2563EB")).toEqual(BLUE)
    expect(parseColour("#fff")).toEqual({ r: 255, g: 255, b: 255 })
    expect(parseColour("#2563ebcc")).toEqual(BLUE) // alpha ignored
  })

  it("reads RGB, with or without rgb()", () => {
    expect(parseColour("rgb(37, 99, 235)")).toEqual(BLUE)
    expect(parseColour("rgba(37,99,235,0.5)")).toEqual(BLUE)
    expect(parseColour("rgb(37 99 235 / 50%)")).toEqual(BLUE)
    expect(parseColour("37, 99, 235")).toEqual(BLUE)
    expect(parseColour("rgb(100%, 0%, 0%)")).toEqual({ r: 255, g: 0, b: 0 })
  })

  it("reads HSL and CMYK", () => {
    expect(parseColour("hsl(0, 100%, 50%)")).toEqual({ r: 255, g: 0, b: 0 })
    expect(parseColour("hsl(120deg 100% 25%)")).toEqual({ r: 0, g: 128, b: 0 })
    expect(parseColour("cmyk(0%, 100%, 100%, 0%)")).toEqual({ r: 255, g: 0, b: 0 })
  })

  it("says no to things that aren't colours", () => {
    for (const bad of ["", "blue-ish", "#12", "rgb(300, 0, 0)", "hsl(10, 120%, 50%)", "1, 2"])
      expect(parseColour(bad)).toBeNull()
  })
})

describe("conversions", () => {
  it("round-trips HEX and HSL", () => {
    for (const hex of ["#2563EB", "#000000", "#FFFFFF", "#7F7F7F", "#E11D48", "#10B981"]) {
      const rgb = hexToRgb(hex)
      if (!rgb) throw new Error("expected a colour")
      expect(rgbToHex(rgb)).toBe(hex)
      expect(rgbToHex(hslToRgb(rgbToHsl(rgb)))).toBe(hex)
    }
  })

  it("formats every code", () => {
    expect(formatRgb(BLUE)).toBe("rgb(37, 99, 235)")
    expect(formatHsl(BLUE)).toBe("hsl(221, 83%, 53%)")
    expect(formatCmyk(BLUE)).toBe("cmyk(84%, 58%, 0%, 8%)")
    expect(formatCmyk({ r: 0, g: 0, b: 0 })).toBe("cmyk(0%, 0%, 0%, 100%)")
  })
})

describe("contrast", () => {
  it("matches the WCAG reference points", () => {
    const black = { r: 0, g: 0, b: 0 }
    const white = { r: 255, g: 255, b: 255 }
    expect(contrastRatio(black, white)).toBeCloseTo(21, 5)
    expect(contrastRatio(white, white)).toBeCloseTo(1, 5)
    // #767676 is the classic "just passes AA on white" grey.
    expect(contrastRatio({ r: 0x76, g: 0x76, b: 0x76 }, white)).toBeCloseTo(4.54, 2)
  })

  it("never shows a fail as 4.50", () => {
    expect(formatRatio(4.4999)).toBe("4.49 : 1")
    expect(wcagChecks(4.4999)).toEqual({
      aaNormal: false,
      aaLarge: true,
      aaaNormal: false,
      aaaLarge: false,
    })
    expect(wcagChecks(7)).toEqual({
      aaNormal: true,
      aaLarge: true,
      aaaNormal: true,
      aaaLarge: true,
    })
  })

  it("picks readable label text", () => {
    expect(textColourOn({ r: 255, g: 255, b: 0 })).toBe("#000000")
    expect(textColourOn({ r: 20, g: 20, b: 80 })).toBe("#FFFFFF")
  })
})

describe("extractPalette", () => {
  function pixels(colours: [number, number, number, number][], each: number[]) {
    const out: number[] = []
    colours.forEach((c, i) => {
      for (let n = 0; n < (each[i] ?? 0); n++) out.push(...c)
    })
    return Uint8ClampedArray.from(out)
  }

  it("finds the colours in a simple picture, most common first", () => {
    const data = pixels(
      [
        [220, 30, 30, 255],
        [20, 40, 200, 255],
      ],
      [700, 300],
    )
    const palette = extractPalette(data, 6)
    expect(palette.map((p) => p.hex)).toEqual(["#DC1E1E", "#1428C8"])
    expect(palette[0]?.share).toBeCloseTo(0.7, 5)
  })

  it("ignores see-through pixels", () => {
    const data = pixels(
      [
        [0, 0, 0, 0],
        [250, 250, 250, 255],
      ],
      [900, 100],
    )
    expect(extractPalette(data, 5)).toEqual([
      { rgb: { r: 250, g: 250, b: 250 }, hex: "#FAFAFA", share: 1 },
    ])
  })

  it("gives the number asked for from a busy picture, and the same answer every time", () => {
    const out: number[] = []
    for (let r = 0; r < 256; r += 8)
      for (let g = 0; g < 256; g += 16) for (let b = 0; b < 256; b += 32) out.push(r, g, b, 255)
    const data = Uint8ClampedArray.from(out)
    const a = extractPalette(data, 8)
    expect(a).toHaveLength(8)
    expect(new Set(a.map((p) => p.hex)).size).toBe(8)
    expect(extractPalette(data, 8)).toEqual(a)
    expect(a.reduce((s, p) => s + p.share, 0)).toBeCloseTo(1, 5)
  })

  it("is empty for an empty or fully transparent image", () => {
    expect(extractPalette(new Uint8ClampedArray(0), 5)).toEqual([])
    expect(extractPalette(new Uint8ClampedArray([1, 2, 3, 0]), 5)).toEqual([])
  })
})
