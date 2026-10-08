import { describe, expect, it } from "vitest"
import {
  MAX_SVG_SIDE,
  batchTotals,
  compressJobKey,
  compressOutput,
  convertJobKey,
  encoderQuality,
  errorText,
  fitWithin,
  imageKind,
  outputName,
  svgIntrinsicSize,
  svgTargetSize,
  withSvgSize,
  type CompressSettings,
  type ConvertSettings,
} from "./images"

describe("imageKind", () => {
  it("reads the MIME type first", () => {
    expect(imageKind({ name: "photo.png", type: "image/jpeg" })).toBe("jpeg")
    expect(imageKind({ name: "x", type: "image/svg+xml" })).toBe("svg")
    expect(imageKind({ name: "x", type: "image/x-ms-bmp" })).toBe("bmp")
  })

  it("falls back to the extension - iPhone HEIC often has no type", () => {
    expect(imageKind({ name: "IMG_0001.HEIC", type: "" })).toBe("heic")
    expect(imageKind({ name: "scan.heif", type: "" })).toBe("heic")
    expect(imageKind({ name: "photo.JPEG", type: "" })).toBe("jpeg")
    expect(imageKind({ name: "archive.tar.webp", type: "" })).toBe("webp")
  })

  it("says unknown when there's nothing to go on", () => {
    expect(imageKind({ name: "README", type: "" })).toBe("unknown")
    expect(imageKind({ name: "notes.txt", type: "text/plain" })).toBe("unknown")
  })
})

describe("fitWithin", () => {
  it("leaves the size alone with no limit, or when already small enough", () => {
    expect(fitWithin(4000, 3000, null)).toEqual({ width: 4000, height: 3000, resized: false })
    expect(fitWithin(800, 600, 1920)).toEqual({ width: 800, height: 600, resized: false })
    expect(fitWithin(1920, 1080, 1920)).toEqual({ width: 1920, height: 1080, resized: false })
  })

  it("shrinks the longest side to the limit and keeps the shape", () => {
    expect(fitWithin(4032, 3024, 1920)).toEqual({ width: 1920, height: 1440, resized: true })
    expect(fitWithin(3024, 4032, 1080)).toEqual({ width: 810, height: 1080, resized: true })
  })

  it("never rounds a side down to zero", () => {
    expect(fitWithin(10000, 2, 100)).toEqual({ width: 100, height: 1, resized: true })
  })
})

describe("encoderQuality", () => {
  it("turns a percent into 0-1 and keeps it in range", () => {
    expect(encoderQuality(80)).toBe(0.8)
    expect(encoderQuality(150)).toBe(1)
    expect(encoderQuality(0)).toBe(0.01)
  })
})

describe("outputName", () => {
  it("keeps the name when the format is unchanged", () => {
    expect(outputName("holiday.jpeg", "jpeg", "jpeg")).toBe("holiday.jpeg")
    expect(outputName("logo.png", "png", "png")).toBe("logo.png")
  })

  it("swaps the extension for a new format", () => {
    expect(outputName("IMG_0001.HEIC", "heic", "jpeg")).toBe("IMG_0001.jpg")
    expect(outputName("logo.png", "png", "webp")).toBe("logo.webp")
    expect(outputName("my.photo.bmp", "bmp", "png")).toBe("my.photo.png")
  })

  it("adds an extension when the name has none", () => {
    expect(outputName("pasted", "png", "png")).toBe("pasted.png")
  })
})

describe("batchTotals", () => {
  it("adds up sizes and works out the saving", () => {
    expect(
      batchTotals([
        { before: 1000, after: 250 },
        { before: 3000, after: 750 },
      ]),
    ).toEqual({ before: 4000, after: 1000, saved: 3000, percent: 75 })
  })

  it("is all zeros for an empty batch", () => {
    expect(batchTotals([])).toEqual({ before: 0, after: 0, saved: 0, percent: 0 })
  })
})

describe("compressOutput / compressJobKey", () => {
  const base: CompressSettings = { quality: 80, maxSide: null, format: "keep" }

  it("keeps each file's own format unless told otherwise", () => {
    expect(compressOutput("png", "keep")).toBe("png")
    expect(compressOutput("webp", "keep")).toBe("webp")
    expect(compressOutput("jpeg", "keep")).toBe("jpeg")
    expect(compressOutput("png", "jpeg")).toBe("jpeg")
    expect(compressOutput("jpeg", "webp")).toBe("webp")
  })

  it("doesn't redo a PNG when only the quality changes", () => {
    expect(compressJobKey("png", base)).toBe(compressJobKey("png", { ...base, quality: 40 }))
    expect(compressJobKey("jpeg", base)).not.toBe(compressJobKey("jpeg", { ...base, quality: 40 }))
  })

  it("redoes every file when the size or format changes", () => {
    expect(compressJobKey("png", base)).not.toBe(compressJobKey("png", { ...base, maxSide: 1920 }))
    expect(compressJobKey("png", base)).not.toBe(compressJobKey("png", { ...base, format: "webp" }))
  })
})

