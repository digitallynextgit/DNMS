"use client"

import {
  useEffect,
  useId,
  useRef,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { ChevronsLeftRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { dividerForKey, drawCutout, type CutoutLook, type Mask } from "../../lib/background"
import type { DecodedImage } from "../../lib/images"

/** Light-grey checks behind see-through parts - the usual "transparent" pattern. */
export const CHECKERBOARD: CSSProperties = {
  backgroundColor: "#ffffff",
  backgroundImage: "conic-gradient(#e2e5e9 25%, transparent 0 50%, #e2e5e9 0 75%, transparent 0)",
  backgroundSize: "16px 16px",
}

/** In compare mode the original is left of a draggable divider (arrow keys work too), the result right. */
export function CompareView({
  photo,
  mask,
  look,
  compare,
  divider,
  onDivider,
  dimmed = false,
  maxHeightRem = 30,
}: {
  photo: DecodedImage
  mask: Mask | null
  look: CutoutLook
  compare: boolean
  /** Where the divider is, 0-100 (percent from the left). */
  divider: number
  onDivider: (value: number) => void
  dimmed?: boolean
  maxHeightRem?: number
}) {
  const before = useRef<HTMLCanvasElement>(null)
  const after = useRef<HTMLCanvasElement>(null)
  const area = useRef<HTMLDivElement>(null)
  const dragging = useRef<number | null>(null)
  const hintId = useId()
  const { width: w, height: h } = photo

  useEffect(() => {
    const c = before.current
    if (!c) return
    c.width = w
    c.height = h
    const ctx = c.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(photo.image, 0, 0, w, h)
  }, [photo, w, h])

  useEffect(() => {
    const c = after.current
    if (!c || !mask) return
    c.width = w
    c.height = h
    const ctx = c.getContext("2d")
    if (!ctx) return
    drawCutout(ctx, photo, mask, w, h, look)
  }, [photo, mask, look, w, h])

  const showResult = mask !== null
  const sliding = showResult && compare

  function moveTo(clientX: number) {
    const el = area.current
    if (!el) return
    const box = el.getBoundingClientRect()
    if (box.width <= 0) return
    const pct = ((clientX - box.left) / box.width) * 100
    onDivider(Math.round(Math.min(100, Math.max(0, pct)) * 10) / 10)
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!sliding || e.button !== 0) return
    dragging.current = e.pointerId
    e.currentTarget.setPointerCapture(e.pointerId)
    moveTo(e.clientX)
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (dragging.current === e.pointerId) moveTo(e.clientX)
  }

  function endDrag(e: ReactPointerEvent<HTMLDivElement>) {
    if (dragging.current === e.pointerId) dragging.current = null
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    const next = dividerForKey(e.key, divider, e.shiftKey)
    if (next === null) return
    e.preventDefault()
    onDivider(next)
  }

  return (
    <div className="space-y-2">
      <div
        ref={area}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={cn(
          "relative mx-auto overflow-hidden rounded-sm border select-none",
          !showResult && "bg-muted/40",
          sliding && "cursor-ew-resize touch-pan-y",
        )}
        style={{
          // The checks show what's see-through - only once there's a result.
          ...(showResult ? CHECKERBOARD : {}),
          aspectRatio: `${w} / ${h}`,
          width: `min(100%, ${((maxHeightRem * w) / h).toFixed(3)}rem)`,
        }}
      >
        <canvas
          ref={after}
          role="img"
          aria-label="Your photo with the background removed"
          className={cn("absolute inset-0 h-full w-full", !showResult && "invisible")}
        />
        <canvas
          ref={before}
          role="img"
          aria-label="Your original photo"
          className={cn(
            "absolute inset-0 h-full w-full transition-opacity",
            showResult && !compare && "invisible",
            dimmed && "opacity-40",
          )}
          style={sliding ? { clipPath: `inset(0 ${100 - divider}% 0 0)` } : undefined}
        />

        {sliding && (
          <>
            <span className="pointer-events-none absolute top-2 left-2 rounded-sm bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white">
              Before
            </span>
            <span className="pointer-events-none absolute top-2 right-2 rounded-sm bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white">
              After
            </span>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.25)]"
              style={{ left: `${divider}%` }}
            />
            <div
              role="slider"
              tabIndex={0}
              aria-label="Before and after divider"
              aria-describedby={hintId}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(divider)}
              aria-valuetext={`${Math.round(divider)}% original`}
              onKeyDown={onKeyDown}
              className="absolute top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-black/20 bg-white text-neutral-700 shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
              style={{ left: `${divider}%` }}
            >
              <ChevronsLeftRight className="h-4 w-4" aria-hidden="true" />
            </div>
          </>
        )}
      </div>
      {sliding && (
        <p id={hintId} className="text-muted-foreground text-center text-xs">
          Drag the line to compare. Or click the round handle and use the arrow keys.
        </p>
      )}
    </div>
  )
}
