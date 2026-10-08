"use client"

import { useRef, useState, useSyncExternalStore, type ReactNode } from "react"
import type {
  AudioCodec,
  ConversionAudioOptions,
  ConversionVideoOptions,
  StreamTargetChunk,
  VideoCodec,
} from "mediabunny"
import { AlertTriangle, FileVideo, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { formatBytes } from "../../lib/files"
import {
  BlobAssembler,
  FAST_START_MAX_BYTES,
  FORMAT_HELP,
  OUTPUT_MIME,
  PHONE_WARN_BYTES,
  codecLabel,
  dropMessage,
  formatDuration,
  timeLeftLabel,
  videoErrorMessage,
  type OutputKind,
  type TimeRange,
} from "../../lib/video"
import { FriendlyError, useObjectUrls } from "../pdf/shared"

type Mediabunny = typeof import("mediabunny")
type Gifenc = typeof import("gifenc")

let mediabunnyLoading: Promise<Mediabunny> | null = null
let gifencLoading: Promise<Gifenc> | null = null

/** mediabunny (MPL-2.0, used unmodified), loaded on first use. */
export function loadMediabunny(): Promise<Mediabunny> {
  if (!mediabunnyLoading) {
    mediabunnyLoading = import("mediabunny")
    // A failed load (flaky network) shouldn't stick - let the next try reload.
    mediabunnyLoading.catch(() => {
      mediabunnyLoading = null
    })
  }
  return mediabunnyLoading
}

/** gifenc (MIT), loaded only when someone makes a GIF. */
export function loadGifenc(): Promise<Gifenc> {
  if (!gifencLoading) {
    gifencLoading = import("gifenc")
    gifencLoading.catch(() => {
      gifencLoading = null
    })
  }
  return gifencLoading
}

/** no-audio: Safari before 26 has no AudioEncoder. insecure: WebCodecs needs https. */
export type CodecSupport = "full" | "no-audio" | "none" | "insecure"

function readSupport(): CodecSupport {
  if (!window.isSecureContext) return "insecure"
  const has = (name: string) => typeof (globalThis as Record<string, unknown>)[name] === "function"
  if (!has("VideoEncoder") || !has("VideoDecoder")) return "none"
  if (!has("AudioEncoder") || !has("AudioDecoder")) return "no-audio"
  return "full"
}

const subscribeNothing = () => () => {}

/** "full" on the server, so the notice never flashes up and away again. */
export function useCodecSupport(): CodecSupport {
  return useSyncExternalStore(subscribeNothing, readSupport, () => "full")
}

export function SupportNotice({ className }: { className?: string }) {
  const support = useCodecSupport()
  if (support === "full") return null
  const text: Record<Exclude<CodecSupport, "full">, ReactNode> = {
    insecure: (
      <>
        Video tools only work on a secure link. Open DNMS from its usual <strong>https://</strong>{" "}
        address.
      </>
    ),
    none: (
      <>
        <strong>Video tools need Chrome, Edge or a recent Safari on a computer.</strong> This
        browser can&apos;t make or change videos, so most tools here won&apos;t work.
      </>
    ),
    "no-audio": (
      <>
        This browser can&apos;t convert sound. Videos keep their sound when it&apos;s already AAC
        (most phone videos) - otherwise it may be left out. Chrome or Edge on a computer handles
        everything.
      </>
    ),
  }
  return (
    <Notice className={className} role="status">
      {text[support]}
    </Notice>
  )
}

export function Notice({
  children,
  className,
  role,
}: {
  children: ReactNode
  className?: string
  role?: "status" | "alert"
}) {
  return (
    <div
      role={role}
      className={cn(
        "flex gap-2 rounded-sm border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300",
        className,
      )}
    >
      <AlertTriangle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="min-w-0 space-y-1">{children}</div>
    </div>
  )
}

export interface VideoInfo {
  /** What the file really is ("video/mp4", "video/quicktime"...) - beats its extension. */
  mimeType: string
  /** Seconds. */
  duration: number
  hasVideo: boolean
  /** As shown (rotation applied) - a phone reel is 1080 x 1920. 0 without video. */
  width: number
  height: number
  fps: number | null
  videoCodec: VideoCodec | null
  canDecodeVideo: boolean
  hasAudio: boolean
  audioCodec: AudioCodec | null
  canDecodeAudio: boolean
  /** Bits per second, measured from the first few seconds. */
  audioBitrate: number | null
  sampleRate: number
  channels: number
  /** Video codecs this browser can make at this size, best first. */
  encodableVideo: VideoCodec[]
  /** Sound codecs this browser can make (at standard stereo 48 kHz). */
  encodableAudio: AudioCodec[]
}

const evenSize = (n: number) => Math.max(2, Math.round(n / 2) * 2)

export async function inspectVideo(file: File): Promise<VideoInfo> {
  const mb = await loadMediabunny()
  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS })
  try {
    const format = await input.getFormat()
    const video = await input.getPrimaryVideoTrack()
    const audio = await input.getPrimaryAudioTrack()
    if (!video && !audio) throw new FriendlyError("There's no video or sound in this file.")
    const duration = await input.computeDuration()
    if (!(duration > 0)) throw new FriendlyError("This video looks empty - it has no length.")

    const width = video ? await video.getDisplayWidth() : 0
    const height = video ? await video.getDisplayHeight() : 0
    const fps = video ? (await video.computePacketStats(120)).averagePacketRate || null : null
    const audioStats = audio ? await audio.computePacketStats(300) : null

    const encodableVideo = video
      ? await mb
          .getEncodableVideoCodecs(["avc", "hevc", "vp9", "av1", "vp8"], {
            width: evenSize(width),
            height: evenSize(height),
          })
          .catch(() => [])
      : []
    const encodableAudio = audio
      ? await mb
          .getEncodableAudioCodecs(["aac", "opus", "vorbis"], {
            numberOfChannels: 2,
            sampleRate: 48000,
          })
          .catch(() => [])
      : []

    return {
      mimeType: format.mimeType,
      duration,
      hasVideo: !!video,
      width,
      height,
      fps,
      videoCodec: video ? await video.getCodec() : null,
      canDecodeVideo: video ? await video.canDecode().catch(() => false) : false,
      hasAudio: !!audio,
      audioCodec: audio ? await audio.getCodec() : null,
      canDecodeAudio: audio ? await audio.canDecode().catch(() => false) : false,
      audioBitrate: audioStats?.averageBitrate || null,
      sampleRate: audio ? await audio.getSampleRate() : 0,
      channels: audio ? await audio.getNumberOfChannels() : 0,
      encodableVideo,
      encodableAudio,
    }
  } finally {
    input.dispose()
  }
}

