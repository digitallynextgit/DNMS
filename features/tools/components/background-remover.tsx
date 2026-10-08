"use client"

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import {
  AlertTriangle,
  CloudDownload,
  Copy,
  Download,
  Eraser,
  ImageIcon,
  Info,
  RotateCcw,
  Smartphone,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { SegmentedControl } from "@/components/shared/segmented-control"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { CHECKERBOARD, CompareView } from "./background/compare-view"
import { FileDrop } from "./file-drop"
import { PrivacyNote, ToolPage } from "./tool-page"
import { fileMatches, formatBytes, saveBlob } from "../lib/files"
import { decodeHeic, decodeRaster, errorText, imageKind, type DecodedImage } from "../lib/images"
import {
  MAX_BG_BYTES,
  MAX_OUTPUT_PIXELS,
  MAX_PHONE_OUTPUT_PIXELS,
  cutoutFileName,
  detectGpu,
  dropEngine,
  findMask,
  isDownloadProblem,
  isEngineReady,
  isModelCached,
  loadEngine,
  maskCoverage,
  megabytes,
  usablePlans,
  withinTime,
  modelProblem,
  modelProblemText,
  planFile,
  renderCutout,
  screenCopy,
  type BackgroundKind,
  type CutoutLook,
  type GpuSupport,
  type LoadProgress,
  type Mask,
  type ModelPlan,
} from "../lib/background"

const ACCEPT = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
]
/** Longest side of the on-screen copy - keeps the preview quick on big photos. */
const SCREEN_SIDE = 1600
/** Below this share of kept pixels, the AI didn't really find anything. */
const MIN_COVERAGE = 0.002
/** The graphics card answers in about a second; this long means it's stuck. */
const GPU_RUN_LIMIT_MS = 60_000

const BACKGROUNDS: { value: BackgroundKind; label: string }[] = [
  { value: "transparent", label: "Transparent" },
  { value: "white", label: "White" },
  { value: "colour", label: "Colour" },
  { value: "blur", label: "Blurred photo" },
]

/** A fresh worker for the AI (transformers.js + ONNX Runtime live only in there). */
function spawnAiWorker(): Worker {
  return new Worker(new URL("../lib/background.worker.ts", import.meta.url), {
    type: "module",
    name: "background-remover-ai",
  })
}

interface Photo {
  name: string
  bytes: number
  full: DecodedImage
  screen: DecodedImage
}

type Status =
  /** A photo is in, waiting for the person to start (the first time only). */
  | { kind: "ready" }
  | { kind: "loading"; progress: LoadProgress }
  | { kind: "working"; plan: ModelPlan }
  | { kind: "done" }
  | { kind: "error"; message: string }

