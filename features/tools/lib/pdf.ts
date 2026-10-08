export const MAX_PDF_BYTES = 100 * 1024 * 1024
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024

/** What the PDF pickers accept (some browsers leave a PDF's type blank, hence the extension). */
export const PDF_ACCEPT = ["application/pdf", ".pdf"] as const
export const IMAGE_ACCEPT = [
  "image/jpeg",
  "image/png",
  "image/webp",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
] as const

export function pagesLabel(count: number): string {
  return `${count} page${count === 1 ? "" : "s"}`
}

export type PageRangeResult = { ok: true; pages: number[] } | { ok: false; error: string }

/**
 * "1-3, 5, 8-10" -> [1, 2, 3, 5, 8, 9, 10]; "8-" runs to the end, "-3" from the start, "5-3"
 * backwards. A page asked for twice is kept once (first place wins). Word's dashes are fine.
 */
export function parsePageRanges(input: string, pageCount: number): PageRangeResult {
  const text = input
    .replace(/[‐-―−]/g, "-")
    .replace(/\s*-\s*/g, "-")
    .trim()
  if (!text) return { ok: false, error: "Type the pages you want, like 1-3, 5" }

  const pages: number[] = []
  const seen = new Set<number>()
  const add = (page: number) => {
    if (seen.has(page)) return
    seen.add(page)
    pages.push(page)
  }

  for (const part of text.split(/[,;\s]+/)) {
    if (!part) continue
    const match = /^(\d+)?(-)?(\d+)?$/.exec(part)
    if (!match || (!match[1] && !match[3])) {
      return { ok: false, error: `"${part}" isn't a page number - use numbers like 1-3, 5` }
    }
    const [, fromText, dash, toText] = match
    const from = fromText ? Number(fromText) : 1
    const to = dash ? (toText ? Number(toText) : pageCount) : from

    for (const page of [from, to]) {
      if (page < 1) return { ok: false, error: "There's no page 0 - pages start at 1" }
      if (page > pageCount) {
        const which = page > 999_999 ? "that high" : String(page)
        return {
          ok: false,
          error: `There's no page ${which} - this PDF has ${pagesLabel(pageCount)}`,
        }
      }
    }
    const step = to >= from ? 1 : -1
    for (let page = from; page !== to + step; page += step) add(page)
  }
  if (!pages.length) return { ok: false, error: "Type the pages you want, like 1-3, 5" }
  return { ok: true, pages }
}

/** The reverse of parsePageRanges: [1, 2, 3, 5, 9, 8] -> "1-3, 5, 9-8". */
export function formatPageList(pages: readonly number[]): string {
  const parts: string[] = []
  let i = 0
  while (i < pages.length) {
    const start = pages[i]!
    let end = start
    let j = i + 1
    const next = pages[j]
    const step = next !== undefined && Math.abs(next - start) === 1 ? next - start : 0
    if (step) {
      while (j < pages.length && pages[j] === end + step) {
        end = pages[j]!
        j++
      }
    }
    parts.push(end === start ? String(start) : `${start}-${end}`)
    i = j
  }
  return parts.join(", ")
}

/** A file name for extracted pages: "report-pages-1-3_5.pdf" (shortened if the list is long). */
export function extractFileName(base: string, pages: readonly number[]): string {
  const list = formatPageList(pages).replace(/, /g, "_")
  return list.length > 40 ? `${base}-extract.pdf` : `${base}-pages-${list}.pdf`
}

/** "-page-007" style suffix, zero-padded so files sort in page order. */
export function pageSuffix(page: number, pageCount: number): string {
  return `page-${String(page).padStart(String(pageCount).length, "0")}`
}

/** Out-of-range moves change nothing. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const copy = list.slice()
  if (from === to || from < 0 || to < 0 || from >= copy.length || to >= copy.length) return copy
  const [item] = copy.splice(from, 1)
  copy.splice(to, 0, item as T)
  return copy
}

export function normaliseRotation(degrees: number): 0 | 90 | 180 | 270 {
  const snapped = Math.round(degrees / 90) * 90
  return (((snapped % 360) + 360) % 360) as 0 | 90 | 180 | 270
}

// PDF points: 72 to the inch.

export type PageSizeOption = "a4-portrait" | "a4-landscape" | "fit"
export type MarginOption = "none" | "small" | "large"

export const A4 = { width: 595.28, height: 841.89 } as const
/** Margin around each image, in points (small = about 7 mm, large = about 18 mm). */
export const MARGIN_POINTS: Record<MarginOption, number> = { none: 0, small: 20, large: 50 }

export interface ImagePlacement {
  pageWidth: number
  pageHeight: number
  /** Where the image goes - PDF coordinates, origin at the bottom left. */
  x: number
  y: number
  width: number
  height: number
}

/**
 * A4: scaled to fit inside the margins and centred. "fit": the page takes the image's shape,
 * a pixel per point but capped at A4's long side (the full image is still embedded).
 */
