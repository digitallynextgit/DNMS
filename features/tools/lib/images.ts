import { canvasToBlob, loadImage, withExtension } from "./files"

export type InputKind =
  | "jpeg"
  | "png"
  | "webp"
  | "gif"
  | "bmp"
  | "svg"
  | "heic"
  | "avif"
  | "unknown"

export type OutputFormat = "jpeg" | "png" | "webp" | "avif"

export const OUTPUT_MIME: Record<OutputFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
}

const OUTPUT_EXT: Record<OutputFormat, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
  avif: "avif",
}

export const KIND_LABEL: Record<InputKind, string> = {
  jpeg: "JPG",
  png: "PNG",
  webp: "WebP",
  gif: "GIF",
  bmp: "BMP",
  svg: "SVG",
  heic: "HEIC",
  avif: "AVIF",
  unknown: "Image",
}

const MIME_KIND: Record<string, InputKind> = {
  "image/jpeg": "jpeg",
  "image/jpg": "jpeg",
  "image/pjpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/bmp": "bmp",
  "image/x-bmp": "bmp",
  "image/x-ms-bmp": "bmp",
  "image/svg+xml": "svg",
  "image/heic": "heic",
  "image/heif": "heic",
  "image/heic-sequence": "heic",
  "image/heif-sequence": "heic",
  "image/avif": "avif",
}

const EXT_KIND: Record<string, InputKind> = {
  jpg: "jpeg",
  jpeg: "jpeg",
  jpe: "jpeg",
  jfif: "jpeg",
  png: "png",
  webp: "webp",
  gif: "gif",
  bmp: "bmp",
  svg: "svg",
  heic: "heic",
  heif: "heic",
  avif: "avif",
}

/** The extension is the fallback: browsers often give iPhone HEIC photos an empty MIME type. */
export function imageKind(file: { name: string; type: string }): InputKind {
  const byType = MIME_KIND[file.type.toLowerCase()]
  if (byType) return byType
  const dot = file.name.lastIndexOf(".")
  if (dot < 0) return "unknown"
  return EXT_KIND[file.name.slice(dot + 1).toLowerCase()] ?? "unknown"
}

export function isLossy(format: OutputFormat): boolean {
  return format !== "png"
}

export function encoderQuality(percent: number): number {
  return Math.min(1, Math.max(0.01, percent / 100))
}

export function fitWithin(
  width: number,
  height: number,
  maxSide?: number | null,
): { width: number; height: number; resized: boolean } {
  const longest = Math.max(width, height)
  if (!maxSide || longest <= maxSide) return { width, height, resized: false }
  const scale = maxSide / longest
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    resized: true,
  }
}

/** Same format keeps the original name (photo.jpeg stays photo.jpeg). */
export function outputName(name: string, kind: InputKind, format: OutputFormat): string {
  if (kind === format && name.includes(".")) return name
  return withExtension(name, OUTPUT_EXT[format])
}

export function batchTotals(rows: readonly { before: number; after: number }[]): {
  before: number
  after: number
  saved: number
  percent: number
} {
  let before = 0
  let after = 0
  for (const r of rows) {
    before += r.before
    after += r.after
  }
  const saved = before - after
  return { before, after, saved, percent: before > 0 ? Math.round((saved / before) * 100) : 0 }
}

export type CompressFormat = "keep" | "jpeg" | "webp"

export interface CompressSettings {
  /** 1-100. Used for JPG and WebP. */
  quality: number
  /** Longest side in px, or null for the original size. */
  maxSide: number | null
  format: CompressFormat
}

export function compressOutput(kind: InputKind, format: CompressFormat): OutputFormat {
  if (format !== "keep") return format
  if (kind === "png") return "png"
  if (kind === "webp") return "webp"
  return "jpeg"
}

/** A file is redone only when its key changes, so the quality slider leaves PNGs alone. */
export function compressJobKey(kind: InputKind, s: CompressSettings): string {
  const out = compressOutput(kind, s.format)
  return [out, s.maxSide ?? "original", isLossy(out) ? s.quality : "-"].join("|")
}

export interface ConvertSettings {
  format: OutputFormat
  /** 1-100. Used for JPG, WebP and AVIF. */
  quality: number
  /** Fill for see-through areas when saving as JPG. */
  background: string
  /** Longest side to draw SVGs at, or null for the size set in the file. */
  svgSize: number | null
}

