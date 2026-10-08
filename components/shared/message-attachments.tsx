"use client"

// Attachments inside a bubble, shared by chat and project messages. Files come through a
// membership-checked route, which the caller supplies as `urlFor`.

import * as React from "react"
import { FileText, Download, X, Play, Pause, Mic, User } from "lucide-react"

import { cn } from "@/lib/utils"
import { AvatarDisplay } from "@/components/shared/avatar-display"

export interface Attachment {
  id: string
  kind: "IMAGE" | "VIDEO" | "AUDIO" | "FILE" | "STICKER"
  fileName: string
  contentType: string
  size: number
  width: number | null
  height: number | null
  durationSec: number | null
  /** Peaks sampled while recording. Empty for audio that arrived as a file. */
  waveform?: number[]
}

export interface AttachmentAvatar {
  src: string | null
  firstName: string
  lastName: string
}

export type UrlFor = (id: string) => string

const chatUrl: UrlFor = (id) => `/api/chat/attachments/${id}/file`

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB"]
  let n = bytes / 1024
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(n < 10 ? 1 : 0)} ${units[i]}`
}

function clock(total: number): string {
  const m = Math.floor(total / 60)
  const s = Math.floor(total % 60)
  return `${m}:${String(s).padStart(2, "0")}`
}

export function MessageAttachments({
  attachments,
  fromMe,
  avatar,
  urlFor = chatUrl,
  onOpenMedia,
}: {
  attachments: Attachment[]
  fromMe: boolean
  avatar?: AttachmentAvatar | null
  urlFor?: UrlFor
  /** Opens the thread's conversation-wide viewer; without it, a one-image lightbox is used. */
  onOpenMedia?: (attachmentId: string) => void
}) {
  const [lightbox, setLightbox] = React.useState<Attachment | null>(null)
  const open = (a: Attachment) => (onOpenMedia ? onOpenMedia(a.id) : setLightbox(a))
  if (attachments.length === 0) return null

  return (
    <>
      <div className={cn("flex flex-col gap-1.5", attachments.length > 1 && "gap-1")}>
        {attachments.map((a) => {
          // A sticker IS the message: no frame or tint, and bigger than a thumbnail.
          if (a.kind === "STICKER") {
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={a.id}
                src={urlFor(a.id)}
                alt={a.fileName}
                loading="lazy"
                className="h-32 w-32 object-contain"
              />
            )
          }

          if (a.kind === "VIDEO") {
            return (
              <video
                key={a.id}
                src={urlFor(a.id)}
                controls
                preload="metadata"
                // Reserve the real shape so the thread doesn't jump.
                width={a.width ?? undefined}
                height={a.height ?? undefined}
                className="max-h-72 w-full max-w-64 rounded-sm bg-black object-contain"
              />
            )
          }

          if (a.kind === "IMAGE") {
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => open(a)}
                className="block overflow-hidden rounded-sm"
                aria-label={`Open ${a.fileName}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={urlFor(a.id)}
                  alt={a.fileName}
                  loading="lazy"
                  width={a.width ?? undefined}
                  height={a.height ?? undefined}
                  className="max-h-72 w-full max-w-64 object-cover"
                />
              </button>
            )
          }

          if (a.kind === "AUDIO") {
            return (
              <VoiceNote
                key={a.id}
                attachment={a}
                fromMe={fromMe}
                avatar={avatar}
                urlFor={urlFor}
              />
            )
          }

          return (
            <a
              key={a.id}
              // ?download=1 makes the signed URL carry the original name (`download` is lost on the redirect).
              href={`${urlFor(a.id)}?download=1`}
              download={a.fileName}
              className={cn(
                "flex items-center gap-2 rounded-sm border px-2.5 py-2 transition-colors",
                fromMe ? "border-current/20 hover:bg-current/10" : "hover:bg-background/60",
              )}
            >
              <FileText className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium">{a.fileName}</span>
                <span
                  className={cn(
                    "block text-[10px]",
                    fromMe ? "opacity-70" : "text-muted-foreground",
                  )}
                >
                  {humanSize(a.size)}
                </span>
              </span>
              <Download className="h-3.5 w-3.5 shrink-0 opacity-70" />
            </a>
          )
        })}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightbox(null)}
          role="presentation"
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute top-4 right-4 rounded-sm bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={() => setLightbox(null)}
          >
            <X className="h-4 w-4" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={urlFor(lightbox.id)}
            alt={lightbox.fileName}
            className="max-h-full max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}

const WAVE_BARS = 40

/** Fallback bars for uploaded audio (no stored peaks), seeded by id so the shape is stable. */
function placeholderWave(seed: string): number[] {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return Array.from({ length: WAVE_BARS }, (_, i) => {
    h = (h * 1103515245 + 12345) >>> 0
    // Taper the ends so it reads as a clip with a beginning and an end.
    const taper = Math.sin((Math.PI * (i + 1)) / (WAVE_BARS + 1))
    return Math.round((25 + (h % 70)) * (0.45 + 0.55 * taper))
  })
}