export function placeImage(
  imageWidth: number,
  imageHeight: number,
  pageSize: PageSizeOption,
  margin: MarginOption,
): ImagePlacement {
  const w = imageWidth > 0 ? imageWidth : 1
  const h = imageHeight > 0 ? imageHeight : 1
  const m = MARGIN_POINTS[margin]

  if (pageSize === "fit") {
    const scale = Math.min(1, A4.height / Math.max(w, h))
    const width = w * scale
    const height = h * scale
    return { pageWidth: width + 2 * m, pageHeight: height + 2 * m, x: m, y: m, width, height }
  }

  const pageWidth = pageSize === "a4-portrait" ? A4.width : A4.height
  const pageHeight = pageSize === "a4-portrait" ? A4.height : A4.width
  const scale = Math.min((pageWidth - 2 * m) / w, (pageHeight - 2 * m) / h)
  const width = w * scale
  const height = h * scale
  return {
    pageWidth,
    pageHeight,
    x: (pageWidth - width) / 2,
    y: (pageHeight - height) / 2,
    width,
    height,
  }
}

/** iOS Safari's canvas cap (16,777,216 px total); other browsers cap a side at 32,767 or 16,384. */
export const MAX_CANVAS_PIXELS = 16_777_216
export const MAX_CANVAS_SIDE = 16_384

/** Scale for rendering at `dpi` (a PDF unit is 1/72 inch). */
export function dpiScale(dpi: number): number {
  return dpi / 72
}

/** Largest scale up to `scale` at which the page still fits a canvas the browser will draw. */
export function safeRenderScale(
  width: number,
  height: number,
  scale: number,
  maxPixels = MAX_CANVAS_PIXELS,
  maxSide = MAX_CANVAS_SIDE,
): number {
  if (!(width > 0) || !(height > 0) || !(scale > 0)) return 1
  // When a limit bites, stay a hair under it so rounding can't land a pixel over.
  let s = scale
  const sideLimit = Math.min(maxSide / width, maxSide / height)
  if (s > sideLimit) s = sideLimit * 0.9999
  const area = width * s * (height * s)
  if (area > maxPixels) s *= Math.sqrt(maxPixels / area) * 0.9999
  return s
}

/** From the first bytes (name and type can lie). A PDF holds JPEG and PNG as-is; others are redrawn. */
export function imageKind(bytes: Uint8Array): "jpeg" | "png" | "other" {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg"
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (bytes.length >= 8 && png.every((b, i) => bytes[i] === b)) return "png"
  return "other"
}

/**
 * EXIF orientation (1-8; 1 = upright). Browsers honour it but a PDF can't, so anything but 1 is
 * redrawn upright first. 1 for non-JPEGs or no orientation.
 */
export function jpegOrientation(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const end = view.byteLength
  if (end < 4 || view.getUint16(0) !== 0xffd8) return 1
  let offset = 2
  while (offset + 4 <= end) {
    const marker = view.getUint16(offset)
    if (marker >> 8 !== 0xff) return 1
    // Start of the image data (or end of image): no more headers to look at.
    if (marker === 0xffda || marker === 0xffd9) return 1
    const length = view.getUint16(offset + 2)
    if (length < 2) return 1
    if (marker === 0xffe1) {
      const exif = offset + 4
      // "Exif\0\0", then a TIFF header.
      if (
        exif + 14 <= end &&
        view.getUint32(exif) === 0x45786966 &&
        view.getUint16(exif + 4) === 0
      ) {
        const tiff = exif + 6
        const little = view.getUint16(tiff) === 0x4949
        const ifd = tiff + view.getUint32(tiff + 4, little)
        if (ifd + 2 > end) return 1
        const entries = view.getUint16(ifd, little)
        for (let i = 0; i < entries; i++) {
          const entry = ifd + 2 + i * 12
          if (entry + 12 > end) return 1
          if (view.getUint16(entry, little) === 0x0112) {
            const value = view.getUint16(entry + 8, little)
            return value >= 1 && value <= 8 ? value : 1
          }
        }
        return 1
      }
    }
    offset += 2 + length
  }
  return 1
}

/** pdf.js throws named exceptions; pdf-lib throws plain Errors, told apart by their message. */
export function pdfErrorMessage(err: unknown): string {
  const name = err && typeof err === "object" && "name" in err ? String(err.name) : ""
  const message = err instanceof Error ? err.message : typeof err === "string" ? err : ""

  if (name === "PasswordException" || /encrypt/i.test(message)) {
    return "This PDF is password-protected - remove the password first"
  }
  if (name === "NotReadableError" || name === "NotFoundError") {
    return "Couldn't read this file - pick it again"
  }
  if (
    name === "QuotaExceededError" ||
    /allocation failed|out of memory|invalid array length/i.test(message)
  ) {
    return "This is too big for your browser to handle - try fewer pages or a lower setting"
  }
  if (/canvas|couldn't create this file/i.test(message)) {
    return "Your browser couldn't draw this page - try a lower resolution"
  }
  if (
    name === "InvalidPDFException" ||
    name === "FormatError" ||
    /invalid pdf|pdf header|failed to parse|parsing|xref|trailer/i.test(message)
  ) {
    return "This file isn't a working PDF - it may be damaged"
  }
  return "Something went wrong with this PDF - it may be damaged"
}
