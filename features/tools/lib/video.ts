import { baseName } from "./files"

export const MAX_VIDEO_BYTES = 2 * 1024 ** 3
/** Above this, a phone may run out of memory - warn first. */
export const PHONE_WARN_BYTES = 500 * 1024 ** 2
/** Smaller outputs get "fast start" (index up front); it's built in memory, so big files skip it. */
export const FAST_START_MAX_BYTES = 256 * 1024 ** 2
export const MAX_GIF_SECONDS = 15
export const MIN_CLIP_SECONDS = 0.1

/** What the video pickers accept (some browsers leave .mkv / .mov types blank, hence the extensions). */
export const VIDEO_ACCEPT = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
  ".mp4",
  ".m4v",
  ".mov",
  ".webm",
  ".mkv",
] as const

export const FORMAT_HELP =
  "This browser can't read this video's format - try Chrome or Edge on a computer."
export const ENCODE_HELP =
  "This browser can't make this kind of video - try Chrome or Edge on a computer."

const pad2 = (n: number) => String(n).padStart(2, "0")

/** A time to the tenth of a second: "0:12.5", "12:05.0", "1:02:03.4". */
export function formatTime(seconds: number): string {
  const tenths = Math.max(0, Math.round((Number.isFinite(seconds) ? seconds : 0) * 10))
  const h = Math.floor(tenths / 36000)
  const m = Math.floor((tenths % 36000) / 600)
  const s = Math.floor((tenths % 600) / 10)
  const rest = `${pad2(s)}.${tenths % 10}`
  return h > 0 ? `${h}:${pad2(m)}:${rest}` : `${m}:${rest}`
}