function fitBars(peaks: number[]): number[] {
  if (peaks.length === 0) return []
  if (peaks.length === WAVE_BARS) return peaks
  const out: number[] = []
  const per = peaks.length / WAVE_BARS
  for (let i = 0; i < WAVE_BARS; i++) {
    const slice = peaks.slice(Math.floor(i * per), Math.max(Math.floor((i + 1) * per), 1))
    out.push(slice.length ? Math.max(...slice) : 0)
  }
  return out
}

function VoiceNote({
  attachment: a,
  fromMe,
  avatar,
  urlFor,
}: {
  attachment: Attachment
  fromMe: boolean
  avatar?: AttachmentAvatar | null
  urlFor: UrlFor
}) {
  const audioRef = React.useRef<HTMLAudioElement>(null)
  const trackRef = React.useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = React.useState(false)
  const [position, setPosition] = React.useState(0)
  const [started, setStarted] = React.useState(false)

  const bars = React.useMemo(() => {
    const stored = fitBars(a.waveform ?? [])
    return stored.length ? stored : placeholderWave(a.id)
  }, [a.waveform, a.id])

  /** Prefer the recorded duration: MediaRecorder webm reports Infinity. */
  const [elementDuration, setElementDuration] = React.useState(0)
  const duration = a.durationSec || elementDuration || 0
  const ratio = duration > 0 ? Math.min(1, position / duration) : 0

  function toggle() {
    const el = audioRef.current
    if (!el) return
    if (el.paused) {
      void el.play().catch(() => setPlaying(false))
    } else {
      el.pause()
    }
  }

  function seekTo(clientX: number) {
    const track = trackRef.current
    const el = audioRef.current
    if (!track || !el || duration <= 0) return
    const box = track.getBoundingClientRect()
    const next = ((clientX - box.left) / box.width) * duration
    const clamped = Math.max(0, Math.min(duration, next))
    // An Infinity-duration webm may not fire timeupdate until it plays.
    setPosition(clamped)
    try {
      el.currentTime = clamped
    } catch {
      /* not seekable yet - the click is simply ignored */
    }
  }

  function nudge(deltaSec: number) {
    const el = audioRef.current
    if (!el || duration <= 0) return
    const next = Math.max(0, Math.min(duration, position + deltaSec))
    setPosition(next)
    try {
      el.currentTime = next
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex min-w-56 items-center gap-2.5">
      <audio
        ref={audioRef}
        src={urlFor(a.id)}
        preload="metadata"
        onPlay={() => {
          setPlaying(true)
          setStarted(true)
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false)
          setPosition(0)
        }}
        onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration
          if (Number.isFinite(d)) setElementDuration(d)
        }}
        className="hidden"
      />

      {/* The mic badge stays accent-coloured until the note has been played. */}
      <span className="relative shrink-0">
        {avatar ? (
          <AvatarDisplay
            src={avatar.src}
            firstName={avatar.firstName}
            lastName={avatar.lastName}
            size="md"
          />
        ) : (
          <span
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-sm",
              fromMe ? "bg-current/20" : "bg-muted",
            )}
          >
            <User className="h-5 w-5 opacity-70" />
          </span>
        )}
        <Mic
          className={cn(
            "absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5",
            started
              ? fromMe
                ? "opacity-60"
                : "text-muted-foreground"
              : fromMe
                ? "opacity-100"
                : "text-primary",
          )}
        />
      </span>

      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause voice message" : "Play voice message"}
        className="shrink-0 opacity-90 transition-opacity hover:opacity-100"
      >
        {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current" />}
      </button>

      <div className="min-w-0 flex-1">
        {/* The bars are the scrubber: click or drag to seek, arrows to nudge. */}
        <div
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-label="Seek voice message"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(position)}
          aria-valuetext={clock(position)}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            seekTo(e.clientX)
          }}
          onPointerMove={(e) => {
            if (e.buttons === 1) seekTo(e.clientX)
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") {
              e.preventDefault()
              nudge(2)
            }
            if (e.key === "ArrowLeft") {
              e.preventDefault()
              nudge(-2)
            }
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault()
              toggle()
            }
          }}
          className="relative flex h-7 cursor-pointer touch-none items-center gap-px focus-visible:outline-none"
        >
          {bars.map((p, i) => {
            const played = i / bars.length < ratio
            return (
              <span
                key={i}
                className={cn(
                  "flex-1 rounded-sm transition-colors",
                  played
                    ? fromMe
                      ? "bg-current"
                      : "bg-primary"
                    : fromMe
                      ? "bg-current/35"
                      : "bg-muted-foreground/35",
                )}
                style={{ height: `${Math.max(10, Math.min(100, p))}%` }}
              />
            )
          })}

          {/* Absolutely positioned so moving it never reflows the trace. */}
          <span
            className={cn(
              "pointer-events-none absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-sm shadow",
              fromMe ? "bg-current" : "bg-primary",
            )}
            style={{ left: `${ratio * 100}%` }}
          />
        </div>

        <span
          className={cn(
            "block text-[10px] tabular-nums",
            fromMe ? "opacity-70" : "text-muted-foreground",
          )}
          suppressHydrationWarning
        >
          {/* Counts up while playing; shows the total when idle. */}
          {clock(playing || position > 0 ? position : duration)}
        </span>
      </div>
    </div>
  )
}