export function convertJobKey(kind: InputKind, s: ConvertSettings): string {
  return [
    s.format,
    isLossy(s.format) ? s.quality : "-",
    // A JPG has no see-through parts, so the background can't change it.
    s.format === "jpeg" && kind !== "jpeg" ? s.background.toLowerCase() : "-",
    kind === "svg" ? (s.svgSize ?? "own") : "-",
  ].join("|")
}

export const MAX_SVG_SIDE = 8192
const DEFAULT_SVG_SIDE = 1024

type Size = { width: number; height: number }

function svgRootTag(svg: string): string | null {
  return svg.match(/<svg\b[^>]*>/i)?.[0] ?? null
}

function svgAttr(tag: string, name: string): string | undefined {
  return tag
    .match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"))
    ?.slice(2)
    .find((v) => v !== undefined)
}

/** "24", "24px", "24.5" -> a number; "100%", "2cm" or junk -> null. */
function svgLength(value: string | undefined): number | null {
  const m = value?.trim().match(/^(\d*\.?\d+)(px)?$/i)
  const n = m ? Number(m[1]) : NaN
  return Number.isFinite(n) && n > 0 ? n : null
}

export function svgIntrinsicSize(svg: string): Size | null {
  const tag = svgRootTag(svg)
  if (!tag) return null
  const w = svgLength(svgAttr(tag, "width"))
  const h = svgLength(svgAttr(tag, "height"))
  if (w && h) return { width: w, height: h }
  const box = svgAttr(tag, "viewBox")
    ?.trim()
    .split(/[\s,]+/)
    .map(Number)
  const vbW = box?.length === 4 ? box[2] : undefined
  const vbH = box?.length === 4 ? box[3] : undefined
  if (vbW && vbH && vbW > 0 && vbH > 0) {
    if (w) return { width: w, height: (w * vbH) / vbW }
    if (h) return { width: (h * vbW) / vbH, height: h }
    return { width: vbW, height: vbH }
  }
  return null
}

export function svgTargetSize(own: Size | null, longest: number | null): Size {
  const base = own ?? { width: 1, height: 1 }
  const wanted = longest ?? (own ? Math.max(own.width, own.height) : DEFAULT_SVG_SIDE)
  const side = Math.min(MAX_SVG_SIDE, wanted)
  const scale = side / Math.max(base.width, base.height)
  return {
    width: Math.max(1, Math.round(base.width * scale)),
    height: Math.max(1, Math.round(base.height * scale)),
  }
}