/** A length in whole seconds: "0:32", "4:05", "1:02:03". */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(Number.isFinite(seconds) ? seconds : 0))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`
}

/** "12.5", "1:05", "1:02:03" -> seconds. Parts over 59 are refused with colons ("1:75" is a typo). */
export function parseTime(text: string): number | null {
  const parts = text.trim().replace(",", ".").split(":")
  if (parts.length > 3) return null
  const last = parts.pop() ?? ""
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(last)) return null
  let total = Number(last)
  if (parts.length > 0 && total >= 60) return null
  let unit = 60
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i] ?? ""
    if (!/^\d+$/.test(part)) return null
    const n = Number(part)
    if (i > 0 && n >= 60) return null
    total += n * unit
    unit *= 60
  }
  return total
}

/** A time for a file name: 12 -> "0m12s", 75.5 -> "1m15.5s", 3723 -> "1h02m03s". */
export function timeTag(seconds: number): string {
  const tenths = Math.max(0, Math.round(seconds * 10))
  const h = Math.floor(tenths / 36000)
  const m = Math.floor((tenths % 36000) / 600)
  const s = Math.floor((tenths % 600) / 10)
  const t = tenths % 10
  const sec = `${pad2(s)}${t ? `.${t}` : ""}s`
  return h > 0 ? `${h}h${pad2(m)}m${sec}` : `${m}m${sec}`
}

export interface TimeRange {
  start: number
  end: number
}

const roundTenth = (t: number) => Math.round(t * 10) / 10

/** If the new start leaves no room, the end moves along; a selection never exceeds maxLength. */
export function moveRangeStart(
  range: TimeRange,
  t: number,
  duration: number,
  maxLength?: number,
): TimeRange {
  const start = Math.min(Math.max(0, t), Math.max(0, duration - MIN_CLIP_SECONDS))
  const length = Math.max(MIN_CLIP_SECONDS, range.end - range.start)
  let end = range.end
  if (end - start < MIN_CLIP_SECONDS) end = Math.min(duration, start + length)
  if (maxLength && end - start > maxLength) end = start + maxLength
  return { start, end: Math.min(end, duration) }
}

export function moveRangeEnd(
  range: TimeRange,
  t: number,
  duration: number,
  maxLength?: number,
): TimeRange {
  const end = Math.max(Math.min(duration, t), Math.min(duration, MIN_CLIP_SECONDS))
  const length = Math.max(MIN_CLIP_SECONDS, range.end - range.start)
  let start = range.start
  if (end - start < MIN_CLIP_SECONDS) start = Math.max(0, end - length)
  if (maxLength && end - start > maxLength) start = end - maxLength
  return { start: Math.max(0, start), end }
}

export function initialRange(duration: number, maxLength?: number): TimeRange {
  return { start: 0, end: maxLength ? Math.min(duration, maxLength) : duration }
}

export function rangeProblem(
  range: TimeRange,
  duration: number,
  maxLength?: number,
): string | null {
  if (!(range.start >= 0) || !(range.end > 0)) return "Pick a start and an end"
  if (range.end > duration + 0.05)
    return `The end is past the end of the video (${formatTime(duration)})`
  if (range.end - range.start < MIN_CLIP_SECONDS - 1e-9) return "The end must be after the start"
  if (maxLength && range.end - range.start > maxLength + 0.05)
    return `Pick ${maxLength} seconds or less`
  return null
}

export function tidyRange(range: TimeRange): TimeRange {
  return { start: roundTenth(range.start), end: roundTenth(range.end) }
}

export type CompressPreset = "small" | "balanced" | "high"
export type MaxResolution = "original" | "1080" | "720" | "480"

/** H.264 bits per pixel per frame. Balanced is about 5 Mbps for 1080p30 - fine for YouTube/Instagram. */
const BITS_PER_PIXEL: Record<CompressPreset, number> = {
  small: 0.05,
  balanced: 0.08,
  high: 0.12,
}

/** Cap as a share of the source bitrate, so an already well-compressed video still shrinks. */
const SOURCE_SHARE: Record<CompressPreset, number> = {
  small: 0.45,
  balanced: 0.65,
  high: 0.85,
}

export const AUDIO_BITRATE: Record<CompressPreset, number> = {
  small: 96_000,
  balanced: 128_000,
  high: 160_000,
}

const MIN_VIDEO_BITRATE = 200_000

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2)

/** The limit is on the SHORT side (1080p = 1920x1080 or 1080x1920). Never scales up; always even. */
export function fitResolution(
  width: number,
  height: number,
  max: MaxResolution,
): { width: number; height: number } {
  const short = Math.min(width, height)
  const limit = max === "original" ? short : Number(max)
  const scale = short > limit ? limit / short : 1
  return { width: even(width * scale), height: even(height * scale) }
}

/** Bits per second. */
export function videoBitrate(opts: {
  width: number
  height: number
  fps: number | null
  preset: CompressPreset
  sourceBitrate?: number | null
  sourceWidth?: number
  sourceHeight?: number
}): number {
  const fps = Math.min(60, Math.max(10, opts.fps ?? 30))
  // Twice the frames doesn't need twice the bits: 60 fps gets about 1.5x of 30.
  const effectiveFps = fps <= 30 ? fps : 30 + (fps - 30) / 2
  let bitrate = BITS_PER_PIXEL[opts.preset] * opts.width * opts.height * effectiveFps
  const { sourceBitrate, sourceWidth, sourceHeight } = opts
  if (sourceBitrate && sourceWidth && sourceHeight) {
    // Fewer pixels need fewer bits - though not proportionally fewer.
    const pixels = Math.min(1, (opts.width * opts.height) / (sourceWidth * sourceHeight))
    bitrate = Math.min(bitrate, sourceBitrate * pixels ** 0.75 * SOURCE_SHARE[opts.preset])
  }
  return Math.max(MIN_VIDEO_BITRATE, Math.round(bitrate / 1000) * 1000)
}

const EFFICIENT_CODECS = new Set(["hevc", "vp9", "av1"])

/** About the original's bitrate, adjusted for codec efficiency and capped (a camera's 50 Mbps isn't copied). */
export function convertVideoBitrate(opts: {
  width: number
  height: number
  fps: number | null
  sourceBitrate: number | null
  from: string | null
  to: string
}): number {
  const fromEfficient = EFFICIENT_CODECS.has(opts.from ?? "")
  const toEfficient = EFFICIENT_CODECS.has(opts.to)
  const factor = fromEfficient === toEfficient ? 1 : fromEfficient ? 1.4 : 0.75
  // About 0.15 bits per pixel per frame - beyond what anyone can see.
  const ceiling =
    videoBitrate({ width: opts.width, height: opts.height, fps: opts.fps, preset: "high" }) * 1.25
  const wanted = opts.sourceBitrate ? opts.sourceBitrate * factor : ceiling
  return Math.max(MIN_VIDEO_BITRATE, Math.round(Math.min(wanted, ceiling) / 1000) * 1000)
}

/** Worked out from the file size, minus the sound. */
export function sourceVideoBitrate(
  fileBytes: number,
  duration: number,
  audioBitrate: number | null,
): number | null {
  if (!(duration > 0) || !(fileBytes > 0)) return null
  const total = (fileBytes * 8) / duration
  return Math.max(0, total - (audioBitrate ?? 0)) || null
}

export type AudioPlan =
  | { action: "copy" }
  | { action: "encode"; bitrate: number }
  | { action: "auto" }

/** AAC near the preset bitrate is kept as is (re-encoding only loses quality); the rest becomes AAC. */
export function planCompressAudio(opts: {
  preset: CompressPreset
  sourceCodec: string | null
  sourceBitrate: number | null
  canEncodeAac: boolean
}): AudioPlan {
  const target = AUDIO_BITRATE[opts.preset]
  if (
    opts.sourceCodec === "aac" &&
    (opts.sourceBitrate === null || opts.sourceBitrate <= target * 1.25)
  )
    return { action: "copy" }
  if (opts.canEncodeAac) return { action: "encode", bitrate: target }
  return { action: "auto" }
}

export function estimateBytes(videoBps: number, audioBps: number, seconds: number): number {
  // About 2% on top for the container's own bookkeeping.
  return Math.round((((videoBps + audioBps) * seconds) / 8) * 1.02)
}

export interface CompressionPlan {
  width: number
  height: number
  resize: boolean
  videoBitrate: number
  audio: AudioPlan | null
  estimatedBytes: number
}

export function planCompression(opts: {
  fileBytes: number
  duration: number
  width: number
  height: number
  fps: number | null
  hasAudio: boolean
  audioCodec: string | null
  audioBitrate: number | null
  canEncodeAac: boolean
  preset: CompressPreset
  maxResolution: MaxResolution
}): CompressionPlan {
  const size = fitResolution(opts.width, opts.height, opts.maxResolution)
  const video = videoBitrate({
    ...size,
    fps: opts.fps,
    preset: opts.preset,
    sourceBitrate: sourceVideoBitrate(
      opts.fileBytes,
      opts.duration,
      opts.hasAudio ? opts.audioBitrate : 0,
    ),
    sourceWidth: opts.width,
    sourceHeight: opts.height,
  })
  const audio = opts.hasAudio
    ? planCompressAudio({
        preset: opts.preset,
        sourceCodec: opts.audioCodec,
        sourceBitrate: opts.audioBitrate,
        canEncodeAac: opts.canEncodeAac,
      })
    : null
  const audioBps = !audio
    ? 0
    : audio.action === "encode"
      ? audio.bitrate
      : (opts.audioBitrate ?? AUDIO_BITRATE[opts.preset])
  return {
    ...size,
    resize: size.width !== opts.width || size.height !== opts.height,
    videoBitrate: video,
    audio,
    estimatedBytes: estimateBytes(video, audioBps, opts.duration),
  }
}

export function formatBitrate(bps: number): string {
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`
  return `${Math.round(bps / 1000)} kbps`
}

