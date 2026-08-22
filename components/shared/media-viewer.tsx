"use client"

/**
 * The full-screen media viewer you get by tapping a picture in a conversation:
 * who sent it and when, zoom, download, and the rest of that chat's media along
 * the bottom to step through.
 *
 * It replaces a lightbox that showed one image with a close button - opening the
 * third photo somebody sent meant closing, scrolling, and tapping again.
 *
 * The gallery is assembled by the THREAD, not by a message: a viewer that only
 * knew its own message could never offer next/previous across a conversation,
 * which is the whole point of the filmstrip.
 */

import * as React from "react"
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Download,
  Play,
  RotateCcw,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { AvatarDisplay } from "@/components/shared/avatar-display"

export interface MediaItem {
  id: string
  fileName: string
  /** "IMAGE" | "VIDEO" - anything else is not offered to the viewer. */
  kind: string
  authorName: string
  authorPhoto?: string | null
  createdAt: string
}

const MAX_ZOOM = 5
const MIN_ZOOM = 1
const ZOOM_STEP = 0.5

export function MediaViewer({
  items,
  index,
  onIndexChange,
  onClose,
  urlFor,
}: {
  items: MediaItem[]
  index: number
  onIndexChange: (i: number) => void
  onClose: () => void
  /** Resolves an attachment id to its streaming URL. */
  urlFor: (id: string) => string
}) {
  const [zoom, setZoom] = React.useState(1)
  const [pan, setPan] = React.useState({ x: 0, y: 0 })
  const drag = React.useRef<{ x: number; y: number } | null>(null)
  const stripRef = React.useRef<HTMLDivElement>(null)

  const current = items[index]

  // A new picture starts fitted - carrying a 3× zoom onto the next one lands you
  // somewhere in the middle of an image you have not seen yet.
  React.useEffect(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [index])

  // Keep the active thumbnail in view as you arrow through.
  React.useEffect(() => {
    stripRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" })
  }, [index])

  const go = React.useCallback(
    (delta: number) => {
      const next = index + delta
      if (next >= 0 && next < items.length) onIndexChange(next)
    },
    [index, items.length, onIndexChange],
  )

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      else if (e.key === "ArrowLeft") go(-1)
      else if (e.key === "ArrowRight") go(1)
      else if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))
      else if (e.key === "-") setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [go, onClose])

  if (!current) return null

  const isVideo = current.kind === "VIDEO"
  const zoomed = zoom > 1

  function zoomBy(delta: number) {
    setZoom((z) => {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + delta))
      // Back to 1× re-centres, so you never end up fitted but scrolled off.
      if (next === 1) setPan({ x: 0, y: 0 })
      return next
    })
  }

  const at = new Date(current.createdAt).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95" role="dialog" aria-modal="true">
      {/* Who and when, then the actions. */}
      <div className="flex h-14 shrink-0 items-center gap-3 px-3 text-white">
        <AvatarDisplay
          src={current.authorPhoto ?? null}
          firstName={current.authorName}
          lastName=""
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{current.authorName}</p>
          <p className="truncate text-[11px] text-white/60" suppressHydrationWarning>
            {at}
          </p>
        </div>

        {!isVideo && (
          <>
            <ViewerButton label="Zoom out" onClick={() => zoomBy(-ZOOM_STEP)} disabled={zoom <= 1}>
              <ZoomOut className="h-4 w-4" />
            </ViewerButton>
            <ViewerButton
              label="Zoom in"
              onClick={() => zoomBy(ZOOM_STEP)}
              disabled={zoom >= MAX_ZOOM}
            >
              <ZoomIn className="h-4 w-4" />
            </ViewerButton>
            {zoomed && (
              <ViewerButton
                label="Reset zoom"
                onClick={() => {
                  setZoom(1)
                  setPan({ x: 0, y: 0 })
                }}
              >
                <RotateCcw className="h-4 w-4" />
              </ViewerButton>
            )}
          </>
        )}

        {/* ?download=1 signs the object with Content-Disposition: attachment.
            A plain `download` attribute cannot do it - the route redirects to
            storage, and the attribute is dropped on a cross-origin hop. */}
        <ViewerButton label="Download" asChild>
          <a href={`${urlFor(current.id)}?download=1`} download={current.fileName}>
            <Download className="h-4 w-4" />
          </a>
        </ViewerButton>

        <ViewerButton label="Close" onClick={onClose}>
          <X className="h-5 w-5" />
        </ViewerButton>
      </div>

      {/* Stage */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        {index > 0 && <ArrowButton side="left" onClick={() => go(-1)} />}

        {isVideo ? (
          <video
            key={current.id}
            src={urlFor(current.id)}
            controls
            autoPlay
            playsInline
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={current.id}
            src={urlFor(current.id)}
            alt={current.fileName}
            draggable={false}
            onPointerDown={(e) => {
              if (!zoomed) return
              drag.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
              e.currentTarget.setPointerCapture(e.pointerId)
            }}
            onPointerMove={(e) => {
              if (!drag.current) return
              setPan({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y })
            }}
            onPointerUp={() => {
              drag.current = null
            }}
            onWheel={(e) => zoomBy(e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)}
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
            className={cn(
              "max-h-full max-w-full object-contain transition-transform",
              zoomed ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in",
            )}
          />
        )}

        {index < items.length - 1 && <ArrowButton side="right" onClick={() => go(1)} />}
      </div>

      {/* Everything else in this conversation. One item needs no filmstrip. */}
      {items.length > 1 && (
        <div ref={stripRef} className="flex shrink-0 items-center gap-2 overflow-x-auto px-3 py-3">
          {items.map((m, i) => (
            <button
              key={m.id}
              type="button"
              data-active={i === index}
              onClick={() => onIndexChange(i)}
              aria-label={m.fileName}
              aria-current={i === index}
              className={cn(
                "relative h-14 w-14 shrink-0 overflow-hidden rounded-sm border-2 transition-colors",
                i === index ? "border-primary" : "border-transparent hover:border-white/40",
              )}
            >
              {m.kind === "VIDEO" ? (
                <>
                  <video
                    src={urlFor(m.id)}
                    muted
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-cover"
                  />
                  <Play className="absolute inset-0 m-auto h-4 w-4 fill-white text-white" />
                </>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={urlFor(m.id)}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Header action. White-on-dark, because the viewer is always dark. */
function ViewerButton({
  label,
  children,
  onClick,
  disabled,
  asChild,
}: {
  label: string
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  asChild?: boolean
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      asChild={asChild}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="shrink-0 text-white hover:bg-white/15 hover:text-white disabled:opacity-30"
    >
      {children}
    </Button>
  )
}

function ArrowButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous" : "Next"}
      className={cn(
        "absolute top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25",
        side === "left" ? "left-3" : "right-3",
      )}
    >
      <Icon className="h-5 w-5" />
    </button>
  )
}
