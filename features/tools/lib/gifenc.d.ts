// Types for gifenc 1.0.3 (MIT), which ships none - only what Video -> GIF uses.
// No top-level imports/exports, so this stays an ambient declaration.

declare module "gifenc" {
  /** A palette colour: [r, g, b] or [r, g, b, a], each 0-255. */
  export type GifColor = number[]
  export type GifPalette = GifColor[]
  export type GifFormat = "rgb565" | "rgb444" | "rgba4444"

  export interface QuantizeOptions {
    format?: GifFormat
    oneBitAlpha?: boolean | number
    clearAlpha?: boolean
    clearAlphaThreshold?: number
    clearAlphaColor?: number
  }

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: QuantizeOptions,
  ): GifPalette

  /** Map each RGBA pixel to its nearest palette index (one byte per pixel). */
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: GifPalette,
    format?: GifFormat,
  ): Uint8Array

  export interface WriteFrameOptions {
    /** Colour table for this frame - required on the first frame. */
    palette?: GifPalette
    /** How long the frame shows, in ms (stored in hundredths of a second). */
    delay?: number
    /** 0 = loop forever (the default), -1 = play once, n = n repeats. */
    repeat?: number
    transparent?: boolean
    transparentIndex?: number
    dispose?: number
    first?: boolean
    colorDepth?: number
  }

  export interface GifEncoderStream {
    writeFrame(index: Uint8Array, width: number, height: number, options?: WriteFrameOptions): void
    /** Writes the end-of-file marker. Call once, after the last frame. */
    finish(): void
    bytes(): Uint8Array
    /** The GIF so far, without copying - don't keep it past the next write. */
    bytesView(): Uint8Array
    reset(): void
    writeHeader(): void
    readonly buffer: ArrayBuffer
  }

  export function GIFEncoder(options?: {
    auto?: boolean
    initialCapacity?: number
  }): GifEncoderStream
}