/** A phone or tablet (where big videos can run out of memory). */
function isTouchFirst(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches
}

interface Picked {
  file: File
  info: VideoInfo | null
  url: string | null
  bigOnPhone: boolean
}

export function useVideoPick({
  need = "video",
  preview = false,
}: {
  need?: "video" | "audio"
  preview?: boolean
} = {}) {
  const [picked, setPicked] = useState<Picked | null>(null)
  const current = useRef<File | null>(null)
  const previewUrl = useRef<string | null>(null)
  const urls = useObjectUrls()

  function dropPreview() {
    urls.revoke(previewUrl.current)
    previewUrl.current = null
  }

  async function pick(file: File): Promise<VideoInfo | null> {
    dropPreview()
    current.current = file
    const url = preview ? urls.create(file) : null
    previewUrl.current = url
    setPicked({ file, info: null, url, bigOnPhone: file.size > PHONE_WARN_BYTES && isTouchFirst() })
    try {
      const info = await inspectVideo(file)
      if (need === "video" && !info.hasVideo)
        throw new FriendlyError("There's no picture in this file - pick a video.")
      if (need === "audio" && !info.hasAudio)
        throw new FriendlyError("This video has no sound to save.")
      if (current.current !== file) return null
      setPicked((p) => (p && p.file === file ? { ...p, info } : p))
      return info
    } catch (err) {
      if (current.current !== file) return null
      current.current = null
      dropPreview()
      setPicked(null)
      if (err instanceof FriendlyError) toast.error(err.message, { description: file.name })
      else {
        console.error("[video-toolkit]", err)
        toast.error(videoErrorMessage(err), { description: file.name })
      }
      return null
    }
  }

  function clear() {
    dropPreview()
    current.current = null
    setPicked(null)
  }

  return {
    file: picked?.file ?? null,
    info: picked?.info ?? null,
    url: picked?.url ?? null,
    bigOnPhone: picked?.bigOnPhone ?? false,
    pick,
    clear,
  }
}

