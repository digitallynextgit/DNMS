"use client"

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { AlertTriangle, Download, FileArchive, ImageIcon, RotateCcw, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { SegmentedControl } from "@/components/shared/segmented-control"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  baseName,
  canvasToBlob,
  fileMatches,
  formatBytes,
  loadImage,
  saveBlob,
  zipBlobs,
} from "../lib/files"
import {
  CUSTOM_MAX,
  CUSTOM_MIN,
  MAX_ZOOM,
  MIN_ZOOM,
  SOCIAL_NETWORKS,
  aspectLabel,
  containRect,
  coverRect,
  cropRect,
  enlargement,
  getPreset,
  moveCrop,
  parseSide,
  presetsFor,
  rectCentre,
  slugify,
  socialFileName,
  type Centre,
  type Rect,
  type SocialNetwork,
} from "../lib/social-sizes"
import { FileDrop } from "./file-drop"
import { PrivacyNote, ToolPage } from "./tool-page"

const ACCEPT = ["image/jpeg", "image/png", "image/webp", ".jpg", ".jpeg", ".png", ".webp"]
const MAX_BYTES = 30 * 1024 * 1024
/** Long side of the copy used for on-screen previews - keeps dragging smooth on big photos. */
const SCREEN_COPY_PX = 1600
/** Largest preview on the result card, CSS px. */
const PREVIEW_MAX_W = 312
const PREVIEW_MAX_H = 360
/** Tallest the crop editor gets, in rem. */
const EDITOR_MAX_REM = 28

type Mode = "crop" | "fit"
type FitBackground = "colour" | "blur"
type Format = "jpeg" | "png" | "webp"
type NetworkChoice = SocialNetwork | "custom"

const FORMATS: { value: Format; label: string; hint: string; ext: string; mime: string }[] = [
  { value: "jpeg", label: "JPG", hint: "works everywhere", ext: "jpg", mime: "image/jpeg" },
  { value: "png", label: "PNG", hint: "sharpest, larger file", ext: "png", mime: "image/png" },
  { value: "webp", label: "WebP", hint: "small, for websites", ext: "webp", mime: "image/webp" },
]

interface Drawable {
  el: CanvasImageSource
  width: number
  height: number
}

interface Source {
  name: string
  bytes: number
  full: Drawable
  screen: Drawable
}

interface Target {
  id: string
  network: NetworkChoice
  networkTitle: string
  label: string
  width: number
  height: number
  note?: string
  safe?: { width: number; height: number }
}

interface Look {
  mode: Mode
  zoom: number
  centre: Centre
  fitBackground: FitBackground
  background: string
  format: Format
}