export type ConvertTarget = "mp4" | "webm"

/** What Convert aims for in each format, best first - a track already in one of these is copied. */
export const PREFERRED_CODECS: Record<ConvertTarget, { video: string[]; audio: string[] }> = {
  // H.264 + AAC is the pair every phone, laptop, app and social site plays.
  mp4: { video: ["avc"], audio: ["aac"] },
  webm: { video: ["vp9", "vp8", "av1"], audio: ["opus", "vorbis"] },
}

/** What each format can hold - a track in one of these can be copied in when nothing better is possible. */
export const CONTAINER_CODECS: Record<ConvertTarget, { video: string[]; audio: string[] }> = {
  mp4: {
    video: ["avc", "hevc", "av1", "vp9", "vp8"],
    audio: ["aac", "mp3", "opus", "flac", "ac3", "eac3"],
  },
  webm: { video: ["vp9", "vp8", "av1"], audio: ["opus", "vorbis"] },
}

/**
 * Copy a track already in a preferred codec; else the first preferred codec the browser can make;
 * else copy the track's own codec if the container holds it; else any codec the container takes.
 */
export function chooseCodec<T extends string>(opts: {
  source: T | null
  preferred: readonly T[]
  container: readonly T[]
  encodable: readonly T[]
}): { codec: T; copy: boolean } | null {
  const { source, preferred, container, encodable } = opts
  const fits = preferred.filter((c) => container.includes(c))
  if (source && fits.includes(source)) return { codec: source, copy: true }
  const made = fits.find((c) => encodable.includes(c))
  if (made) return { codec: made, copy: false }
  if (source && container.includes(source)) return { codec: source, copy: true }
  const fallback = container.find((c) => encodable.includes(c))
  return fallback ? { codec: fallback, copy: false } : null
}

