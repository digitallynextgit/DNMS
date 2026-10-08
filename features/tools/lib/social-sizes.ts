import { baseName } from "./files"

export type SocialNetwork =
  | "instagram"
  | "facebook"
  | "linkedin"
  | "x"
  | "youtube"
  | "whatsapp"
  | "website"

export const SOCIAL_NETWORKS: readonly { id: SocialNetwork; title: string }[] = [
  { id: "instagram", title: "Instagram" },
  { id: "facebook", title: "Facebook" },
  { id: "linkedin", title: "LinkedIn" },
  { id: "x", title: "X (Twitter)" },
  { id: "youtube", title: "YouTube" },
  { id: "whatsapp", title: "WhatsApp" },
  { id: "website", title: "Website" },
]

export interface SocialPreset {
  /** Also the file-name part: photo-<id>-1080x1080.jpg */
  id: string
  network: SocialNetwork
  label: string
  width: number
  height: number
  note?: string
  /** The middle part that is never cut off - keep text and logos inside it. */
  safe?: { width: number; height: number }
}

export const SOCIAL_PRESETS: readonly SocialPreset[] = [
  {
    id: "instagram-post",
    network: "instagram",
    label: "Post (square)",
    width: 1080,
    height: 1080,
  },
  {
    id: "instagram-portrait",
    network: "instagram",
    label: "Post (portrait)",
    width: 1080,
    height: 1350,
    note: "Takes up the most room in the feed.",
  },
  {
    id: "instagram-story",
    network: "instagram",
    label: "Story / Reel",
    width: 1080,
    height: 1920,
    note: "Keep text away from the top and bottom - buttons cover them.",
    safe: { width: 1080, height: 1420 },
  },
  {
    id: "facebook-post",
    network: "facebook",
    label: "Post",
    width: 1200,
    height: 630,
  },
  {
    id: "facebook-cover",
    network: "facebook",
    label: "Page cover",
    width: 1640,
    height: 624,
    note: "Shows as 820 x 312 on a computer. Phones cut off the sides.",
  },
  {
    id: "facebook-story",
    network: "facebook",
    label: "Story",
    width: 1080,
    height: 1920,
    note: "Keep text away from the top and bottom - buttons cover them.",
    safe: { width: 1080, height: 1420 },
  },
  {
    id: "linkedin-post",
    network: "linkedin",
    label: "Post",
    width: 1200,
    height: 627,
  },
  {
    id: "linkedin-banner",
    network: "linkedin",
    label: "Profile banner",
    width: 1584,
    height: 396,
    note: "Your profile photo covers part of the left side.",
  },
  {
    id: "linkedin-company-cover",
    network: "linkedin",
    label: "Company page cover",
    width: 1128,
    height: 191,
  },
  {
    id: "x-post",
    network: "x",
    label: "Post",
    width: 1600,
    height: 900,
  },
  {
    id: "x-header",
    network: "x",
    label: "Header",
    width: 1500,
    height: 500,
    note: "Your profile photo covers part of the bottom left.",
  },
  {
    id: "youtube-thumbnail",
    network: "youtube",
    label: "Video thumbnail",
    width: 1280,
    height: 720,
  },
  {
    id: "youtube-banner",
    network: "youtube",
    label: "Channel banner",
    width: 2560,
    height: 1440,
    note: "Only the middle strip shows on every screen - keep text and logos inside it.",
    safe: { width: 1546, height: 423 },
  },
  {
    id: "whatsapp-status",
    network: "whatsapp",
    label: "Status",
    width: 1080,
    height: 1920,
    note: "Keep text away from the top and bottom edges.",
    safe: { width: 1080, height: 1420 },
  },
  {
    id: "og-image",
    network: "website",
    label: "Share image (Open Graph)",
    width: 1200,
    height: 630,
    note: "The picture shown when your page link is shared in WhatsApp, LinkedIn and others.",
  },
]

export function presetsFor(network: SocialNetwork): SocialPreset[] {
  return SOCIAL_PRESETS.filter((p) => p.network === network)
}

export function getPreset(id: string): SocialPreset | undefined {
  return SOCIAL_PRESETS.find((p) => p.id === id)
}

/** Custom sizes: big enough to be useful, small enough for every browser (phones cap canvases). */
export const CUSTOM_MIN = 16
export const CUSTOM_MAX = 4096