describe("convertJobKey", () => {
  const base: ConvertSettings = {
    format: "jpeg",
    quality: 90,
    background: "#ffffff",
    svgSize: 1024,
  }

  it("only lets the background change files that can be see-through", () => {
    const white = convertJobKey("jpeg", base)
    expect(convertJobKey("jpeg", { ...base, background: "#000000" })).toBe(white)
    expect(convertJobKey("png", { ...base, background: "#000000" })).not.toBe(
      convertJobKey("png", base),
    )
  })

  it("ignores quality and background for PNG output", () => {
    const png: ConvertSettings = { ...base, format: "png" }
    expect(convertJobKey("png", png)).toBe(
      convertJobKey("png", { ...png, quality: 10, background: "#ff0000" }),
    )
  })

  it("only lets the SVG size change SVGs", () => {
    expect(convertJobKey("png", base)).toBe(convertJobKey("png", { ...base, svgSize: 2048 }))
    expect(convertJobKey("svg", base)).not.toBe(convertJobKey("svg", { ...base, svgSize: 2048 }))
  })
})

describe("svgIntrinsicSize", () => {
  it("reads width and height in px or plain numbers", () => {
    expect(svgIntrinsicSize('<svg xmlns="x" width="120px" height="40">')).toEqual({
      width: 120,
      height: 40,
    })
  })

  it("falls back to the viewBox", () => {
    expect(svgIntrinsicSize("<svg viewBox='0 0 24 12'><path/></svg>")).toEqual({
      width: 24,
      height: 12,
    })
    expect(svgIntrinsicSize('<svg width="100%" viewBox="0,0,300,150">')).toEqual({
      width: 300,
      height: 150,
    })
  })

  it("uses one known side with the viewBox shape", () => {
    expect(svgIntrinsicSize('<svg width="48" viewBox="0 0 24 12">')).toEqual({
      width: 48,
      height: 24,
    })
  })

  it("isn't fooled by stroke-width or an XML header", () => {
    const svg = '<?xml version="1.0"?>\n<svg stroke-width="2" viewBox="0 0 10 20">'
    expect(svgIntrinsicSize(svg)).toEqual({ width: 10, height: 20 })
  })

  it("is null with no usable size, or no <svg> at all", () => {
    expect(svgIntrinsicSize('<svg width="10cm" height="5cm">')).toBeNull()
    expect(svgIntrinsicSize("<html></html>")).toBeNull()
  })
})

describe("svgTargetSize", () => {
  it("sets the longest side to the chosen size, keeping the shape", () => {
    expect(svgTargetSize({ width: 24, height: 12 }, 1024)).toEqual({ width: 1024, height: 512 })
  })

  it("keeps the file's own size when asked", () => {
    expect(svgTargetSize({ width: 300, height: 150 }, null)).toEqual({ width: 300, height: 150 })
  })

  it("draws a sizeless SVG as a 1024 px square", () => {
    expect(svgTargetSize(null, null)).toEqual({ width: 1024, height: 1024 })
  })

  it("caps huge sizes", () => {
    expect(svgTargetSize({ width: 100000, height: 50000 }, null)).toEqual({
      width: MAX_SVG_SIDE,
      height: MAX_SVG_SIDE / 2,
    })
  })
})

describe("withSvgSize", () => {
  it("replaces the root width and height", () => {
    const out = withSvgSize(
      '<svg width="24" height="24" viewBox="0 0 24 24"><rect width="5" height="5"/></svg>',
      { width: 512, height: 512 },
      { width: 24, height: 24 },
    )
    expect(out).toBe(
      '<svg width="512" height="512" viewBox="0 0 24 24"><rect width="5" height="5"/></svg>',
    )
  })

  it("adds a viewBox from the file's own size so the drawing scales", () => {
    const out = withSvgSize(
      '<svg width="24" height="12">',
      { width: 96, height: 48 },
      {
        width: 24,
        height: 12,
      },
    )
    expect(out).toBe('<svg width="96" height="48" viewBox="0 0 24 12">')
  })
})

describe("errorText", () => {
  it("uses the error's own message, with format names written the usual way", () => {
    expect(errorText(new Error("Your browser can't save WEBP"), "x")).toBe(
      "Your browser can't save WebP",
    )
  })

  it("falls back when there is no message", () => {
    expect(errorText("boom", "Something went wrong")).toBe("Something went wrong")
  })
})