const CODEC_LABELS: Record<string, string> = {
  avc: "H.264",
  hevc: "HEVC (H.265)",
  vp8: "VP8",
  vp9: "VP9",
  av1: "AV1",
  prores: "ProRes",
  aac: "AAC",
  opus: "Opus",
  mp3: "MP3",
  vorbis: "Vorbis",
  flac: "FLAC",
  ac3: "Dolby Digital",
  eac3: "Dolby Digital Plus",
  dts: "DTS",
}

/** A codec's everyday name: "avc" -> "H.264", "pcm-s16" -> "PCM". */
export function codecLabel(codec: string | null | undefined): string {
  if (!codec) return "Unknown"
  if (codec.startsWith("pcm") || codec === "ulaw" || codec === "alaw") return "PCM"
  return CODEC_LABELS[codec] ?? codec.toUpperCase()
}

export type VideoContainer = "mp4" | "mov" | "webm" | "mkv"
export type OutputKind = VideoContainer | "m4a" | "wav"

export const OUTPUT_MIME: Record<OutputKind, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mkv: "video/x-matroska",
  m4a: "audio/mp4",
  wav: "audio/wav",
}

/** The video's own container for MOV and WebM, MP4 for everything else (MKV is better as MP4). */
export function trimContainer(mimeType: string | null, fileName: string): VideoContainer {
  const type = (mimeType ?? "").toLowerCase()
  const name = fileName.toLowerCase()
  if (type === "video/quicktime" || (!type && name.endsWith(".mov"))) return "mov"
  if (type === "video/webm" || (!type && name.endsWith(".webm"))) return "webm"
  return "mp4"
}

export function compressedName(fileName: string, ext = "mp4"): string {
  return `${baseName(fileName)}-compressed.${ext}`
}

/** reel.mp4 -> reel-trim-0m12s-0m25s.mp4 */
export function trimmedName(fileName: string, range: TimeRange, ext: string): string {
  return `${baseName(fileName)}-trim-${timeTag(range.start)}-${timeTag(range.end)}.${ext}`
}

/** clip.mov -> clip.mp4 (or clip-converted.mp4 when it was an MP4 already). */
export function convertedName(fileName: string, ext: string): string {
  const dot = fileName.lastIndexOf(".")
  const current = dot > 0 ? fileName.slice(dot + 1).toLowerCase() : ""
  const sameType = current === ext || (ext === "mp4" && current === "m4v")
  return `${baseName(fileName)}${sameType ? "-converted" : ""}.${ext}`
}

export function gifName(fileName: string): string {
  return `${baseName(fileName)}.gif`
}

export function audioName(fileName: string, ext: "m4a" | "wav"): string {
  return `${baseName(fileName)}-audio.${ext}`
}

export const GIF_WIDTHS = [320, 480, 640] as const
export const GIF_FPS = [8, 10, 15] as const
export type GifWidth = (typeof GIF_WIDTHS)[number]
export type GifFps = (typeof GIF_FPS)[number]

/** Rough GIF bytes per pixel per frame for camera video (grainy footage ~0.6, graphics far less). */
const GIF_BYTES_PER_PIXEL = 0.5

export function gifSize(
  width: number,
  sourceWidth: number,
  sourceHeight: number,
): { width: number; height: number } {
  const w = Math.max(2, Math.round(Math.min(width, sourceWidth)))
  return { width: w, height: Math.max(2, Math.round((w * sourceHeight) / sourceWidth)) }
}

export function gifFrameCount(seconds: number, fps: number): number {
  return Math.max(1, Math.round(seconds * fps))
}

export function gifFrameTimes(range: TimeRange, fps: number): number[] {
  const count = gifFrameCount(range.end - range.start, fps)
  return Array.from({ length: count }, (_, i) => range.start + i / fps)
}

/** GIFs count in 1/100 s, so e.g. 60 and 70 ms frames are mixed to match the clip's length. */
export function gifDelays(count: number, fps: number): number[] {
  const at = (i: number) => Math.round((i * 100) / fps)
  return Array.from({ length: count }, (_, i) => (at(i + 1) - at(i)) * 10)
}

export function estimateGifBytes(width: number, height: number, frames: number): number {
  return Math.round(width * height * frames * GIF_BYTES_PER_PIXEL) + 1024
}

