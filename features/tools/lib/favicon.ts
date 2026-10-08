export type IconKind = "favicon" | "apple" | "android"

export type FaviconFile =
  | { name: string; type: "ico"; sizes: readonly number[]; label: string }
  | { name: string; type: "png"; kind: IconKind; size: number; label: string }
  | { name: string; type: "manifest"; label: string }

export const ICO_SIZES = [16, 32, 48] as const

export const FAVICON_FILES: readonly FaviconFile[] = [
  { name: "favicon.ico", type: "ico", sizes: ICO_SIZES, label: "Browser tab - 16, 32, 48 px" },
  {
    name: "favicon-16x16.png",
    type: "png",
    kind: "favicon",
    size: 16,
    label: "Browser tab - 16 px",
  },
  {
    name: "favicon-32x32.png",
    type: "png",
    kind: "favicon",
    size: 32,
    label: "Browser tab - 32 px",
  },
  {
    name: "apple-touch-icon.png",
    type: "png",
    kind: "apple",
    size: 180,
    label: "iPhone & iPad home screen",
  },
  {
    name: "android-chrome-192x192.png",
    type: "png",
    kind: "android",
    size: 192,
    label: "Android home screen",
  },
  {
    name: "android-chrome-512x512.png",
    type: "png",
    kind: "android",
    size: 512,
    label: "Android splash screen",
  },
  { name: "site.webmanifest", type: "manifest", label: "App details for Android" },
]

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

export function readPngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null
  for (let i = 0; i < PNG_SIGNATURE.length; i++) if (bytes[i] !== PNG_SIGNATURE[i]) return null
  // The first chunk is always IHDR: length (4), "IHDR" (4), width (4), height (4).
  if (String.fromCharCode(bytes[12]!, bytes[13]!, bytes[14]!, bytes[15]!) !== "IHDR") return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

/** PNGs packed in an .ico (all numbers little-endian). Works in every browser and Windows Vista+. */
export function buildIco(
  images: readonly { size: number; png: Uint8Array }[],
): Uint8Array<ArrayBuffer> {
  if (images.length === 0) throw new Error("An icon needs at least one image")
  if (images.length > 0xffff) throw new Error("Too many images for one icon")
  for (const img of images) {
    if (!Number.isInteger(img.size) || img.size < 1 || img.size > 256)
      throw new Error(`An .ico image must be 1 to 256 px, not ${img.size}`)
    if (!readPngSize(img.png)) throw new Error("Each .ico image must be a PNG")
  }

  const headerSize = 6 + 16 * images.length
  const total = images.reduce((sum, img) => sum + img.png.length, headerSize)
  const out = new Uint8Array(total)
  const view = new DataView(out.buffer)

  view.setUint16(0, 0, true) // reserved
  view.setUint16(2, 1, true) // 1 = icon (2 would be a cursor)
  view.setUint16(4, images.length, true)

  let offset = headerSize
  images.forEach((img, i) => {
    const e = 6 + i * 16
    const side = img.size === 256 ? 0 : img.size
    view.setUint8(e, side) // width
    view.setUint8(e + 1, side) // height
    view.setUint8(e + 2, 0) // colours in palette (0 = no palette)
    view.setUint8(e + 3, 0) // reserved
    view.setUint16(e + 4, 1, true) // colour planes
    view.setUint16(e + 6, 32, true) // bits per pixel
    view.setUint32(e + 8, img.png.length, true)
    view.setUint32(e + 12, offset, true)
    out.set(img.png, offset)
    offset += img.png.length
  })
  return out
}

/** Android shows about 12 letters under a home-screen icon. */
export function shortName(name: string): string {
  const clean = name.trim().replace(/\s+/g, " ")
  if (clean.length <= 12) return clean
  const first = clean.split(" ")[0] ?? ""
  return first.length > 0 && first.length <= 12 ? first : clean.slice(0, 12).trim()
}

/** site.webmanifest - names are left out when none is given. */
export function buildWebManifest({
  name,
  themeColour,
  backgroundColour,
}: {
  name: string
  themeColour: string
  backgroundColour: string
}): string {
  const clean = name.trim().replace(/\s+/g, " ")
  const manifest: Record<string, unknown> = {}
  if (clean) {
    manifest.name = clean
    manifest.short_name = shortName(clean)
  }
  manifest.icons = [
    { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
    { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
  ]
  manifest.theme_color = themeColour
  manifest.background_color = backgroundColour
  manifest.display = "standalone"
  return JSON.stringify(manifest, null, 2) + "\n"
}

export function faviconHtml(themeColour: string): string {
  return [
    `<link rel="icon" href="/favicon.ico" sizes="${ICO_SIZES.map((s) => `${s}x${s}`).join(" ")}">`,
    `<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">`,
    `<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">`,
    `<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">`,
    `<link rel="manifest" href="/site.webmanifest">`,
    `<meta name="theme-color" content="${themeColour}">`,
  ].join("\n")
}

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** The logo shrunk to fit inside the padding (a share of the side, on every edge) and centred. */
export function logoBox(size: number, paddingPct: number, logoW: number, logoH: number): Box {
  const pad = (size * Math.min(Math.max(paddingPct, 0), 45)) / 100
  const room = size - pad * 2
  const s = Math.min(room / logoW, room / logoH)
  const w = logoW * s
  const h = logoH * s
  return { x: (size - w) / 2, y: (size - h) / 2, w, h }
}

export type IconShape = "square" | "rounded" | "circle"

export function cornerRadius(shape: IconShape, size: number): number {
  if (shape === "circle") return size / 2
  if (shape === "rounded") return size * 0.2
  return 0
}

/** Bounds of the pixels with alpha above `threshold`; null when every pixel is see-through. */
export function contentBox(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
  threshold = 8,
): Box | null {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    const row = y * width * 4
    for (let x = 0; x < width; x++) {
      if ((rgba[row + x * 4 + 3] ?? 0) > threshold) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

/**
 * Browsers draw an SVG without a fixed size at 0 or 300 x 150 px, so the logo gets an explicit
 * size in its own shape - plus a viewBox when it has none, so its drawing scales with it.
 */
export function svgSizing(
  width: string | null,
  height: string | null,
  viewBox: string | null,
  longSide = 1024,
): { width: number; height: number; viewBox: string | null } {
  const px = (v: string | null) => {
    const m = /^\s*(\d+(?:\.\d+)?)\s*(px)?\s*$/.exec(v ?? "")
    const n = m ? Number(m[1]) : NaN
    return n > 0 ? n : null
  }
  const vb = (viewBox ?? "")
    .trim()
    .split(/[\s,]+/)
    .map(Number)
  const hasViewBox = vb.length === 4 && vb.every(Number.isFinite) && vb[2]! > 0 && vb[3]! > 0
  const w = px(width)
  const h = px(height)

  let shapeW = 1
  let shapeH = 1
  let addViewBox: string | null = null
  if (hasViewBox) {
    shapeW = vb[2]!
    shapeH = vb[3]!
  } else if (w && h) {
    shapeW = w
    shapeH = h
    addViewBox = `0 0 ${w} ${h}`
  }
  const k = longSide / Math.max(shapeW, shapeH)
  return {
    width: Math.max(1, Math.round(shapeW * k)),
    height: Math.max(1, Math.round(shapeH * k)),
    viewBox: addViewBox,
  }
}

/** "favicons.zip", or "acme-favicons.zip" when the site has a name. */
export function faviconZipName(siteName: string): string {
  const slug = siteName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "")
  return slug ? `${slug}-favicons.zip` : "favicons.zip"
}