export function parseSide(text: string): number | null {
  if (!/^\s*\d+\s*$/.test(text)) return null
  const n = Number(text)
  return n >= CUSTOM_MIN && n <= CUSTOM_MAX ? n : null
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

/** "1:1", "4:5", "16:9" - or "1.91:1" when the whole-number ratio is unwieldy. */
export function aspectLabel(width: number, height: number): string {
  const w = Math.round(width)
  const h = Math.round(height)
  if (w <= 0 || h <= 0) return "-"
  const d = gcd(w, h)
  if (w / d <= 32 && h / d <= 32) return `${w / d}:${h / d}`
  const r = w / h
  return r >= 1 ? `${trimNumber(r)}:1` : `1:${trimNumber(1 / r)}`
}

function trimNumber(n: number): string {
  return String(Number(n.toFixed(2)))
}

/** "My Photo (1)" -> "my-photo-1" - safe in any file name. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "")
}

/** photo.jpg + instagram-post + 1080x1080 + jpg -> photo-instagram-post-1080x1080.jpg */
export function socialFileName(
  sourceName: string,
  presetId: string,
  width: number,
  height: number,
  ext: string,
): string {
  const base = slugify(baseName(sourceName)) || "image"
  return `${base}-${presetId}-${width}x${height}.${ext.replace(/^\./, "")}`
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** A point as fractions of the image: 0.5, 0.5 is the middle. */
export interface Centre {
  x: number
  y: number
}

/** Smallest and largest crop zoom. 1 = the biggest frame that fits the image. */
export const MIN_ZOOM = 1
export const MAX_ZOOM = 4

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

/** Zoom 1 is the biggest frame of that shape that fits. Kept inside the image, so the centre may move. */
export function cropRect(
  imgW: number,
  imgH: number,
  outW: number,
  outH: number,
  zoom: number,
  centre: Centre,
): Rect {
  const aspect = outW / outH
  let w: number
  let h: number
  if (imgW / imgH > aspect) {
    h = imgH
    w = imgH * aspect
  } else {
    w = imgW
    h = imgW / aspect
  }
  const z = clamp(zoom, MIN_ZOOM, MAX_ZOOM)
  w /= z
  h /= z
  return {
    x: clamp(centre.x * imgW - w / 2, 0, imgW - w),
    y: clamp(centre.y * imgH - h / 2, 0, imgH - h),
    w,
    h,
  }
}

export function rectCentre(r: Rect, imgW: number, imgH: number): Centre {
  return { x: (r.x + r.w / 2) / imgW, y: (r.y + r.h / 2) / imgH }
}

export function moveCrop(
  imgW: number,
  imgH: number,
  outW: number,
  outH: number,
  zoom: number,
  centre: Centre,
  dx: number,
  dy: number,
): Centre {
  const now = cropRect(imgW, imgH, outW, outH, zoom, centre)
  const moved = cropRect(imgW, imgH, outW, outH, zoom, {
    x: (now.x + now.w / 2 + dx) / imgW,
    y: (now.y + now.h / 2 + dy) / imgH,
  })
  return rectCentre(moved, imgW, imgH)
}

export function containRect(srcW: number, srcH: number, boxW: number, boxH: number): Rect {
  const s = Math.min(boxW / srcW, boxH / srcH)
  const w = srcW * s
  const h = srcH * s
  return { x: (boxW - w) / 2, y: (boxH - h) / 2, w, h }
}

export function coverRect(srcW: number, srcH: number, boxW: number, boxH: number): Rect {
  const s = Math.max(boxW / srcW, boxH / srcH)
  const w = srcW * s
  const h = srcH * s
  return { x: (boxW - w) / 2, y: (boxH - h) / 2, w, h }
}

/** Over 1 means the photo is enlarged and may look soft. */
export function enlargement(
  mode: "crop" | "fit",
  imgW: number,
  imgH: number,
  outW: number,
  outH: number,
  zoom: number,
): number {
  if (mode === "crop") {
    const r = cropRect(imgW, imgH, outW, outH, zoom, { x: 0.5, y: 0.5 })
    return outW / r.w
  }
  return containRect(imgW, imgH, outW, outH).w / imgW
}
