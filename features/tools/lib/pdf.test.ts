import { describe, expect, it } from "vitest"
import {
  A4,
  MAX_CANVAS_PIXELS,
  MAX_CANVAS_SIDE,
  dpiScale,
  extractFileName,
  formatPageList,
  imageKind,
  jpegOrientation,
  moveItem,
  normaliseRotation,
  pageSuffix,
  pagesLabel,
  parsePageRanges,
  pdfErrorMessage,
  placeImage,
  safeRenderScale,
} from "./pdf"

function pagesOf(input: string, count: number): number[] {
  const r = parsePageRanges(input, count)
  if (!r.ok) throw new Error(`expected "${input}" to parse, got: ${r.error}`)
  return r.pages
}

function errorOf(input: string, count: number): string {
  const r = parsePageRanges(input, count)
  if (r.ok) throw new Error(`expected "${input}" to fail, got: ${r.pages.join(",")}`)
  return r.error
}

describe("parsePageRanges", () => {
  it("reads single pages and ranges in the order typed", () => {
    expect(pagesOf("1-3, 5, 8-10", 10)).toEqual([1, 2, 3, 5, 8, 9, 10])
    expect(pagesOf("5, 1-2", 10)).toEqual([5, 1, 2])
  })

  it("ignores spaces anywhere", () => {
    expect(pagesOf("  1 - 3 ,5 ,  8 -10 ", 10)).toEqual([1, 2, 3, 5, 8, 9, 10])
    expect(pagesOf("1 3 5", 10)).toEqual([1, 3, 5])
  })

  it("accepts semicolons, stray commas and typographic dashes", () => {
    expect(pagesOf("1;3", 5)).toEqual([1, 3])
    expect(pagesOf(",1,,2,", 5)).toEqual([1, 2])
    expect(pagesOf("1–3", 5)).toEqual([1, 2, 3])
    expect(pagesOf("2 — 4", 5)).toEqual([2, 3, 4])
  })

  it("runs a reversed range backwards", () => {
    expect(pagesOf("5-3", 5)).toEqual([5, 4, 3])
  })

  it("treats a single-page range as one page", () => {
    expect(pagesOf("4-4", 5)).toEqual([4])
  })

  it("supports open-ended ranges", () => {
    expect(pagesOf("8-", 10)).toEqual([8, 9, 10])
    expect(pagesOf("-3", 10)).toEqual([1, 2, 3])
  })

  it("keeps a duplicate page once, in its first place", () => {
    expect(pagesOf("1-3, 2, 3-5", 5)).toEqual([1, 2, 3, 4, 5])
    expect(pagesOf("3, 1-3", 5)).toEqual([3, 1, 2])
    expect(pagesOf("2, 2, 2", 5)).toEqual([2])
  })

  it("rejects pages past the end", () => {
    expect(errorOf("1-12", 10)).toBe("There's no page 12 - this PDF has 10 pages")
    expect(errorOf("2", 1)).toBe("There's no page 2 - this PDF has 1 page")
    expect(errorOf("99999999999999999999", 3)).toBe(
      "There's no page that high - this PDF has 3 pages",
    )
  })

  it("rejects page 0", () => {
    expect(errorOf("0", 5)).toBe("There's no page 0 - pages start at 1")
    expect(errorOf("0-2", 5)).toBe("There's no page 0 - pages start at 1")
  })

  it("rejects anything that isn't a page number", () => {
    expect(errorOf("abc", 5)).toContain('"abc"')
    expect(errorOf("1-2-3", 5)).toContain('"1-2-3"')
    expect(errorOf("-", 5)).toContain('"-"')
    expect(errorOf("1.5", 5)).toContain('"1.5"')
  })

  it("asks for something when empty", () => {
    expect(errorOf("", 5)).toMatch(/Type the pages/)
    expect(errorOf("   ", 5)).toMatch(/Type the pages/)
    expect(errorOf(" , ; ", 5)).toMatch(/Type the pages/)
  })
})

describe("formatPageList", () => {
  it("collapses runs both ways", () => {
    expect(formatPageList([1, 2, 3, 5, 8, 9, 10])).toBe("1-3, 5, 8-10")
    expect(formatPageList([5, 4, 3, 1])).toBe("5-3, 1")
    expect(formatPageList([7])).toBe("7")
    expect(formatPageList([])).toBe("")
  })

  it("round-trips through parsePageRanges", () => {
    for (const pages of [
      [1, 2, 3, 5],
      [9, 8, 7, 1, 2],
      [4, 1, 3],
    ]) {
      expect(pagesOf(formatPageList(pages), 10)).toEqual(pages)
    }
  })
})

