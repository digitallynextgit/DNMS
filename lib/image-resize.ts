import "server-only"

// =============================================================================
// Image downscaling that cannot take the server down
// =============================================================================
// `sharp` is a NATIVE module. When its binary cannot load - a version conflict,
// a missing DLL, a machine without the platform package - a top-level
// `import sharp from "sharp"` throws while the route module is being evaluated,
// and the dev server exits.
//
// That happened here: Next 16 bundles sharp 0.34.5 and this app had declared
// 0.35.3. Both ship a file called libvips-42.dll, Windows keeps only one module
// per DLL filename, so whichever loaded first won and the other's .node asked it
// for a symbol it did not have. ERR_DLOPEN_FAILED, server dead.
//
// The versions are aligned now, but the shape of the failure is the lesson:
// resizing is an OPTIMISATION. If it is unavailable, the right outcome is a
// larger file, not a 500 and certainly not a dead process.
// =============================================================================

export interface ResizeResult {
  bytes: Buffer
  contentType: string
  ext: string
  width: number | null
  height: number | null
  /** False when the original was stored untouched, and why. */
  resized: boolean
}

/** Loaded once, lazily. `null` means sharp is unusable on this machine. */
let sharpModule: typeof import("sharp") | null | undefined

async function loadSharp(): Promise<typeof import("sharp") | null> {
  if (sharpModule !== undefined) return sharpModule
  try {
    sharpModule = (await import("sharp")).default as unknown as typeof import("sharp")
  } catch (err) {
    // Logged ONCE, not per upload: a broken native module would otherwise fill
    // the log with the same stack on every image.
    console.error("[image-resize] sharp unavailable - storing originals instead:", err)
    sharpModule = null
  }
  return sharpModule
}

/**
 * Downscale to fit `maxDim` and re-encode as JPEG.
 *
 * GIFs are returned untouched: sharp would flatten an animation to its first
 * frame, which is worse than a large file. Anything sharp cannot read is also
 * returned untouched rather than rejected - a photo somebody chose to upload
 * should not disappear because a codec was unexpected.
 */
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
