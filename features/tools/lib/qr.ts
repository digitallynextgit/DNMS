import QRCode from "qrcode"

// Drawn by hand from the module grid, so the preview, PNG and SVG match and the centre image
// sits on a clean plate instead of over the dots.

/** Quiet zone round the code, in modules. 4 is the minimum scanners expect. */
export const QR_MARGIN = 4

export interface QrMatrix {
  /** Modules per side, without the quiet zone. */
  size: number
  dark: (row: number, col: number) => boolean
}

export type QrBuild = { ok: true; matrix: QrMatrix } | { ok: false; reason: "empty" | "too-long" }

/** With a centre image: level H (~30% can be covered). Without: M, less dense and easier to scan. */
export function buildQr(text: string, withImage: boolean): QrBuild {
  if (!text.trim()) return { ok: false, reason: "empty" }
  try {
    const qr = QRCode.create(text, { errorCorrectionLevel: withImage ? "H" : "M" })
    const modules = qr.modules
    return {
      ok: true,
      matrix: { size: modules.size, dark: (r, c) => modules.get(r, c) === 1 },
    }
  } catch {
    // The only failure for non-empty text: more data than a QR code can hold.
    return { ok: false, reason: "too-long" }
  }
}

export interface QrStyle {
  dark: string
  light: string
  /** Centre image width as a share of the code (0.15-0.3). */
  imageScale: number
  /** A plate in the background colour behind the image, so the dots round it stay readable. */
  imagePlate: boolean
}

export interface QrImage {
  src: string
  aspect: number
}

interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** In modules from the top-left of the whole picture (quiet zone included). */
function centreBoxes(size: number, style: QrStyle, aspect: number): { image: Box; plate: Box } {
  const total = size + QR_MARGIN * 2
  const side = size * style.imageScale
  const w = aspect >= 1 ? side : side * aspect
  const h = aspect >= 1 ? side / aspect : side
  const image = { x: (total - w) / 2, y: (total - h) / 2, w, h }
  const pad = 0.8
  const plate = { x: image.x - pad, y: image.y - pad, w: w + pad * 2, h: h + pad * 2 }
  return { image, plate }
}

export function drawQr(
  ctx: CanvasRenderingContext2D,
  px: number,
  matrix: QrMatrix,
  style: QrStyle,
  image?: { el: CanvasImageSource; aspect: number },
): void {
  const total = matrix.size + QR_MARGIN * 2
  const cell = px / total
  // Rounded edges per module: neighbours share an edge exactly, so no hairlines.
  const edge = (n: number) => Math.round(n * cell)

  ctx.clearRect(0, 0, px, px)
  ctx.fillStyle = style.light
  ctx.fillRect(0, 0, px, px)
  ctx.fillStyle = style.dark
  for (let r = 0; r < matrix.size; r++) {
    for (let c = 0; c < matrix.size; c++) {
      if (!matrix.dark(r, c)) continue
      const x = edge(c + QR_MARGIN)
      const y = edge(r + QR_MARGIN)
      ctx.fillRect(x, y, edge(c + QR_MARGIN + 1) - x, edge(r + QR_MARGIN + 1) - y)
    }
  }

  if (!image) return
  const { image: box, plate } = centreBoxes(matrix.size, style, image.aspect)
  if (style.imagePlate) {
    ctx.fillStyle = style.light
    ctx.beginPath()
    ctx.roundRect(plate.x * cell, plate.y * cell, plate.w * cell, plate.h * cell, cell)
    ctx.fill()
  }
  ctx.drawImage(image.el, box.x * cell, box.y * cell, box.w * cell, box.h * cell)
}

export function qrToSvg(matrix: QrMatrix, style: QrStyle, image?: QrImage): string {
  const total = matrix.size + QR_MARGIN * 2
  let path = ""
  for (let r = 0; r < matrix.size; r++) {
    for (let c = 0; c < matrix.size; c++) {
      if (matrix.dark(r, c)) path += `M${c + QR_MARGIN} ${r + QR_MARGIN}h1v1h-1z`
    }
  }
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">`,
    `<rect width="${total}" height="${total}" fill="${style.light}"/>`,
    `<path d="${path}" fill="${style.dark}"/>`,
  ]
  if (image) {
    const { image: box, plate } = centreBoxes(matrix.size, style, image.aspect)
    if (style.imagePlate) {
      parts.push(
        `<rect x="${plate.x}" y="${plate.y}" width="${plate.w}" height="${plate.h}" rx="1" fill="${style.light}" shape-rendering="geometricPrecision"/>`,
      )
    }
    parts.push(
      `<image href="${image.src}" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" preserveAspectRatio="xMidYMid meet"/>`,
    )
  }
  parts.push("</svg>")
  return parts.join("")
}

/** A short, safe file name from the code's content: qr-digitallynext-com.png */
export function qrFileName(text: string, ext: "png" | "svg"): string {
  let base = text.trim()
  try {
    const url = new URL(base)
    base = `${url.hostname.replace(/^www\./, "")}${url.pathname === "/" ? "" : url.pathname}`
  } catch {
    // not a URL - use the text itself
  }
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "")
  return `qr-${slug || "code"}.${ext}`
}

/** WCAG relative luminance of a #rrggbb colour (0 = black, 1 = white). */
export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  if (!m) return 0
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => {
    const v = parseInt(h!, 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

export function colourProblem(dark: string, light: string): "inverted" | "low-contrast" | null {
  const d = luminance(dark)
  const l = luminance(light)
  if (d >= l) return "inverted"
  if ((l + 0.05) / (d + 0.05) < 4) return "low-contrast"
  return null
}