describe("file names", () => {
  it("names extracted pages, shortening long lists", () => {
    expect(extractFileName("report", [1, 2, 3, 5])).toBe("report-pages-1-3_5.pdf")
    const many = Array.from({ length: 30 }, (_, i) => i * 2 + 1)
    expect(extractFileName("report", many)).toBe("report-extract.pdf")
  })

  it("zero-pads page numbers so files sort in order", () => {
    expect(pageSuffix(7, 120)).toBe("page-007")
    expect(pageSuffix(7, 9)).toBe("page-7")
  })

  it("pluralises pages", () => {
    expect(pagesLabel(1)).toBe("1 page")
    expect(pagesLabel(0)).toBe("0 pages")
    expect(pagesLabel(12)).toBe("12 pages")
  })
})

describe("moveItem", () => {
  it("moves an item and leaves the original alone", () => {
    const list = ["a", "b", "c", "d"]
    expect(moveItem(list, 0, 2)).toEqual(["b", "c", "a", "d"])
    expect(moveItem(list, 3, 0)).toEqual(["d", "a", "b", "c"])
    expect(list).toEqual(["a", "b", "c", "d"])
  })

  it("ignores moves out of range", () => {
    expect(moveItem(["a", "b"], 0, 5)).toEqual(["a", "b"])
    expect(moveItem(["a", "b"], -1, 0)).toEqual(["a", "b"])
  })
})

describe("normaliseRotation", () => {
  it("wraps and snaps to quarter turns", () => {
    expect(normaliseRotation(0)).toBe(0)
    expect(normaliseRotation(450)).toBe(90)
    expect(normaliseRotation(-90)).toBe(270)
    expect(normaliseRotation(360)).toBe(0)
    expect(normaliseRotation(181)).toBe(180)
  })
})

describe("placeImage", () => {
  it("fits a portrait photo inside A4 portrait with margins, centred", () => {
    const p = placeImage(3000, 4000, "a4-portrait", "large")
    expect(p.pageWidth).toBe(A4.width)
    expect(p.pageHeight).toBe(A4.height)
    expect(p.width).toBeLessThanOrEqual(A4.width - 100 + 1e-9)
    expect(p.height).toBeLessThanOrEqual(A4.height - 100 + 1e-9)
    expect(p.width / p.height).toBeCloseTo(3000 / 4000)
    expect(p.x).toBeCloseTo((A4.width - p.width) / 2)
    expect(p.y).toBeCloseTo((A4.height - p.height) / 2)
  })

  it("fills the page edge to edge with no margin", () => {
    const p = placeImage(595.28, 841.89, "a4-portrait", "none")
    expect(p.width).toBeCloseTo(A4.width)
    expect(p.height).toBeCloseTo(A4.height)
    expect(p.x).toBeCloseTo(0)
  })

  it("turns the page for A4 landscape", () => {
    const p = placeImage(1920, 1080, "a4-landscape", "small")
    expect(p.pageWidth).toBe(A4.height)
    expect(p.pageHeight).toBe(A4.width)
    expect(p.width).toBeCloseTo(A4.height - 40)
  })

  it("scales small images up to fit A4", () => {
    const p = placeImage(100, 100, "a4-portrait", "none")
    expect(p.width).toBeCloseTo(A4.width)
  })

  it("gives 'fit' pages the image's shape, capped at A4's long side", () => {
    const big = placeImage(4000, 3000, "fit", "none")
    expect(big.pageWidth).toBeCloseTo(A4.height)
    expect(big.pageHeight).toBeCloseTo(A4.height * 0.75)
    const small = placeImage(300, 200, "fit", "small")
    expect(small).toEqual({
      pageWidth: 340,
      pageHeight: 240,
      x: 20,
      y: 20,
      width: 300,
      height: 200,
    })
  })

  it("survives a zero-sized image", () => {
    const p = placeImage(0, 0, "fit", "none")
    expect(p.width).toBeGreaterThan(0)
    expect(p.height).toBeGreaterThan(0)
  })
})

