import { describe, expect, it } from "vitest"
import {
  FAVICON_FILES,
  buildIco,
  buildWebManifest,
  contentBox,
  cornerRadius,
  faviconHtml,
  faviconZipName,
  logoBox,
  readPngSize,
  shortName,
  svgSizing,
} from "./favicon"

/** A minimal stand-in PNG: signature + IHDR with the given size, then `extra` filler bytes. */
function fakePng(width: number, height: number, extra = 0): Uint8Array {
  const bytes = new Uint8Array(33 + extra)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  const view = new DataView(bytes.buffer)
  view.setUint32(8, 13) // IHDR length
  bytes.set([0x49, 0x48, 0x44, 0x52], 12) // "IHDR"
  view.setUint32(16, width)
  view.setUint32(20, height)
  for (let i = 33; i < bytes.length; i++) bytes[i] = i % 251
  return bytes
}

describe("readPngSize", () => {
  it("reads the size from the header", () => {
    expect(readPngSize(fakePng(48, 32))).toEqual({ width: 48, height: 32 })
  })

  it("says null for anything that isn't a PNG", () => {
    expect(readPngSize(new Uint8Array(40))).toBeNull()
    expect(readPngSize(fakePng(16, 16).slice(0, 10))).toBeNull()
  })
})

describe("buildIco", () => {
  const p16 = fakePng(16, 16, 5)
  const p32 = fakePng(32, 32, 9)
  const p48 = fakePng(48, 48, 2)
  const ico = buildIco([
    { size: 16, png: p16 },
    { size: 32, png: p32 },
    { size: 48, png: p48 },
  ])
  const view = new DataView(ico.buffer, ico.byteOffset, ico.byteLength)

  it("writes the ICONDIR header: reserved 0, type 1, image count", () => {
    expect(Array.from(ico.slice(0, 6))).toEqual([0, 0, 1, 0, 3, 0])
  })

  it("writes one 16-byte ICONDIRENTRY per image", () => {
    // First entry, byte by byte: 16x16, no palette, reserved, 1 plane, 32 bpp,
    // size (little-endian) and the offset just past the 6 + 3 * 16 byte header.
    const size = p16.length
    expect(Array.from(ico.slice(6, 22))).toEqual([
      16,
      16,
      0,
      0,
      1,
      0,
      32,
      0,
      size & 0xff,
      (size >> 8) & 0xff,
      0,
      0,
      54,
      0,
      0,
      0,
    ])
    expect(ico[22]).toBe(32)
    expect(ico[23]).toBe(32)
    expect(ico[38]).toBe(48)
    expect(ico[39]).toBe(48)
  })

  it("points each entry at its PNG, packed one after another", () => {
    const entries = [p16, p32, p48]
    let expected = 6 + 16 * 3
    entries.forEach((png, i) => {
      const e = 6 + i * 16
      expect(view.getUint32(e + 8, true)).toBe(png.length)
      expect(view.getUint32(e + 12, true)).toBe(expected)
      expect(Array.from(ico.slice(expected, expected + png.length))).toEqual(Array.from(png))
      expected += png.length
    })
    expect(ico.length).toBe(expected)
  })

  it("stores 256 px as 0, as the format requires", () => {
    const big = buildIco([{ size: 256, png: fakePng(256, 256) }])
    expect(big[6]).toBe(0)
    expect(big[7]).toBe(0)
  })

  it("refuses sizes the format can't hold, and non-PNG data", () => {
    expect(() => buildIco([])).toThrow()
    expect(() => buildIco([{ size: 512, png: fakePng(512, 512) }])).toThrow()
    expect(() => buildIco([{ size: 16, png: new Uint8Array(40) }])).toThrow()
  })
})

describe("buildWebManifest", () => {
  it("lists the Android icons and colours", () => {
    const m = JSON.parse(
      buildWebManifest({ name: "Acme", themeColour: "#112233", backgroundColour: "#ffffff" }),
    )
    expect(m.name).toBe("Acme")
    expect(m.short_name).toBe("Acme")
    expect(m.icons).toEqual([
      { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ])
    expect(m.theme_color).toBe("#112233")
    expect(m.background_color).toBe("#ffffff")
    expect(m.display).toBe("standalone")
  })

  it("leaves the names out when none is given", () => {
    const m = JSON.parse(
      buildWebManifest({ name: "  ", themeColour: "#ffffff", backgroundColour: "#ffffff" }),
    )
    expect(m).not.toHaveProperty("name")
    expect(m).not.toHaveProperty("short_name")
  })
})

describe("shortName", () => {
  it("keeps short names and shortens long ones", () => {
    expect(shortName("  Acme  ")).toBe("Acme")
    expect(shortName("Digitally Next Media")).toBe("Digitally")
    expect(shortName("Supercalifragilistic")).toBe("Supercalifra")
  })
})

describe("faviconHtml", () => {
  it("links every file a browser reads from <head> (Android icons come via the manifest)", () => {
    const html = faviconHtml("#ffffff")
    for (const f of FAVICON_FILES) {
      if (f.type === "png" && f.kind === "android") expect(html).not.toContain(f.name)
      else expect(html).toContain(`href="/${f.name}"`)
    }
    expect(html).toContain('sizes="16x16 32x32 48x48"')
    expect(html).toContain('<meta name="theme-color" content="#ffffff">')
  })
})

describe("logoBox", () => {
  it("centres a wide logo inside the padding", () => {
    expect(logoBox(100, 10, 200, 100)).toEqual({ x: 10, y: 30, w: 80, h: 40 })
  })

  it("fills the icon with no padding", () => {
    expect(logoBox(32, 0, 64, 64)).toEqual({ x: 0, y: 0, w: 32, h: 32 })
  })
})

describe("cornerRadius", () => {
  it("is zero for square and half the side for a circle", () => {
    expect(cornerRadius("square", 192)).toBe(0)
    expect(cornerRadius("circle", 192)).toBe(96)
    expect(cornerRadius("rounded", 100)).toBeCloseTo(20)
  })
})

describe("contentBox", () => {
  it("finds the non-transparent part of the pixels", () => {
    const w = 4
    const h = 3
    const rgba = new Uint8ClampedArray(w * h * 4)
    rgba[(1 * w + 1) * 4 + 3] = 255
    rgba[(2 * w + 2) * 4 + 3] = 255
    expect(contentBox(rgba, w, h)).toEqual({ x: 1, y: 1, w: 2, h: 2 })
  })

  it("is null when everything is see-through", () => {
    expect(contentBox(new Uint8ClampedArray(16), 2, 2)).toBeNull()
  })
})

describe("svgSizing", () => {
  it("sizes an SVG from its viewBox, keeping its shape", () => {
    expect(svgSizing(null, null, "0 0 200 100")).toEqual({
      width: 1024,
      height: 512,
      viewBox: null,
    })
    expect(svgSizing("100%", "100%", "0,0,50,50")).toEqual({
      width: 1024,
      height: 1024,
      viewBox: null,
    })
  })

  it("adds a viewBox when there is only a width and height", () => {
    expect(svgSizing("64px", "32", null)).toEqual({
      width: 1024,
      height: 512,
      viewBox: "0 0 64 32",
    })
  })

  it("falls back to a square", () => {
    expect(svgSizing("auto", null, "nonsense", 512)).toEqual({
      width: 512,
      height: 512,
      viewBox: null,
    })
  })
})

describe("faviconZipName", () => {
  it("uses the site name when there is one", () => {
    expect(faviconZipName("Digitally Next!")).toBe("digitally-next-favicons.zip")
    expect(faviconZipName("")).toBe("favicons.zip")
  })
})