/** Size of a 16-bit WAV of this length. */
export function wavBytes(seconds: number, sampleRate: number, channels: number): number {
  return 44 + Math.round(seconds * sampleRate) * channels * 2
}

/** "About 3 min left" while a job runs - or null until there's enough to go on. */
export function timeLeftLabel(elapsedMs: number, fraction: number): string | null {
  if (elapsedMs < 3000 || fraction < 0.03 || fraction >= 1) return null
  const left = (elapsedMs / fraction - elapsedMs) / 1000
  if (left < 50) return "Less than a minute left"
  const minutes = Math.round(left / 60)
  if (minutes < 60) return `About ${minutes} min left`
  const hours = Math.floor(minutes / 60)
  return `About ${hours} h ${minutes % 60} min left`
}

/** Why the converter left a track out (mediabunny's DiscardedTrack reasons). */
export type DropReason =
  | "discarded_by_user"
  | "max_track_count_reached"
  | "max_track_count_of_type_reached"
  | "unknown_source_codec"
  | "undecodable_source_codec"
  | "no_encodable_target_codec"
  | "cannot_copy"

export function dropMessage(kind: "video" | "audio", reason: DropReason): string {
  const unreadable = reason === "unknown_source_codec" || reason === "undecodable_source_codec"
  if (kind === "video") return unreadable ? FORMAT_HELP : ENCODE_HELP
  return unreadable
    ? "The sound is in a format this browser can't read, so it was left out."
    : "This browser can't convert the sound, so it was left out. Chrome or Edge on a computer can keep it."
}

export function videoErrorMessage(err: unknown): string {
  const name = err instanceof Error ? err.name : ""
  const message = err instanceof Error ? err.message : String(err)
  if (
    name === "UnsupportedInputFormatError" ||
    /unsupported or unrecogni[sz]able format|decod/i.test(message)
  )
    return FORMAT_HELP
  if (
    name === "QuotaExceededError" ||
    /out of memory|allocation failed|array buffer allocation|exceeded maximum size/i.test(message)
  )
    return "Your device ran out of memory - try a shorter clip or a smaller size, or use a computer."
  if (name === "NotReadableError" || name === "NotFoundError")
    return "Couldn't read the file - it may have been moved or renamed. Choose it again."
  if (name === "NotSupportedError" || /encod/i.test(message)) return ENCODE_HELP
  return "Something went wrong with this video. Try again, or try Chrome or Edge on a computer."
}

interface Piece {
  start: number
  end: number
  blob: Blob
}

/** One Blob from pieces written at byte positions; kept as Blobs so big outputs never need a second copy. */
export class BlobAssembler {
  private pieces: Piece[] = []
  private length = 0

  get size(): number {
    return this.length
  }

  write(position: number, data: Uint8Array): void {
    if (data.byteLength === 0) return
    const end = position + data.byteLength
    if (position > this.length) {
      // A gap: the file has zeros there until something fills them in.
      this.append(new Uint8Array(position - this.length))
    }
    if (position >= this.length) {
      this.append(data)
      return
    }
    const overlapEnd = Math.min(end, this.length)
    this.overwrite(position, data.subarray(0, overlapEnd - position))
    if (end > overlapEnd) this.append(data.subarray(overlapEnd - position))
  }

  toBlob(type: string): Blob {
    return new Blob(
      this.pieces.map((p) => p.blob),
      { type },
    )
  }

  private append(data: Uint8Array): void {
    const blob = new Blob([data as BlobPart])
    this.pieces.push({ start: this.length, end: this.length + data.byteLength, blob })
    this.length += data.byteLength
  }

  private overwrite(position: number, data: Uint8Array): void {
    const end = position + data.byteLength
    const replaced: Piece = { start: position, end, blob: new Blob([data as BlobPart]) }
    const cut = (p: Piece, from: number, to: number): Piece => ({
      start: from,
      end: to,
      blob: p.blob.slice(from - p.start, to - p.start),
    })
    const next: Piece[] = []
    let placed = false
    for (const p of this.pieces) {
      if (p.end <= position) {
        next.push(p)
        continue
      }
      if (p.start < position) next.push(cut(p, p.start, position))
      if (!placed) {
        next.push(replaced)
        placed = true
      }
      if (p.end > end) next.push(cut(p, Math.max(p.start, end), p.end))
    }
    this.pieces = next
  }
}
