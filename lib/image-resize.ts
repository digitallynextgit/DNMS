import "server-only"

// sharp is a native module that can fail to load, so it's imported lazily. Resizing is only an
// optimisation: if sharp is unavailable we store the original - never a 500 or a crash.

export interface ResizeResult {
  bytes: Buffer
  contentType: string
  ext: string
  width: number | null
  height: number | null
  /** False when the original was stored untouched, and why. */
  resized: boolean
}

/** Loaded lazily. `null` means sharp is unusable here. */
let sharpModule: typeof import("sharp") | null | undefined

async function loadSharp(): Promise<typeof import("sharp") | null> {
  if (sharpModule !== undefined) return sharpModule
  try {
    sharpModule = (await import("sharp")).default as unknown as typeof import("sharp")
  } catch (err) {
    // Logged once, not per upload.
    console.error("[image-resize] sharp unavailable - storing originals instead:", err)
    sharpModule = null
  }
  return sharpModule
}

/** Downscale to fit `maxDim` as JPEG. GIFs (animation) and unreadable images are returned untouched. */
export async function resizeImage(
  original: Buffer,
  originalType: string,
  opts: { maxDim: number; quality?: number },
): Promise<ResizeResult> {
  const fallback: ResizeResult = {
    bytes: original,
    contentType: originalType,
    ext: originalType.split("/")[1] ?? "jpg",
    width: null,
    height: null,
    resized: false,
  }

  if (originalType === "image/gif") return fallback

  const sharp = await loadSharp()
  if (!sharp) return fallback

  try {
    const out = await sharp(original)
      // Honour the EXIF orientation phones write, or portraits arrive sideways.
      .rotate()
      .resize(opts.maxDim, opts.maxDim, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: opts.quality ?? 82, mozjpeg: true })
      .toBuffer({ resolveWithObject: true })

    return {
      bytes: out.data,
      contentType: "image/jpeg",
      ext: "jpg",
      width: out.info.width,
      height: out.info.height,
      resized: true,
    }
  } catch (err) {
    console.error("[image-resize] resize failed, storing original:", err)
    return fallback
  }
}

export interface ThumbResult {
  bytes: Buffer
  contentType: string
  ext: string
  width: number | null
  height: number | null
}

/** WebP thumbnail made alongside the master. Null on failure - the grid falls back to the master. */
export async function makeThumb(
  original: Buffer,
  opts: { maxDim?: number; quality?: number } = {},
): Promise<ThumbResult | null> {
  const sharp = await loadSharp()
  if (!sharp) return null
  try {
    const out = await sharp(original)
      .rotate()
      .resize(opts.maxDim ?? 480, opts.maxDim ?? 480, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: opts.quality ?? 72 })
      .toBuffer({ resolveWithObject: true })
    return {
      bytes: out.data,
      contentType: "image/webp",
      ext: "webp",
      width: out.info.width,
      height: out.info.height,
    }
  } catch (err) {
    console.error("[image-resize] thumb failed, no thumbnail stored:", err)
    return null
  }
}