export function SocialImageResizer() {
  const [source, setSource] = useState<Source | null>(null)
  const [opening, setOpening] = useState(false)
  const [network, setNetwork] = useState<NetworkChoice>("instagram")
  const [presetId, setPresetId] = useState("instagram-post")
  const [customW, setCustomW] = useState("1200")
  const [customH, setCustomH] = useState("800")
  const [mode, setMode] = useState<Mode>("crop")
  const [zoom, setZoom] = useState(1)
  const [centre, setCentre] = useState<Centre>({ x: 0.5, y: 0.5 })
  const [fitBackground, setFitBackground] = useState<FitBackground>("blur")
  const [background, setBackground] = useState("#ffffff")
  const [format, setFormat] = useState<Format>("jpeg")
  const [quality, setQuality] = useState(0.9)
  const [busy, setBusy] = useState<"one" | "zip" | null>(null)
  const changeInput = useRef<HTMLInputElement>(null)

  const fmt = FORMATS.find((f) => f.value === format) ?? FORMATS[0]!
  const presets = network === "custom" ? [] : presetsFor(network)

  const target = useMemo<Target | null>(() => {
    if (network === "custom") {
      const w = parseSide(customW)
      const h = parseSide(customH)
      if (!w || !h) return null
      return {
        id: "custom",
        network,
        networkTitle: "Custom size",
        label: `${w} x ${h}`,
        width: w,
        height: h,
      }
    }
    const p = getPreset(presetId) ?? presetsFor(network)[0]
    if (!p) return null
    return {
      id: p.id,
      network,
      networkTitle: SOCIAL_NETWORKS.find((n) => n.id === p.network)?.title ?? "",
      label: p.label,
      width: p.width,
      height: p.height,
      note: p.note,
      safe: p.safe,
    }
  }, [network, presetId, customW, customH])

  const look = useMemo<Look>(
    () => ({ mode, zoom, centre, fitBackground, background, format }),
    [mode, zoom, centre, fitBackground, background, format],
  )

  const soft =
    source && target
      ? enlargement(
          mode,
          source.full.width,
          source.full.height,
          target.width,
          target.height,
          zoom,
        ) > 1.05
      : false

  async function openFile(file: File | undefined) {
    if (!file) return
    if (!fileMatches(file, ACCEPT)) {
      toast.error("Pick a JPG, PNG or WebP image")
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error(`That image is over ${formatBytes(MAX_BYTES)} - pick a smaller one`)
      return
    }
    setOpening(true)
    try {
      const img = await loadImage(file)
      if (!img.naturalWidth || !img.naturalHeight) throw new Error("empty")
      const full: Drawable = { el: img, width: img.naturalWidth, height: img.naturalHeight }
      setSource({ name: file.name, bytes: file.size, full, screen: screenCopy(full) })
      setZoom(1)
      setCentre({ x: 0.5, y: 0.5 })
    } catch {
      toast.error("Couldn't open that image - try another JPG, PNG or WebP")
    } finally {
      setOpening(false)
    }
  }

  function chooseNetwork(n: NetworkChoice) {
    setNetwork(n)
    if (n !== "custom") setPresetId(presetsFor(n)[0]?.id ?? "")
  }

  function resetCrop() {
    setZoom(1)
    setCentre({ x: 0.5, y: 0.5 })
  }

  async function render(t: Target): Promise<Blob> {
    if (!source) throw new Error("Add an image first")
    const canvas = document.createElement("canvas")
    canvas.width = t.width
    canvas.height = t.height
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Your browser couldn't draw the image")
    drawOutput(ctx, source, look, t, t.width, t.height, true)
    return canvasToBlob(canvas, fmt.mime, format === "png" ? undefined : quality)
  }

  async function downloadOne() {
    if (!source || !target) return
    setBusy("one")
    try {
      const blob = await render(target)
      saveBlob(blob, socialFileName(source.name, target.id, target.width, target.height, fmt.ext))
      toast.success(`Saved - ${formatBytes(blob.size)}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't make the image")
    } finally {
      setBusy(null)
    }
  }

  async function downloadAll() {
    if (!source || network === "custom") return
    setBusy("zip")
    try {
      const files: { name: string; blob: Blob }[] = []
      for (const p of presetsFor(network)) {
        const t: Target = { ...p, network, networkTitle: "" }
        files.push({
          name: socialFileName(source.name, p.id, p.width, p.height, fmt.ext),
          blob: await render(t),
        })
      }
      const zip = await zipBlobs(files)
      saveBlob(zip, `${slugify(baseName(source.name)) || "image"}-${network}-sizes.zip`)
      toast.success(`${files.length} sizes saved as one ZIP`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't make the images")
    } finally {
      setBusy(null)
    }
  }

  const networkTitle =
    network === "custom" ? "Custom size" : SOCIAL_NETWORKS.find((n) => n.id === network)?.title

  return (
    <ToolPage slug="social-image-resizer">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardContent className="space-y-6 p-5">
            <div className="space-y-2">
              <Label>Your image</Label>
              {source ? (
                <div className="flex items-center gap-3 rounded-sm border p-3">
                  <ImageIcon className="text-muted-foreground h-5 w-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{source.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {source.full.width} x {source.full.height} px · {formatBytes(source.bytes)}
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => changeInput.current?.click()}>
                    Change
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove image"
                    title="Remove image"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setSource(null)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <input
                    ref={changeInput}
                    type="file"
                    accept={ACCEPT.join(",")}
                    className="hidden"
                    onChange={(e) => {
                      void openFile(e.target.files?.[0])
                      e.target.value = ""
                    }}
                  />
                </div>
              ) : (
                <FileDrop
                  accept={ACCEPT}
                  maxBytes={MAX_BYTES}
                  allowPaste
                  onFiles={(files) => void openFile(files[0])}
                  label={
                    opening ? "Opening your image..." : "Drop an image here or click to choose"
                  }
                  hint={`JPG, PNG or WebP - up to ${formatBytes(MAX_BYTES)}`}
                />
              )}
            </div>

            <div className="space-y-3">
              <Label id="sr-network">Where will you post it?</Label>
              <div role="group" aria-labelledby="sr-network" className="flex flex-wrap gap-2">
                {[...SOCIAL_NETWORKS, { id: "custom" as const, title: "Custom" }].map((n) => (
                  <Button
                    key={n.id}
                    variant={network === n.id ? "default" : "outline"}
                    aria-pressed={network === n.id}
                    onClick={() => chooseNetwork(n.id)}
                  >
                    {n.title}
                  </Button>
                ))}
              </div>

              {network === "custom" ? (
                <CustomSize
                  width={customW}
                  height={customH}
                  onWidth={setCustomW}
                  onHeight={setCustomH}
                />
              ) : (
                <div
                  role="group"
                  aria-label={`${networkTitle} sizes`}
                  className="grid gap-2 sm:grid-cols-2"
                >
                  {presets.map((p) => {
                    const active = target?.id === p.id
                    return (
                      <button
                        key={p.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setPresetId(p.id)}
                        className={cn(
                          "hover:bg-accent focus-visible:ring-ring flex items-center gap-3 rounded-sm border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
                          active && "border-primary bg-primary/5 ring-primary ring-1",
                        )}
                      >
                        <ShapeGlyph width={p.width} height={p.height} />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{p.label}</span>
                          <span className="text-muted-foreground block text-xs">
                            {p.width} x {p.height} px · {aspectLabel(p.width, p.height)}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="mb-0">How should it fit?</Label>
                <SegmentedControl
                  aria-label="How the image fits the size"
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: "crop", label: "Crop to fill" },
                    { value: "fit", label: "Fit whole image" },
                  ]}
                />
              </div>
              <p className="text-muted-foreground text-xs">
                {mode === "crop"
                  ? "Fills the whole size and cuts off what doesn't fit. Drag the frame to choose the part you keep."
                  : "Keeps the whole image and fills the space around it with a colour or a blurred copy."}
              </p>

              {mode === "crop" ? (
                source && target ? (
                  <div className="space-y-3">
                    <CropEditor
                      source={source}
                      target={target}
                      zoom={zoom}
                      centre={centre}
                      onCentre={setCentre}
                      onZoom={setZoom}
                    />
                    <div className="flex items-end gap-3">
                      <div className="flex-1 space-y-2">
                        <Label htmlFor="sr-zoom">Zoom: {Math.round(zoom * 100)}%</Label>
                        <input
                          id="sr-zoom"
                          type="range"
                          min={MIN_ZOOM}
                          max={MAX_ZOOM}
                          step={0.01}
                          value={zoom}
                          onChange={(e) => setZoom(Number(e.target.value))}
                          className="accent-primary w-full"
                        />
                      </div>
                      <Button
                        variant="outline"
                        className="gap-1.5"
                        disabled={zoom === 1 && centre.x === 0.5 && centre.y === 0.5}
                        onClick={resetCrop}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Reset
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground rounded-sm border border-dashed p-4 text-center text-xs">
                    {source
                      ? "Enter a width and height to see the crop frame."
                      : "Add an image to choose the part you keep."}
                  </p>
                )
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Fill the space with</Label>
                    <SegmentedControl
                      aria-label="Fill the space with"
                      value={fitBackground}
                      onChange={setFitBackground}
                      options={[
                        { value: "blur", label: "Blurred image" },
                        { value: "colour", label: "A colour" },
                      ]}
                    />
                  </div>
                  {fitBackground === "colour" && (
                    <div className="space-y-2">
                      <Label htmlFor="sr-bg">Background colour</Label>
                      <div className="border-input flex h-9 items-center gap-2 rounded-sm border px-2">
                        <input
                          id="sr-bg"
                          type="color"
                          value={background}
                          onChange={(e) => setBackground(e.target.value)}
                          className="h-6 w-8 cursor-pointer rounded-sm border-0 bg-transparent p-0"
                        />
                        <span className="text-muted-foreground font-mono text-xs uppercase">
                          {background}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sr-format">Save as</Label>
                <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
                  <SelectTrigger id="sr-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMATS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label} - {f.hint}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {format !== "png" && (
                <div className="space-y-2">
                  <Label htmlFor="sr-quality">Quality: {Math.round(quality * 100)}%</Label>
                  <input
                    id="sr-quality"
                    type="range"
                    min={0.5}
                    max={1}
                    step={0.01}
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                    className="accent-primary w-full sm:mt-2"
                  />
                </div>
              )}
            </div>
            <p className="text-muted-foreground -mt-3 text-xs">
              {format === "png"
                ? "PNG keeps every detail, so the file is bigger. Best for text, logos and graphics."
                : "Lower quality makes a smaller file. 85-90% looks the same to most eyes."}
            </p>
          </CardContent>
        </Card>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-baseline justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-medium">
                  {target ? `${target.networkTitle} · ${target.label}` : "Custom size"}
                </p>
                {target && (
                  <p className="text-muted-foreground shrink-0 text-xs">
                    {target.width} x {target.height} px
                  </p>
                )}
              </div>

              <OutputPreview source={source} target={target} look={look} opening={opening} />

              {target?.safe && source && (
                <p className="text-muted-foreground text-xs">
                  Dashed line: the part every screen shows. It isn&apos;t in your download.
                </p>
              )}
              {target?.note && <p className="text-muted-foreground text-xs">{target.note}</p>}
              {soft && target && (
                <p className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Your image is smaller than {target.width} x {target.height}, so it gets stretched
                  and may look a little soft.
                </p>
              )}

              <Button
                className="w-full gap-1.5"
                disabled={!source || !target || busy !== null}
                loading={busy === "one"}
                onClick={downloadOne}
              >
                {busy !== "one" && <Download className="h-4 w-4" />}
                Download {fmt.label}
              </Button>
              {presets.length > 1 && (
                <Button
                  variant="outline"
                  className="w-full gap-1.5"
                  disabled={!source || busy !== null}
                  loading={busy === "zip"}
                  onClick={downloadAll}
                >
                  {busy !== "zip" && <FileArchive className="h-4 w-4" />}
                  All {networkTitle} sizes (ZIP)
                </Button>
              )}
              <PrivacyNote />
            </CardContent>
          </Card>
        </div>
      </div>
    </ToolPage>
  )
}

function ShapeGlyph({ width, height }: { width: number; height: number }) {
  const a = width / height
  const max = 28
  const w = Math.max(4, Math.round(a >= 1 ? max : max * a))
  const h = Math.max(4, Math.round(a >= 1 ? max / a : max))
  return (
    <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center">
      <span
        className="border-muted-foreground/60 bg-muted block rounded-[2px] border"
        style={{ width: w, height: h }}
      />
    </span>
  )
}

function CustomSize({
  width,
  height,
  onWidth,
  onHeight,
}: {
  width: string
  height: string
  onWidth: (v: string) => void
  onHeight: (v: string) => void
}) {
  const wBad = parseSide(width) === null
  const hBad = parseSide(height) === null
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
        <div className="space-y-2">
          <Label htmlFor="sr-width">Width (px)</Label>
          <Input
            id="sr-width"
            inputMode="numeric"
            value={width}
            aria-invalid={wBad}
            onChange={(e) => onWidth(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sr-height">Height (px)</Label>
          <Input
            id="sr-height"
            inputMode="numeric"
            value={height}
            aria-invalid={hBad}
            onChange={(e) => onHeight(e.target.value)}
          />
        </div>
      </div>
      <p className={cn("text-xs", wBad || hBad ? "text-destructive" : "text-muted-foreground")}>
        {wBad || hBad
          ? `Use whole numbers from ${CUSTOM_MIN} to ${CUSTOM_MAX} px.`
          : `Shape ${aspectLabel(Number(width), Number(height))}.`}
      </p>
    </div>
  )
}

/** Drag to move the frame; when focused, arrow keys nudge it (Shift for bigger steps) and + / - zoom. */
function CropEditor({
  source,
  target,
  zoom,
  centre,
  onCentre,
  onZoom,
}: {
  source: Source
  target: Target
  zoom: number
  centre: Centre
  onCentre: (c: Centre) => void
  onZoom: (z: number) => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const area = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: number; x: number; y: number; from: Centre; scale: number } | null>(
    null,
  )
  const hintId = useId()
  const { width: iw, height: ih } = source.screen
  const r = cropRect(iw, ih, target.width, target.height, zoom, centre)

  useEffect(() => {
    const c = canvas.current
    if (!c) return
    c.width = iw
    c.height = ih
    const ctx = c.getContext("2d")
    if (!ctx) return
    ctx.drawImage(source.screen.el, 0, 0, iw, ih)
  }, [source, iw, ih])

  function move(from: Centre, dx: number, dy: number) {
    onCentre(moveCrop(iw, ih, target.width, target.height, zoom, from, dx, dy))
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    const el = area.current
    if (!el || e.button !== 0) return
    const box = el.getBoundingClientRect()
    drag.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      from: rectCentre(r, iw, ih),
      scale: iw / box.width,
    }
    el.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    move(d.from, (e.clientX - d.x) * d.scale, (e.clientY - d.y) * d.scale)
  }

  function endDrag(e: ReactPointerEvent<HTMLDivElement>) {
    if (drag.current?.id === e.pointerId) drag.current = null
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 0.25 : 0.05
    const now = rectCentre(r, iw, ih)
    switch (e.key) {
      case "ArrowLeft":
        move(now, -r.w * step, 0)
        break
      case "ArrowRight":
        move(now, r.w * step, 0)
        break
      case "ArrowUp":
        move(now, 0, -r.h * step)
        break
      case "ArrowDown":
        move(now, 0, r.h * step)
        break
      case "+":
      case "=":
        onZoom(Math.min(MAX_ZOOM, Math.round((zoom + 0.1) * 100) / 100))
        break
      case "-":
      case "_":
        onZoom(Math.max(MIN_ZOOM, Math.round((zoom - 0.1) * 100) / 100))
        break
      default:
        return
    }
    e.preventDefault()
  }

  const pct = (n: number, of: number) => `${(n / of) * 100}%`

  return (
    <div className="space-y-2">
      <div
        ref={area}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="bg-muted relative mx-auto cursor-move touch-none overflow-hidden rounded-sm select-none"
        style={{
          aspectRatio: `${iw} / ${ih}`,
          width: `min(100%, ${((EDITOR_MAX_REM * iw) / ih).toFixed(3)}rem)`,
        }}
      >
        <canvas ref={canvas} aria-hidden="true" className="absolute inset-0 h-full w-full" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <span className="absolute inset-x-0 top-0 bg-black/55" style={{ height: pct(r.y, ih) }} />
          <span
            className="absolute inset-x-0 bottom-0 bg-black/55"
            style={{ top: pct(r.y + r.h, ih) }}
          />
          <span
            className="absolute left-0 bg-black/55"
            style={{ top: pct(r.y, ih), height: pct(r.h, ih), width: pct(r.x, iw) }}
          />
          <span
            className="absolute right-0 bg-black/55"
            style={{ top: pct(r.y, ih), height: pct(r.h, ih), left: pct(r.x + r.w, iw) }}
          />
        </div>
        <div
          tabIndex={0}
          role="group"
          aria-label="Crop frame"
          aria-describedby={hintId}
          onKeyDown={onKeyDown}
          className="absolute border-2 border-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
          style={{
            left: pct(r.x, iw),
            top: pct(r.y, ih),
            width: pct(r.w, iw),
            height: pct(r.h, ih),
          }}
        >
          <span className="pointer-events-none absolute inset-y-0 left-1/3 w-px bg-white/40" />
          <span className="pointer-events-none absolute inset-y-0 left-2/3 w-px bg-white/40" />
          <span className="pointer-events-none absolute inset-x-0 top-1/3 h-px bg-white/40" />
          <span className="pointer-events-none absolute inset-x-0 top-2/3 h-px bg-white/40" />
        </div>
      </div>
      <p id={hintId} className="text-muted-foreground text-xs">
        Drag to move the frame. Or click the frame and use the arrow keys (hold Shift for bigger
        steps) and + / - to zoom.
      </p>
    </div>
  )
}

function OutputPreview({
  source,
  target,
  look,
  opening,
}: {
  source: Source | null
  target: Target | null
  look: Look
  opening: boolean
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const ow = target?.width ?? 1
  const oh = target?.height ?? 1
  const s = Math.min(PREVIEW_MAX_W / ow, PREVIEW_MAX_H / oh)
  const boxW = Math.round(ow * s)
  const boxH = Math.round(oh * s)

  useEffect(() => {
    const c = canvas.current
    if (!c || !source || !target) return
    const dpr = window.devicePixelRatio || 1
    c.width = Math.max(1, Math.round(boxW * dpr))
    c.height = Math.max(1, Math.round(boxH * dpr))
    const ctx = c.getContext("2d")
    if (!ctx) return
    drawOutput(ctx, source, look, target, c.width, c.height, false)
  }, [source, target, look, boxW, boxH])

  if (!target) {
    return (
      <div className="text-muted-foreground flex h-40 flex-col items-center justify-center gap-2 rounded-sm border border-dashed px-6 text-center text-xs">
        <ImageIcon className="h-6 w-6" />
        Enter a width and height to see your image here
      </div>
    )
  }

  const safe = target.safe
  return (
    <div
      className="bg-muted/40 relative mx-auto overflow-hidden rounded-sm border"
      style={{ width: boxW, maxWidth: "100%", aspectRatio: `${ow} / ${oh}` }}
    >
      {source ? (
        <>
          <canvas
            ref={canvas}
            role="img"
            aria-label={`Preview of your ${target.width} x ${target.height} image`}
            className="block h-full w-full"
          />
          {safe && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute border border-dashed border-white mix-blend-difference"
              style={{
                left: `${((ow - safe.width) / 2 / ow) * 100}%`,
                top: `${((oh - safe.height) / 2 / oh) * 100}%`,
                width: `${(safe.width / ow) * 100}%`,
                height: `${(safe.height / oh) * 100}%`,
              }}
            />
          )}
        </>
      ) : (
        <div className="text-muted-foreground absolute inset-0 flex flex-col items-center justify-center gap-1 p-2 text-center text-xs">
          <ImageIcon className={cn("h-6 w-6", boxH < 80 && "hidden")} />
          <span>{opening ? "Opening..." : `${target.width} x ${target.height}`}</span>
        </div>
      )}
    </div>
  )
}

function screenCopy(full: Drawable): Drawable {
  const k = Math.min(1, SCREEN_COPY_PX / Math.max(full.width, full.height))
  if (k === 1) return full
  const c = document.createElement("canvas")
  c.width = Math.max(1, Math.round(full.width * k))
  c.height = Math.max(1, Math.round(full.height * k))
  const ctx = c.getContext("2d")
  if (!ctx) return full
  drawScaled(
    ctx,
    full.el,
    { x: 0, y: 0, w: full.width, h: full.height },
    { x: 0, y: 0, w: c.width, h: c.height },
    true,
  )
  return { el: c, width: c.width, height: c.height }
}

/** With `best`, big shrinks go in halving steps - one big jump makes fine detail shimmer. */
function drawScaled(
  ctx: CanvasRenderingContext2D,
  el: CanvasImageSource,
  s: Rect,
  d: Rect,
  best: boolean,
) {
  let source = el
  let r = s
  while (best && r.w / 2 >= d.w && r.h / 2 >= d.h) {
    const c = document.createElement("canvas")
    c.width = Math.max(1, Math.round(r.w / 2))
    c.height = Math.max(1, Math.round(r.h / 2))
    const cx = c.getContext("2d")
    if (!cx) break
    cx.imageSmoothingEnabled = true
    cx.imageSmoothingQuality = "high"
    cx.drawImage(source, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height)
    source = c
    r = { x: 0, y: 0, w: c.width, h: c.height }
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(source, r.x, r.y, r.w, r.h, d.x, d.y, d.w, d.h)
}

function drawBlurred(ctx: CanvasRenderingContext2D, src: Drawable, cw: number, ch: number) {
  // Shrink-and-stretch does most of the blur, fast in every browser; the canvas filter smooths the rest.
  const tiny = document.createElement("canvas")
  const k = 64 / Math.max(cw, ch)
  tiny.width = Math.max(1, Math.round(cw * k))
  tiny.height = Math.max(1, Math.round(ch * k))
  const t = tiny.getContext("2d")
  if (!t) return
  t.imageSmoothingEnabled = true
  t.imageSmoothingQuality = "high"
  const c = coverRect(src.width, src.height, tiny.width, tiny.height)
  t.drawImage(src.el, c.x, c.y, c.w, c.h)

  const blur = Math.max(cw, ch) / 80
  // Drawn a little past the edges so the blur doesn't fade them out.
  const pad = blur * 3
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  if ("filter" in ctx) ctx.filter = `blur(${blur}px)`
  ctx.drawImage(tiny, -pad, -pad, cw + pad * 2, ch + pad * 2)
  ctx.restore()
  // A light shade so the sharp image in front stands out.
  ctx.fillStyle = "rgba(0, 0, 0, 0.12)"
  ctx.fillRect(0, 0, cw, ch)
}

/** `best` uses the full-size photo and the slower, sharper shrink - for downloads. */
function drawOutput(
  ctx: CanvasRenderingContext2D,
  source: Source,
  look: Look,
  out: { width: number; height: number },
  cw: number,
  ch: number,
  best: boolean,
) {
  const src = best ? source.full : source.screen
  ctx.clearRect(0, 0, cw, ch)
  // JPG has no see-through: give transparent PNGs white behind them, not black.
  if (look.format === "jpeg") {
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, cw, ch)
  }
  if (look.mode === "crop") {
    const r = cropRect(src.width, src.height, out.width, out.height, look.zoom, look.centre)
    drawScaled(ctx, src.el, r, { x: 0, y: 0, w: cw, h: ch }, best)
    return
  }
  if (look.fitBackground === "blur") {
    drawBlurred(ctx, source.screen, cw, ch)
  } else {
    ctx.fillStyle = look.background
    ctx.fillRect(0, 0, cw, ch)
  }
  drawScaled(
    ctx,
    src.el,
    { x: 0, y: 0, w: src.width, h: src.height },
    containRect(src.width, src.height, cw, ch),
    best,
  )
}