describe("safeRenderScale", () => {
  it("keeps the asked-for scale when it fits", () => {
    expect(safeRenderScale(595, 842, dpiScale(150))).toBeCloseTo(150 / 72)
    expect(safeRenderScale(595, 842, dpiScale(300))).toBe(300 / 72)
  })

  it("shrinks a huge page to the pixel budget", () => {
    // A0 at 300 DPI is ~140 million pixels.
    const s = safeRenderScale(2384, 3370, dpiScale(300))
    expect(Math.floor(2384 * s) * Math.floor(3370 * s)).toBeLessThanOrEqual(MAX_CANVAS_PIXELS)
    expect(s).toBeLessThan(300 / 72)
  })

  it("shrinks a very long page to the side limit", () => {
    const s = safeRenderScale(200, 20000, 2)
    expect(Math.floor(20000 * s)).toBeLessThanOrEqual(MAX_CANVAS_SIDE)
  })

  it("falls back to 1 for nonsense sizes", () => {
    expect(safeRenderScale(0, 100, 2)).toBe(1)
    expect(safeRenderScale(100, 100, NaN)).toBe(1)
  })
})

describe("imageKind", () => {
  it("tells JPEG and PNG from their first bytes", () => {
    expect(imageKind(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg")
    expect(imageKind(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe(
      "png",
    )
  })

  it("calls anything else other", () => {
    // "RIFF....WEBP"
    const webp = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]
    expect(imageKind(new Uint8Array(webp))).toBe("other")
    expect(imageKind(new Uint8Array([0x89, 0x50]))).toBe("other")
    expect(imageKind(new Uint8Array([]))).toBe("other")
  })
})

describe("jpegOrientation", () => {
  /** A minimal JPEG header with one EXIF orientation entry. */
  function jpegWithOrientation(value: number, littleEndian: boolean): Uint8Array {
    const tiff = littleEndian
      ? [0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00]
      : [0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08]
    const u16 = (n: number) => (littleEndian ? [n & 0xff, n >> 8] : [n >> 8, n & 0xff])
    const u32 = (n: number) =>
      littleEndian
        ? [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, n >>> 24]
        : [n >>> 24, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
    const ifd = [...u16(1), ...u16(0x0112), ...u16(3), ...u32(1), ...u16(value), 0, 0, ...u32(0)]
    const exif = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff, ...ifd]
    const length = exif.length + 2
    return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, length >> 8, length & 0xff, ...exif, 0xff, 0xd9])
  }

  it("reads the orientation in both byte orders", () => {
    expect(jpegOrientation(jpegWithOrientation(6, false))).toBe(6)
    expect(jpegOrientation(jpegWithOrientation(8, true))).toBe(8)
    expect(jpegOrientation(jpegWithOrientation(1, true))).toBe(1)
  })

  it("skips other segments before the EXIF one", () => {
    const app0 = [0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46]
    const withExif = jpegWithOrientation(3, false)
    const bytes = new Uint8Array([0xff, 0xd8, ...app0, ...withExif.slice(2)])
    expect(jpegOrientation(bytes)).toBe(3)
  })

  it("says upright for anything else", () => {
    expect(jpegOrientation(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(1)
    expect(jpegOrientation(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]))).toBe(1)
    expect(jpegOrientation(new Uint8Array([]))).toBe(1)
    // Cut off half-way through the EXIF block.
    expect(jpegOrientation(jpegWithOrientation(6, false).slice(0, 20))).toBe(1)
    // An out-of-range value.
    expect(jpegOrientation(jpegWithOrientation(42, true))).toBe(1)
  })
})

describe("pdfErrorMessage", () => {
  it("spots password-protected PDFs from pdf.js and pdf-lib", () => {
    const pdfjs = { name: "PasswordException", message: "No password given" }
    const pdfLib = new Error(
      "Input document to `PDFDocument.load` is encrypted. You can use `PDFDocument.load(..., { ignoreEncryption: true })`",
    )
    expect(pdfErrorMessage(pdfjs)).toMatch(/password-protected/)
    expect(pdfErrorMessage(pdfLib)).toMatch(/password-protected/)
  })

  it("calls broken files damaged", () => {
    expect(
      pdfErrorMessage({ name: "InvalidPDFException", message: "Invalid PDF structure." }),
    ).toMatch(/isn't a working PDF/)
    expect(
      pdfErrorMessage(
        new Error("Failed to parse PDF document (line:0 col:0 offset=0): No PDF header found"),
      ),
    ).toMatch(/isn't a working PDF/)
  })

  it("explains running out of memory", () => {
    expect(pdfErrorMessage(new RangeError("Array buffer allocation failed"))).toMatch(/too big/)
  })

  it("has a fallback for anything else", () => {
    expect(pdfErrorMessage(new Error("boom"))).toMatch(/Something went wrong/)
    expect(pdfErrorMessage(undefined)).toMatch(/Something went wrong/)
  })
})
