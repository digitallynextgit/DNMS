"use client"

/**
 * Crop, rotate, filter, draw and caption an image before sending it.
 *
 * Canvas rather than a library: the editors on npm ship a few hundred kilobytes
 * of scene graph to do what four ctx calls do, and this loads on the send screen
 * of a chat - a place people reach constantly.
 *
 * ── The one design decision everything else follows ─────────────────────────
 * EVERY operation commits to a new canvas pushed onto a history stack. Crop,
 * rotate, a filter, a finished pen stroke, a placed label: each flattens what is
 * on screen into fresh pixels and becomes the new base.
 *
 * The alternative - keeping crop, rotation, filters and strokes as separate
 * layers composited at render time - means every stroke has to be re-projected
 * through whatever crop and rotation arrive afterwards, and a stroke drawn
 * before a 90° turn lands somewhere else entirely. Committing sidesteps that
 * class of bug completely: coordinates are only ever in the CURRENT canvas's
 * space, because there is only ever one canvas.
 *
 * The cost is that filters are not re-adjustable once applied, and Undo is the
 * way back rather than a slider. For a chat attachment that is the right trade -
 * and Undo is one press, which a layered model would have made harder, not
 * easier.
 */

import * as React from "react"
import {
  X,
  Check,
  Crop as CropIcon,
  RotateCw,
  Wand2,
  Pencil,
  Type as TypeIcon,
  Undo2,
  Loader2,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Tool = "crop" | "filter" | "draw" | "text" | null

interface Point {
  x: number
  y: number
}
interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** ctx.filter strings. Kept modest: these are photos of a whiteboard or a bug,
 *  not a mood board, so the set is "make it readable" rather than Instagram. */
const FILTERS: { key: string; label: string; css: string }[] = [
  { key: "none", label: "Original", css: "none" },
  { key: "mono", label: "Mono", css: "grayscale(1)" },
  { key: "bright", label: "Bright", css: "brightness(1.18) saturate(1.05)" },
  { key: "contrast", label: "Punch", css: "contrast(1.3) saturate(1.15)" },
  { key: "warm", label: "Warm", css: "sepia(0.35) saturate(1.25)" },
  { key: "cool", label: "Cool", css: "hue-rotate(-15deg) saturate(1.15)" },
  { key: "doc", label: "Document", css: "grayscale(1) contrast(1.7) brightness(1.12)" },
]

/** Ink the user picks. Literal hexes on purpose: these are baked into the
 *  image, so they must NOT follow the theme - a note drawn in red has to stay
 *  red for whoever opens it, whatever palette they are running. */
const PEN_COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ffffff", "#111111"]
const PEN_SIZES = [3, 6, 12]

/**
 * How many steps back Undo can go.
 *
 * Each entry is a whole canvas - width × height × 4 bytes - so a 12 MP phone
 * photo costs ~48 MB per step. Unbounded, twenty pen strokes would be a gigabyte
 * of retained bitmaps and a dead tab. Past the cap the OLDEST edit is dropped,
 * never index 0: the untouched original stays reachable so "undo everything"
 * always has somewhere to land.
 */
const MAX_HISTORY = 12

/** A blank canvas of the given size, ready to draw into. */
function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas")
  c.width = w
  c.height = h
  return c
}

/**
 * The theme's primary, as something canvas can stroke with.
 *
 * A canvas takes a colour string, not a CSS variable, so the token has to be
 * resolved at draw time. `--primary` is stored as bare HSL channels ("0 0% 93%")
 * for Tailwind's `hsl(var(--primary) / <alpha>)` pattern, hence wrapping rather
 * than using the value directly. Falls back to white, which reads on any photo.
 */
function primaryColor(): string {
  if (typeof window === "undefined") return "#ffffff"
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim()
  return raw ? `hsl(${raw})` : "#ffffff"
}

function cloneCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = makeCanvas(src.width, src.height)
  c.getContext("2d")!.drawImage(src, 0, 0)
  return c
}