export function VideoFileCard({
  file,
  info,
  onRemove,
  disabled,
}: {
  file: File
  info: VideoInfo | null
  onRemove: () => void
  disabled?: boolean
}) {
  const details = info
    ? [
        formatDuration(info.duration),
        info.hasVideo && `${info.width} x ${info.height}`,
        info.hasVideo && codecLabel(info.videoCodec),
        formatBytes(file.size),
      ]
        .filter(Boolean)
        .join(" · ")
    : "Reading..."
  return (
    <div className="flex items-center gap-3 rounded-sm border p-3">
      <div className="bg-muted text-muted-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-sm">
        <FileVideo className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={file.name}>
          {file.name}
        </p>
        <p className="text-muted-foreground text-xs">{details}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Remove ${file.name}`}
        title="Choose a different video"
        className="text-muted-foreground hover:text-destructive"
        disabled={disabled}
        onClick={onRemove}
      >
        <X />
      </Button>
    </div>
  )
}

export function FileWarnings({
  bigOnPhone,
  size,
  unreadable,
}: {
  bigOnPhone: boolean
  size: number
  unreadable?: boolean
}) {
  if (!bigOnPhone && !unreadable) return null
  return (
    <div className="space-y-2">
      {bigOnPhone && (
        <Notice>
          This is a big video for a phone ({formatBytes(size)}). It may run out of memory part-way -
          a computer works best for videos this size.
        </Notice>
      )}
      {unreadable && <Notice role="alert">{FORMAT_HELP}</Notice>}
    </div>
  )
}

export interface VideoJob {
  /** Progress from 0 to 1, and what's happening. */
  report(fraction: number, label: string): void
  /** Let the page repaint, and stop here if Stop was pressed. */
  checkpoint(): Promise<void>
  /** What Stop should do while the current step runs (e.g. cancel the conversion). */
  onStop(stop: (() => void) | null): void
}

export interface JobProgress {
  fraction: number
  label: string
  startedAt: number
  updatedAt: number
}

class JobStopped extends Error {}

/** MessageChannel, not setTimeout: background tabs throttle timers and would stall long jobs. */
function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    const channel = new MessageChannel()
    channel.port1.onmessage = () => {
      channel.port1.close()
      resolve()
    }
    channel.port2.postMessage(null)
  })
}

export function useVideoJob() {
  const [progress, setProgress] = useState<JobProgress | null>(null)
  const stopped = useRef(false)
  const stopHandler = useRef<(() => void) | null>(null)

  async function run(task: (job: VideoJob) => Promise<void>): Promise<boolean> {
    if (progress) return false
    stopped.current = false
    stopHandler.current = null
    const startedAt = Date.now()
    let painted = 0
    setProgress({ fraction: 0, label: "Getting ready...", startedAt, updatedAt: startedAt })
    const job: VideoJob = {
      report(fraction, label) {
        const now = Date.now()
        // Conversions report many times a second - a few repaints are plenty.
        if (now - painted < 200 && fraction < 1) return
        painted = now
        setProgress({ fraction, label, startedAt, updatedAt: now })
      },
      async checkpoint() {
        if (stopped.current) throw new JobStopped()
        await yieldToBrowser()
        if (stopped.current) throw new JobStopped()
      },
      onStop(stop) {
        stopHandler.current = stop
      },
    }
    try {
      await task(job)
      return true
    } catch (err) {
      const name = err instanceof Error ? err.name : ""
      if (stopped.current || err instanceof JobStopped || name === "ConversionCanceledError") {
        toast("Stopped - nothing was saved")
      } else if (err instanceof FriendlyError) {
        toast.error(err.message, { description: err.description })
      } else {
        console.error("[video-toolkit]", err)
        toast.error(videoErrorMessage(err))
      }
      return false
    } finally {
      stopHandler.current = null
      setProgress(null)
    }
  }

  return {
    progress,
    busy: progress !== null,
    run,
    stop() {
      stopped.current = true
      stopHandler.current?.()
    },
  }
}

export function JobStatus({
  progress,
  onStop,
}: {
  progress: JobProgress | null
  onStop: () => void
}) {
  if (!progress) return null
  const pct = Math.round(Math.min(1, Math.max(0, progress.fraction)) * 100)
  const left = timeLeftLabel(progress.updatedAt - progress.startedAt, progress.fraction)
  return (
    <div className="space-y-2" role="status" aria-live="polite">
      <Progress value={pct} aria-label="Progress" />
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground text-xs">
          {progress.label}
          {pct > 0 && ` · ${pct}%`}
          {left && <span className="block">{left}</span>}
        </span>
        <Button variant="ghost" className="text-muted-foreground px-2" onClick={onStop}>
          Stop
        </Button>
      </div>
    </div>
  )
}

export interface ConversionResult {
  blob: Blob
  notes: string[]
}

/** Output is collected as Blob pieces (BlobAssembler), so large files don't need two copies in RAM. */
export async function runConversion(
  job: VideoJob,
  opts: {
    file: File
    output: OutputKind
    label: string
    /** Rough output size - small outputs get "fast start" for web playback. */
    expectedBytes: number
    video?: ConversionVideoOptions
    audio?: ConversionAudioOptions
    trim?: TimeRange
    /** Fail, rather than save without it, if the picture / the sound can't be kept. */
    needVideo?: boolean
    needAudio?: boolean
  },
): Promise<ConversionResult> {
  const mb = await loadMediabunny()
  const input = new mb.Input({ source: new mb.BlobSource(opts.file), formats: mb.ALL_FORMATS })
  const pieces = new BlobAssembler()
  const target = new mb.StreamTarget(
    new WritableStream<StreamTargetChunk>({
      write(chunk) {
        pieces.write(chunk.position, chunk.data)
      },
    }),
    { chunked: true },
  )
  const fastStart = opts.expectedBytes <= FAST_START_MAX_BYTES ? ("in-memory" as const) : false
  const format =
    opts.output === "mov"
      ? new mb.MovOutputFormat({ fastStart })
      : opts.output === "webm"
        ? new mb.WebMOutputFormat()
        : opts.output === "mkv"
          ? new mb.MkvOutputFormat()
          : opts.output === "wav"
            ? new mb.WavOutputFormat({ large: opts.expectedBytes > 3.5 * 1024 ** 3 })
            : new mb.Mp4OutputFormat({ fastStart })
  const output = new mb.Output({ format, target })
  try {
    const conversion = await mb.Conversion.init({
      input,
      output,
      tracks: "primary",
      video: opts.video,
      audio: opts.audio,
      trim: opts.trim,
      showWarnings: false,
    })
    const notes: string[] = []
    for (const dropped of conversion.discardedTracks) {
      if (dropped.reason === "discarded_by_user") continue
      const kind = dropped.track.isVideoTrack() ? "video" : "audio"
      const message = dropMessage(kind, dropped.reason)
      if ((kind === "video" && opts.needVideo) || (kind === "audio" && opts.needAudio))
        throw new FriendlyError(message)
      notes.push(message)
    }
    if (!conversion.isValid) throw new FriendlyError(FORMAT_HELP)

    job.onStop(() => void conversion.cancel())
    conversion.onProgress = (fraction) => job.report(fraction, opts.label)
    await job.checkpoint() // a Stop pressed while getting ready
    await conversion.execute()
    job.onStop(null)
    return { blob: pieces.toBlob(OUTPUT_MIME[opts.output]), notes }
  } catch (err) {
    if (output.state === "pending" || output.state === "started")
      void output.cancel().catch(() => {})
    throw err
  } finally {
    input.dispose()
  }
}

/** The preview URL is revoked when the result is replaced or cleared, and on unmount. */
export function useResult<T extends object>() {
  const [result, setResult] = useState<(T & { blob: Blob; url: string }) | null>(null)
  const urls = useObjectUrls()
  return {
    result,
    show(blob: Blob, extra: T) {
      urls.revoke(result?.url)
      setResult({ ...extra, blob, url: urls.create(blob) })
    },
    clear() {
      urls.revoke(result?.url)
      setResult(null)
    },
  }
}

export function Notes({ notes }: { notes: readonly string[] }) {
  if (!notes.length) return null
  return (
    <Notice>
      {notes.map((note) => (
        <p key={note}>{note}</p>
      ))}
    </Notice>
  )
}

export const VIDEO_DROP_HINT = "MP4, MOV, WebM or MKV - up to 2 GB"