export function BackgroundRemover() {
  const [photo, setPhoto] = useState<Photo | null>(null)
  const [opening, setOpening] = useState(false)
  const [mask, setMask] = useState<Mask | null>(null)
  const [status, setStatus] = useState<Status>({ kind: "ready" })
  const [gpu, setGpu] = useState<GpuSupport | null>(null)
  /** The model is already on this computer (or loaded on this page). */
  const [cached, setCached] = useState(false)
  /** The person has started the AI once - later photos start by themselves. */
  const [started, setStarted] = useState(false)
  const [bgKind, setBgKind] = useState<BackgroundKind>("transparent")
  const [colour, setColour] = useState("#2563eb")
  const [soften, setSoften] = useState(false)
  const [compare, setCompare] = useState(false)
  const [divider, setDivider] = useState(50)
  const [busy, setBusy] = useState<"png" | "jpg" | "copy" | null>(null)
  const changeInput = useRef<HTMLInputElement>(null)
  /** Bumped for every run, so an older run that finishes late is ignored. */
  const runId = useRef(0)
  /** Last progress shown, so a download doesn't re-render on every chunk. */
  const shownProgress = useRef("")

  const look = useMemo<CutoutLook>(
    () => ({ background: { kind: bgKind, colour }, soften }),
    [bgKind, colour, soften],
  )
  const firstPlan = gpu ? usablePlans(gpu)[0] : undefined

  useEffect(() => {
    let live = true
    void detectGpu().then(async (g) => {
      const plan = usablePlans(g)[0]!
      const have = isEngineReady(plan) || (await isModelCached(plan))
      if (!live) return
      setGpu(g)
      setCached(have)
    })
    return () => {
      live = false
    }
  }, [])

  async function openFile(file: File | undefined) {
    if (!file) return
    if (!fileMatches(file, ACCEPT)) {
      toast.error("Pick a JPG, PNG, WebP or iPhone (HEIC) photo")
      return
    }
    if (file.size > MAX_BG_BYTES) {
      toast.error(`That photo is over ${formatBytes(MAX_BG_BYTES)} - pick a smaller one`)
      return
    }
    setOpening(true)
    try {
      const full =
        imageKind(file) === "heic" ? (await decodeHeic(file)).decoded : await decodeRaster(file)
      const next: Photo = {
        name: file.name,
        bytes: file.size,
        full,
        screen: screenCopy(full, SCREEN_SIDE),
      }
      setPhoto(next)
      setMask(null)
      setCompare(false)
      setDivider(50)
      if (started || cached) {
        void start(next)
      } else {
        runId.current++
        setStatus({ kind: "ready" })
      }
    } catch (err) {
      toast.error(errorText(err, "Couldn't open that photo - try another JPG, PNG or WebP"))
    } finally {
      setOpening(false)
    }
  }

  function removePhoto() {
    runId.current++
    setPhoto(null)
    setMask(null)
    setStatus({ kind: "ready" })
  }

  function showProgress(p: LoadProgress) {
    const pct = p.total > 0 ? Math.floor((p.loaded / p.total) * 100) : 0
    const key = `${p.stage}:${pct}`
    if (key === shownProgress.current) return
    shownProgress.current = key
    setStatus({ kind: "loading", progress: p })
  }

  async function start(p: Photo) {
    const id = ++runId.current
    const live = () => runId.current === id
    setStarted(true)
    setMask(null)
    shownProgress.current = ""
    const plans = usablePlans(await detectGpu())
    for (let i = 0; i < plans.length; i++) {
      const plan = plans[i]!
      try {
        if (!isEngineReady(plan)) {
          showProgress({ stage: "start", loaded: 0, total: 0 })
        }
        const engine = await loadEngine(plan, spawnAiWorker, (prog) => {
          if (live()) showProgress(prog)
        })
        if (!live()) return
        setStatus({ kind: "working", plan })
        // A stuck graphics card never answers (no error either), so give it a
        // time limit and use the processor instead.
        const finding = findMask(engine, p.full)
        const found = await (plan.device === "webgpu" && i < plans.length - 1
          ? withinTime(finding, GPU_RUN_LIMIT_MS, "The graphics card took too long")
          : finding)
        if (!live()) return
        setMask(found)
        setStatus({ kind: "done" })
        setCached(true)
        if (maskCoverage(found.alpha) < MIN_COVERAGE) {
          toast.warning("The AI couldn't find a clear subject", {
            description: "Try a photo where the person or product stands out from the background.",
          })
        }
        return
      } catch (err) {
        const problem = modelProblem(err, navigator.onLine)
        const download = isDownloadProblem(problem)
        const last = i === plans.length - 1
        // Throw the failed model away (a retry starts afresh). If it was the
        // graphics card that couldn't cope, don't try that way again this visit.
        if (!download) dropEngine(plan, !last)
        if (!live()) return
        if (download || last) {
          const message = modelProblemText(problem)
          setStatus({ kind: "error", message })
          toast.error("Couldn't remove the background", { description: message })
          return
        }
        console.warn("[background-remover] using the processor after:", err)
      }
    }
  }

  function maxPixels() {
    return window.matchMedia("(pointer: coarse)").matches
      ? MAX_PHONE_OUTPUT_PIXELS
      : MAX_OUTPUT_PIXELS
  }

  async function download(format: "png" | "jpg") {
    if (!photo || !mask) return
    setBusy(format)
    try {
      const out = await renderCutout(photo.full, mask, look, format, maxPixels())
      saveBlob(out.blob, cutoutFileName(photo.name, format))
      if (out.scaled) {
        toast.info(
          `Saved at ${out.width} x ${out.height} px - the full size is too big for this browser`,
        )
      }
    } catch (err) {
      toast.error(errorText(err, "Couldn't make the image - try again"))
    } finally {
      setBusy(null)
    }
  }

  async function copyImage() {
    if (!photo || !mask) return
    setBusy("copy")
    try {
      // The PNG is handed over as a promise, so Safari still counts this as a click.
      const png = renderCutout(photo.full, mask, look, "png", maxPixels()).then((r) => r.blob)
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })])
      toast.success("Copied - paste it into a document, slide or chat")
    } catch {
      toast.error("Your browser blocked copying - use Download PNG instead")
    } finally {
      setBusy(null)
    }
  }

  const done = status.kind === "done" && mask !== null
  const working = status.kind === "loading" || status.kind === "working"

  return (
    <ToolPage slug="background-remover">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="space-y-2">
              {photo ? (
                <div className="flex items-center gap-3 rounded-sm border p-3">
                  <ImageIcon className="text-muted-foreground h-5 w-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm" title={photo.name}>
                      {photo.name}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {photo.full.width} x {photo.full.height} px · {formatBytes(photo.bytes)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    disabled={opening}
                    onClick={() => changeInput.current?.click()}
                  >
                    {opening ? "Opening..." : "Change"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove photo"
                    title="Remove photo"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={removePhoto}
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
                  maxBytes={MAX_BG_BYTES}
                  allowPaste
                  onFiles={(files) => void openFile(files[0])}
                  label={opening ? "Opening your photo..." : "Drop a photo here or click to choose"}
                  hint={`JPG, PNG, WebP or iPhone HEIC - up to ${formatBytes(MAX_BG_BYTES)}. A person, product or object works best.`}
                />
              )}
              <PrivacyNote />
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <CloudDownload className="h-3.5 w-3.5 shrink-0" />
                The AI model downloads once from Hugging Face; your photo stays on your computer.
              </p>
            </div>

            {photo ? (
              <div className="space-y-3">
                <StatusPanel
                  status={status}
                  firstPlan={firstPlan}
                  cached={cached}
                  onStart={() => void start(photo)}
                />
                {done && (
                  <div className="flex justify-end">
                    <SegmentedControl
                      aria-label="What to show"
                      value={compare ? "compare" : "result"}
                      onChange={(v) => setCompare(v === "compare")}
                      options={[
                        { value: "result", label: "Result" },
                        { value: "compare", label: "Before / after" },
                      ]}
                    />
                  </div>
                )}
                <CompareView
                  photo={photo.screen}
                  mask={mask}
                  look={look}
                  compare={compare}
                  divider={divider}
                  onDivider={setDivider}
                  dimmed={working}
                />
              </div>
            ) : (
              <FirstUseNote firstPlan={firstPlan} cached={cached} />
            )}

            <p className="text-muted-foreground flex items-start gap-2 text-xs md:hidden">
              <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              On a phone this can be slow, and the first time uses mobile data for the AI model. For
              big photos, a computer works best.
            </p>
          </CardContent>
        </Card>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardContent className="space-y-5 p-5">
              <div className="space-y-3">
                <Label id="bg-kind-label">Background</Label>
                <div
                  role="group"
                  aria-labelledby="bg-kind-label"
                  className="grid grid-cols-2 gap-2"
                >
                  {BACKGROUNDS.map((b) => {
                    const active = bgKind === b.value
                    return (
                      <button
                        key={b.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setBgKind(b.value)}
                        className={cn(
                          "hover:bg-accent focus-visible:ring-ring flex items-center gap-2 rounded-sm border p-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
                          active && "border-primary bg-primary/5 ring-primary ring-1",
                        )}
                      >
                        <Swatch kind={b.value} colour={colour} />
                        {b.label}
                      </button>
                    )
                  })}
                </div>
                {bgKind === "colour" && (
                  <div className="space-y-2">
                    <Label htmlFor="bg-colour">Background colour</Label>
                    <div className="border-input flex h-9 items-center gap-2 rounded-sm border px-2">
                      <input
                        id="bg-colour"
                        type="color"
                        value={colour}
                        onChange={(e) => setColour(e.target.value)}
                        className="h-6 w-8 cursor-pointer rounded-sm border-0 bg-transparent p-0"
                      />
                      <span className="text-muted-foreground font-mono text-xs uppercase">
                        {colour}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-start gap-3">
                <Switch
                  id="bg-soften"
                  checked={soften}
                  onCheckedChange={setSoften}
                  aria-describedby="bg-soften-hint"
                />
                <div className="space-y-1">
                  <Label htmlFor="bg-soften" className="mb-0 font-normal">
                    Soften edges
                  </Label>
                  <p id="bg-soften-hint" className="text-muted-foreground text-xs">
                    A gentle blur on the outline - nice for hair, fur and soft edges.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Button
                  className="w-full gap-1.5"
                  disabled={!done || busy !== null}
                  loading={busy === "png"}
                  onClick={() => void download("png")}
                >
                  {busy !== "png" && <Download className="h-4 w-4" />}
                  Download PNG
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="gap-1.5"
                    disabled={!done || busy !== null}
                    loading={busy === "jpg"}
                    onClick={() => void download("jpg")}
                  >
                    {busy !== "jpg" && <Download className="h-4 w-4" />}
                    JPG
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-1.5"
                    disabled={!done || busy !== null}
                    loading={busy === "copy"}
                    onClick={() => void copyImage()}
                  >
                    {busy !== "copy" && <Copy className="h-4 w-4" />}
                    Copy
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {bgKind === "transparent"
                    ? "PNG keeps the background see-through - for logos, slides and websites. JPG can't be see-through, so it gets a white background."
                    : "PNG and JPG both get the background you picked. JPG makes a smaller file."}
                  {photo && (
                    <>
                      {" "}
                      Same size as your photo: {photo.full.width} x {photo.full.height} px.
                    </>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ToolPage>
  )
}

function downloadSentence(plan: ModelPlan | undefined, cached: boolean): string {
  if (cached) return "The AI model is already on this computer, so this is quick."
  if (!plan) return "The first time, this downloads the AI model once. After that it's quick."
  return `The first time, this downloads the AI model (about ${megabytes(planFile(plan).bytes)}) once. After that it's quick.`
}

function FirstUseNote({
  firstPlan,
  cached,
}: {
  firstPlan: ModelPlan | undefined
  cached: boolean
}) {
  return (
    <p className="bg-muted/40 text-muted-foreground flex items-start gap-2 rounded-sm border p-3 text-xs leading-relaxed">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>The AI works on your own computer. {downloadSentence(firstPlan, cached)}</span>
    </p>
  )
}

function StatusPanel({
  status,
  firstPlan,
  cached,
  onStart,
}: {
  status: Status
  firstPlan: ModelPlan | undefined
  cached: boolean
  onStart: () => void
}) {
  if (status.kind === "done") return null
  return (
    <div className="rounded-sm border p-4" aria-live="polite">
      {status.kind === "ready" && (
        <div className="space-y-3">
          <p className="text-muted-foreground text-sm">{downloadSentence(firstPlan, cached)}</p>
          <Button className="gap-1.5" onClick={onStart}>
            <Eraser className="h-4 w-4" />
            Remove background
          </Button>
        </div>
      )}

      {status.kind === "loading" && <LoadingLine progress={status.progress} />}

      {status.kind === "working" && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Removing the background...</p>
          <Progress indeterminate aria-label="Removing the background" />
          <p className="text-muted-foreground text-xs">
            {status.plan.device === "webgpu"
              ? "This takes a few seconds."
              : "This takes 10-30 seconds - a little longer on a slow computer."}
          </p>
        </div>
      )}

      {status.kind === "error" && (
        <div className="space-y-3">
          <p className="text-destructive flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {status.message}
          </p>
          <Button variant="outline" className="gap-1.5" onClick={onStart}>
            <RotateCcw className="h-4 w-4" />
            Try again
          </Button>
        </div>
      )}
    </div>
  )
}

function LoadingLine({ progress }: { progress: LoadProgress }) {
  if (progress.stage === "start" || progress.total <= 0) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium">Getting the AI ready...</p>
        <Progress indeterminate aria-label="Getting the AI ready" />
        <p className="text-muted-foreground text-xs">This can take a few seconds.</p>
      </div>
    )
  }
  const pct = Math.min(100, Math.floor((progress.loaded / progress.total) * 100))
  const downloading = progress.stage === "download"
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">
        {downloading
          ? "Downloading the AI model - only the first time..."
          : "Loading the AI model from this computer..."}
      </p>
      <Progress value={pct} aria-label="AI model download" />
      <p className="text-muted-foreground text-xs tabular-nums">
        {downloading
          ? `${Math.round(progress.loaded / 1_000_000)} of ${megabytes(progress.total)} (${pct}%)`
          : `${pct}%`}
      </p>
    </div>
  )
}

function Swatch({ kind, colour }: { kind: BackgroundKind; colour: string }) {
  const style: CSSProperties =
    kind === "transparent"
      ? { ...CHECKERBOARD, backgroundSize: "8px 8px" }
      : kind === "white"
        ? { backgroundColor: "#ffffff" }
        : kind === "colour"
          ? { backgroundColor: colour }
          : { backgroundImage: "radial-gradient(circle at 30% 35%, #cbd5e1, #64748b 70%)" }
  return (
    <span
      aria-hidden="true"
      className="border-border block h-5 w-5 shrink-0 rounded-sm border"
      style={style}
    />
  )
}