/** Adds a viewBox when missing - without one, a bigger width/height just adds empty space. */
export function withSvgSize(svg: string, size: Size, own: Size | null): string {
  return svg.replace(/<svg\b[^>]*>/i, (tag) => {
    const viewBox =
      !/\sviewBox\s*=/i.test(tag) && own ? ` viewBox="0 0 ${own.width} ${own.height}"` : ""
    const cleaned = tag.replace(/\s(width|height)\s*=\s*("[^"]*"|'[^']*')/gi, "")
    return cleaned.replace(/^<svg/i, `<svg width="${size.width}" height="${size.height}"${viewBox}`)
  })
}

export interface DecodedImage {
  image: CanvasImageSource
  width: number
  height: number
}

const encodeSupport = new Map<string, Promise<boolean>>()

/** Safari can't save WebP and most browsers can't save AVIF. Checked once per type. */
export function canEncode(mime: string): Promise<boolean> {
  let check = encodeSupport.get(mime)
  if (!check) {
    check = new Promise<boolean>((resolve) => {
      try {
        const canvas = document.createElement("canvas")
        canvas.width = 1
        canvas.height = 1
        canvas.toBlob((blob) => resolve(!!blob && blob.type === mime), mime)
      } catch {
        resolve(false)
      }
    })
    encodeSupport.set(mime, check)
  }
  return check
}

export async function decodeRaster(source: Blob): Promise<DecodedImage> {
  const img = await loadImage(source)
  if (!img.naturalWidth || !img.naturalHeight) {
    throw new Error("This file couldn't be opened as an image")
  }
  return { image: img, width: img.naturalWidth, height: img.naturalHeight }
}

export async function decodeSvg(file: Blob, longest: number | null): Promise<DecodedImage> {
  const text = await file.text()
  const own = svgIntrinsicSize(text)
  const size = svgTargetSize(own, longest)
  const sized = withSvgSize(text, size, own)
  const img = await loadImage(new Blob([sized], { type: "image/svg+xml" }))
  return { image: img, width: size.width, height: size.height }
}

/**
 * Safari reads HEIC itself; elsewhere the big, lazy-loaded heic2any converts it to PNG.
 * The PNG is returned so a re-run with new settings skips that slow step.
 */
export async function decodeHeic(file: Blob): Promise<{ decoded: DecodedImage; png?: Blob }> {
  try {
    return { decoded: await decodeRaster(file) }
  } catch {
    // Not Safari - convert it below.
  }
  let png: Blob | undefined
  try {
    const heic2any = (await import("heic2any")).default
    const out = await heic2any({ blob: file, toType: "image/png" })
    png = Array.isArray(out) ? out[0] : out
  } catch {
    png = undefined
  }
  if (!png) throw new Error("Couldn't read this HEIC photo - it may be damaged or an unusual kind")
  return { decoded: await decodeRaster(png), png }
}

function blankCanvas(
  width: number,
  height: number,
): {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
} {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    throw new Error("This image is too big for your browser - try a smaller size")
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  return { canvas, ctx }
}

/** Free a canvas's memory now rather than whenever the browser gets round to it. */
function release(canvas: HTMLCanvasElement) {
  canvas.width = 0
  canvas.height = 0
}

/** Big shrinks go down in halves - one big jump leaves jagged edges in some browsers. */
function drawScaled(
  src: DecodedImage,
  width: number,
  height: number,
  background?: string,
): HTMLCanvasElement {
  let source: CanvasImageSource = src.image
  let w = src.width
  let h = src.height
  let step: HTMLCanvasElement | null = null
  while (w >= width * 2 && h >= height * 2) {
    const nw = Math.max(width, Math.round(w / 2))
    const nh = Math.max(height, Math.round(h / 2))
    const next = blankCanvas(nw, nh)
    next.ctx.drawImage(source, 0, 0, nw, nh)
    if (step) release(step)
    step = next.canvas
    source = next.canvas
    w = nw
    h = nh
  }
  const out = blankCanvas(width, height)
  if (background) {
    out.ctx.fillStyle = background
    out.ctx.fillRect(0, 0, width, height)
  }
  out.ctx.drawImage(source, 0, 0, width, height)
  if (step) release(step)
  return out.canvas
}

export async function encodeImage(
  src: DecodedImage,
  opts: {
    width: number
    height: number
    format: OutputFormat
    /** 1-100, ignored for PNG. */
    quality: number
    background?: string
  },
): Promise<Blob> {
  const canvas = drawScaled(src, opts.width, opts.height, opts.background)
  try {
    return await canvasToBlob(
      canvas,
      OUTPUT_MIME[opts.format],
      isLossy(opts.format) ? encoderQuality(opts.quality) : undefined,
    )
  } catch (err) {
    // A canvas "tainted" by an SVG the browser doesn't trust can't be saved.
    if (err instanceof DOMException && err.name === "SecurityError") {
      throw new Error("Your browser won't let this image be saved in another format")
    }
    throw err
  } finally {
    release(canvas)
  }
}

/** Shown at 48 CSS px, so 96 stays sharp on 2x screens. */
const THUMB_SIDE = 96

/** A data URL, so there's nothing to revoke later (unlike an object URL). */
export function thumbnailDataUrl(src: DecodedImage): string {
  const size = fitWithin(src.width, src.height, THUMB_SIDE)
  let canvas: HTMLCanvasElement | null = null
  try {
    canvas = drawScaled(src, size.width, size.height)
    // Falls back to PNG where WebP can't be saved - both keep see-through parts.
    return canvas.toDataURL("image/webp", 0.8)
  } catch {
    return ""
  } finally {
    if (canvas) release(canvas)
  }
}

export function errorText(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) {
    // canvasToBlob says e.g. "Your browser can't save WEBP" - name formats the usual way.
    return err.message.replace(/\bWEBP\b/, "WebP").replace(/\bJPEG\b/, "JPG")
  }
  return fallback
}