export function ImageEditor({
  file,
  onCancel,
  onSave,
}: {
  file: File
  onCancel: () => void
  /** The edited image, as a new File carrying the original's name. */
  onSave: (edited: File) => void
}) {
  const viewRef = React.useRef<HTMLCanvasElement>(null)
  // The committed pixels, newest last. history[0] is the untouched original, so
  // Undo can always walk all the way back without keeping a separate copy.
  const [history, setHistory] = React.useState<HTMLCanvasElement[]>([])
  const [tool, setTool] = React.useState<Tool>(null)
  const [saving, setSaving] = React.useState(false)

  // Pen
  const [penColor, setPenColor] = React.useState(PEN_COLORS[0]!)
  const [penSize, setPenSize] = React.useState(PEN_SIZES[1]!)
  const strokeRef = React.useRef<Point[] | null>(null)

  // Crop
  const [crop, setCrop] = React.useState<Rect | null>(null)
  const cropStart = React.useRef<Point | null>(null)

  // Text
  const [label, setLabel] = React.useState("")

  const base = history[history.length - 1] ?? null

  // ── Load ──────────────────────────────────────────────────────────────────
  React.useEffect(() => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const c = makeCanvas(img.naturalWidth, img.naturalHeight)
      c.getContext("2d")!.drawImage(img, 0, 0)
      setHistory([c])
      URL.revokeObjectURL(url)
    }
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  /** Paint the committed canvas, plus whatever is mid-gesture, to the screen. */
  const paint = React.useCallback(() => {
    const view = viewRef.current
    if (!view || !base) return
    if (view.width !== base.width || view.height !== base.height) {
      view.width = base.width
      view.height = base.height
    }
    const ctx = view.getContext("2d")!
    ctx.clearRect(0, 0, view.width, view.height)
    ctx.drawImage(base, 0, 0)

    // The stroke in progress lives here, not in history - it is not a commit
    // until the pointer lifts.
    const pts = strokeRef.current
    if (pts && pts.length > 1) {
      ctx.strokeStyle = penColor
      ctx.lineWidth = penSize * (base.width / (view.clientWidth || base.width))
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      ctx.beginPath()
      ctx.moveTo(pts[0]!.x, pts[0]!.y)
      for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y)
      ctx.stroke()
    }

    if (crop) {
      // Dim everything outside the selection so the eye reads the keep, not the
      // discard.
      ctx.save()
      ctx.fillStyle = "rgba(0,0,0,0.55)"
      ctx.beginPath()
      ctx.rect(0, 0, view.width, view.height)
      ctx.rect(crop.x, crop.y, crop.w, crop.h)
      ctx.fill("evenodd")
      ctx.strokeStyle = primaryColor()
      ctx.lineWidth = Math.max(2, base.width / 300)
      ctx.strokeRect(crop.x, crop.y, crop.w, crop.h)
      ctx.restore()
    }
  }, [base, crop, penColor, penSize])

  React.useEffect(() => {
    paint()
  }, [paint])

  function commit(next: HTMLCanvasElement) {
    setHistory((h) => {
      const grown = [...h, next]
      // Drop the oldest EDIT (index 1), keeping the original at index 0.
      return grown.length > MAX_HISTORY ? [grown[0]!, ...grown.slice(2)] : grown
    })
  }

  function undo() {
    setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h))
    setCrop(null)
  }

  // ── Pointer → canvas coordinates ──────────────────────────────────────────
  // The canvas is displayed scaled-to-fit, so a client point has to be mapped
  // back through that scale or every stroke lands offset from the cursor.
  function toCanvas(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const view = e.currentTarget
    const r = view.getBoundingClientRect()
    return {
      x: ((e.clientX - r.left) / r.width) * view.width,
      y: ((e.clientY - r.top) / r.height) * view.height,
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!base) return
    const p = toCanvas(e)
    e.currentTarget.setPointerCapture(e.pointerId)
    if (tool === "draw") {
      strokeRef.current = [p]
    } else if (tool === "crop") {
      cropStart.current = p
      setCrop({ x: p.x, y: p.y, w: 0, h: 0 })
    } else if (tool === "text" && label.trim()) {
      placeLabel(p)
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!base) return
    const p = toCanvas(e)
    if (tool === "draw" && strokeRef.current) {
      strokeRef.current.push(p)
      paint()
    } else if (tool === "crop" && cropStart.current) {
      const s = cropStart.current
      setCrop({
        x: Math.min(s.x, p.x),
        y: Math.min(s.y, p.y),
        w: Math.abs(p.x - s.x),
        h: Math.abs(p.y - s.y),
      })
    }
  }

  function onPointerUp() {
    if (tool === "draw" && strokeRef.current && strokeRef.current.length > 1 && base) {
      // Flatten the stroke into a new base. From here on it is just pixels, so
      // a later crop or rotate carries it without any re-projection.
      const next = cloneCanvas(base)
      const view = viewRef.current
      const ctx = next.getContext("2d")!
      ctx.strokeStyle = penColor
      ctx.lineWidth = penSize * (base.width / (view?.clientWidth || base.width))
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      ctx.beginPath()
      const pts = strokeRef.current
      ctx.moveTo(pts[0]!.x, pts[0]!.y)
      for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y)
      ctx.stroke()
      commit(next)
    }
    strokeRef.current = null
    cropStart.current = null
  }

  // ── Operations ────────────────────────────────────────────────────────────
  function applyFilter(css: string) {
    if (!base) return
    const next = makeCanvas(base.width, base.height)
    const ctx = next.getContext("2d")!
    ctx.filter = css
    ctx.drawImage(base, 0, 0)
    commit(next)
  }

  function rotate() {
    if (!base) return
    // Swapped dimensions: a quarter turn makes the height the width.
    const next = makeCanvas(base.height, base.width)
    const ctx = next.getContext("2d")!
    ctx.translate(next.width / 2, next.height / 2)
    ctx.rotate(Math.PI / 2)
    ctx.drawImage(base, -base.width / 2, -base.height / 2)
    commit(next)
    setCrop(null)
  }

  function applyCrop() {
    if (!base || !crop || crop.w < 8 || crop.h < 8) return setCrop(null)
    const next = makeCanvas(Math.round(crop.w), Math.round(crop.h))
    next
      .getContext("2d")!
      .drawImage(base, crop.x, crop.y, crop.w, crop.h, 0, 0, next.width, next.height)
    commit(next)
    setCrop(null)
    setTool(null)
  }

  function placeLabel(at: Point) {
    if (!base || !label.trim()) return
    const next = cloneCanvas(base)
    const ctx = next.getContext("2d")!
    const size = Math.max(18, Math.round(base.width / 22))
    ctx.font = `700 ${size}px system-ui, sans-serif`
    ctx.textBaseline = "top"
    // Outlined, so it stays legible over a light photo and a dark one alike -
    // the single most common reason text-on-image is unreadable.
    ctx.lineWidth = Math.max(2, size / 8)
    ctx.strokeStyle = "rgba(0,0,0,0.75)"
    ctx.strokeText(label, at.x, at.y)
    ctx.fillStyle = penColor
    ctx.fillText(label, at.x, at.y)
    commit(next)
    setLabel("")
    setTool(null)
  }

  function save() {
    if (!base) return
    setSaving(true)
    // PNG in, PNG out - re-encoding a screenshot as JPEG is how crisp text turns
    // into mush. Everything else goes out as JPEG, which is far smaller.
    const png = file.type === "image/png"
    base.toBlob(
      (blob) => {
        setSaving(false)
        if (!blob) return
        onSave(new File([blob], file.name, { type: png ? "image/png" : "image/jpeg" }))
      },
      png ? "image/png" : "image/jpeg",
      0.92,
    )
  }

  const TOOLS: { key: Exclude<Tool, null>; icon: React.ElementType; label: string }[] = [
    { key: "crop", icon: CropIcon, label: "Crop" },
    { key: "filter", icon: Wand2, label: "Filter" },
    { key: "draw", icon: Pencil, label: "Draw" },
    { key: "text", icon: TypeIcon, label: "Text" },
  ]

  return (
    <div className="bg-background absolute inset-0 z-40 flex flex-col">
      {/* Toolbar */}
      <div className="flex h-14 shrink-0 items-center gap-1 border-b px-2">
        <Button variant="ghost" size="icon" aria-label="Cancel editing" onClick={onCancel}>
          <X className="h-5 w-5" />
        </Button>

        <div className="flex flex-1 items-center justify-center gap-1">
          {TOOLS.map((t) => (
            <Button
              key={t.key}
              variant="ghost"
              size="icon"
              title={t.label}
              aria-label={t.label}
              aria-pressed={tool === t.key}
              className={cn(tool === t.key && "bg-muted text-foreground")}
              onClick={() => {
                setTool((cur) => (cur === t.key ? null : t.key))
                setCrop(null)
              }}
            >
              <t.icon className="h-4 w-4" />
            </Button>
          ))}
          <Button variant="ghost" size="icon" title="Rotate" aria-label="Rotate" onClick={rotate}>
            <RotateCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Undo"
            aria-label="Undo"
            disabled={history.length < 2}
            onClick={undo}
          >
            <Undo2 className="h-4 w-4" />
          </Button>
        </div>

        <Button size="sm" className="gap-1.5" disabled={!base || saving} onClick={save}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Done
        </Button>
      </div>

      {/* Canvas */}
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3">
        {!base ? (
          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
        ) : (
          <canvas
            ref={viewRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            className={cn(
              "max-h-full max-w-full rounded-sm object-contain",
              tool === "draw" && "cursor-crosshair",
              tool === "crop" && "cursor-crosshair",
              tool === "text" && label.trim() && "cursor-copy",
              // touch-none: without it a drag on a phone scrolls the pane
              // instead of drawing.
              (tool === "draw" || tool === "crop") && "touch-none",
            )}
          />
        )}
      </div>

      {/* Per-tool options */}
      {tool && (
        <div className="bg-card shrink-0 border-t p-2">
          {tool === "filter" && (
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => applyFilter(f.css)}
                  className="hover:bg-muted shrink-0 rounded-sm border px-3 py-1.5 text-xs transition-colors"
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {(tool === "draw" || tool === "text") && (
            <div className="flex flex-wrap items-center gap-2">
              {PEN_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Colour ${c}`}
                  aria-pressed={penColor === c}
                  onClick={() => setPenColor(c)}
                  style={{ backgroundColor: c }}
                  className={cn(
                    "h-6 w-6 shrink-0 rounded-sm border-2 transition-transform",
                    penColor === c ? "border-foreground scale-110" : "border-border",
                  )}
                />
              ))}

              {tool === "draw" && (
                <div className="ml-1 flex items-center gap-1">
                  {PEN_SIZES.map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      aria-label={`Pen size ${sz}`}
                      aria-pressed={penSize === sz}
                      onClick={() => setPenSize(sz)}
                      className={cn(
                        "hover:bg-muted flex h-7 w-7 items-center justify-center rounded-sm border transition-colors",
                        penSize === sz && "bg-muted",
                      )}
                    >
                      <span
                        className="bg-foreground rounded-full"
                        style={{ width: sz, height: sz }}
                      />
                    </button>
                  ))}
                </div>
              )}

              {tool === "text" && (
                <>
                  <Input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="Type, then tap the image to place it"
                    aria-label="Type, then tap the image to place it"
                    className="h-8 min-w-0 flex-1 text-sm"
                  />
                </>
              )}
            </div>
          )}

          {tool === "crop" && (
            <div className="flex items-center gap-2">
              <p className="text-muted-foreground flex-1 text-xs">
                Drag on the image to choose what to keep.
              </p>
              <Button variant="outline" size="sm" onClick={() => setCrop(null)}>
                Reset
              </Button>
              <Button size="sm" disabled={!crop || crop.w < 8} onClick={applyCrop}>
                Apply crop
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
