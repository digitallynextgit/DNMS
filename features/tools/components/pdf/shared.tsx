"use client"

import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react"
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist"
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, FileText, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { formatBytes } from "../../lib/files"
import { pagesLabel, pdfErrorMessage, safeRenderScale } from "../../lib/pdf"

type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs")

let pdfjsLoading: Promise<PdfJs> | null = null

/**
 * The LEGACY build on purpose: the modern pdfjs-dist 6 build needs brand-new JS (Promise.try,
 * Math.sumPrecise) with no fallback, so it fails outright on phones a year or two old.
 */
export function loadPdfJs(): Promise<PdfJs> {
  if (!pdfjsLoading) {
    pdfjsLoading = import("pdfjs-dist/legacy/build/pdf.mjs").then((pdfjs) => {
      // new URL(..., import.meta.url) makes the bundler serve the worker from our own origin.
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString()
      return pdfjs
    })
    // A failed load (flaky network) shouldn't stick - let the next try reload.
    pdfjsLoading.catch(() => {
      pdfjsLoading = null
    })
  }
  return pdfjsLoading
}

function bundledWasmUrl(filename: string): string | null {
  switch (filename) {
    case "jbig2.wasm":
      return new URL("pdfjs-dist/wasm/jbig2.wasm", import.meta.url).toString()
    case "openjpeg.wasm":
      return new URL("pdfjs-dist/wasm/openjpeg.wasm", import.meta.url).toString()
    default:
      return null
  }
}

/**
 * pdf.js fetches its JBIG2 / JPEG 2000 WASM decoders by file name, which the bundler renames.
 * Without this, scanned pages render blank. CMaps and fonts are declined (system fonts are fine).
 */
class BundledWasmFactory {
  async fetch({ kind, filename }: { kind: string; filename: string }): Promise<Uint8Array> {
    const url = kind === "wasmUrl" ? bundledWasmUrl(filename) : null
    if (!url) throw new Error(`Not bundled: ${filename}`)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Couldn't load ${filename}`)
    return new Uint8Array(await res.arrayBuffer())
  }
}

/** pdf.js 6 has no PDFDocumentProxy#destroy - the loading task owns the teardown. */
export function closePdfJs(doc: PDFDocumentProxy | null | undefined): void {
  if (doc) void doc.loadingTask.destroy()
}

/** Free it with closePdfJs when done. */
export async function openPdfJs(file: Blob): Promise<PDFDocumentProxy> {
  const pdfjs = await loadPdfJs()
  const data = new Uint8Array(await file.arrayBuffer())
  const task = pdfjs.getDocument({
    data,
    BinaryDataFactory: BundledWasmFactory,
    useWorkerFetch: false,
    verbosity: pdfjs.VerbosityLevel.ERRORS,
  })
  try {
    return await task.promise
  } catch (err) {
    // A wrong password / broken file still leaves a worker running.
    void task.destroy()
    throw err
  }
}

/** `scale` 1 = 72 DPI, capped to what the browser can draw. Free it with releaseCanvas. */
export async function renderPage(page: PDFPageProxy, scale: number): Promise<HTMLCanvasElement> {
  const base = page.getViewport({ scale: 1 })
  const viewport = page.getViewport({ scale: safeRenderScale(base.width, base.height, scale) })
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.floor(viewport.width))
  canvas.height = Math.max(1, Math.floor(viewport.height))
  await page.render({ canvas, viewport, background: "#ffffff" }).promise
  return canvas
}

/** Hand a canvas's memory back straight away (big canvases otherwise linger until GC). */
export function releaseCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 0
  canvas.height = 0
}

export function loadPdfLib() {
  return import("pdf-lib")
}

/** Throws on password-protected files. */
export async function openPdfLib(file: Blob) {
  const { PDFDocument } = await loadPdfLib()
  return PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false })
}

/** updateMetadata: false keeps pdf-lib's own name out of the file. */
export async function newPdf() {
  const { PDFDocument } = await loadPdfLib()
  return PDFDocument.create({ updateMetadata: false })
}

export function pdfBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes as BlobPart], { type: "application/pdf" })
}

/** For tabs that save with pdf-lib, so a file it can't open is turned away up front. */
export async function countPagesWithPdfLib(file: File): Promise<number> {
  const doc = await openPdfLib(file)
  const pages = doc.getPageCount()
  if (!pages) throw new Error("Invalid PDF: no pages")
  return pages
}

/** Size is the first page's, in points. For tabs that only draw pages. */
export async function inspectWithPdfJs(
  file: File,
): Promise<{ pages: number; width: number; height: number }> {
  const doc = await openPdfJs(file)
  try {
    if (!doc.numPages) throw new Error("Invalid PDF: no pages")
    const first = await doc.getPage(1)
    const { width, height } = first.getViewport({ scale: 1 })
    return { pages: doc.numPages, width, height }
  } finally {
    closePdfJs(doc)
  }
}

export function usePdfPick<T>(inspect: (file: File) => Promise<T>) {
  const [file, setFile] = useState<File | null>(null)
  const [info, setInfo] = useState<T | null>(null)
  const current = useRef<File | null>(null)

  async function pick(next: File) {
    current.current = next
    setFile(next)
    setInfo(null)
    try {
      const result = await inspect(next)
      if (current.current === next) setInfo(result)
    } catch (err) {
      if (current.current !== next) return
      current.current = null
      setFile(null)
      toast.error(pdfErrorMessage(err), { description: next.name })
    }
  }

  function clear() {
    current.current = null
    setFile(null)
    setInfo(null)
  }

  return { file, info, pick, clear }
}

export interface JobProgress {
  done: number
  total: number
  label: string
}

/** Report progress, give the browser a moment to paint, and stop here if cancelled. */
export type JobStep = (done: number, total: number, label: string) => Promise<void>

class JobCancelled extends Error {}

/** An error whose message is already fit to show as-is (with an optional second line). */
export class FriendlyError extends Error {
  constructor(
    message: string,
    readonly description?: string,
  ) {
    super(message)
    this.name = "FriendlyError"
  }
}

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

export function useJob() {
  const [progress, setProgress] = useState<JobProgress | null>(null)
  const cancelled = useRef(false)

  async function run(task: (step: JobStep) => Promise<void>): Promise<boolean> {
    if (progress) return false
    cancelled.current = false
    setProgress({ done: 0, total: 1, label: "Starting..." })
    try {
      await task(async (done, total, label) => {
        if (cancelled.current) throw new JobCancelled()
        setProgress({ done, total, label })
        await yieldToBrowser()
      })
      return true
    } catch (err) {
      if (err instanceof JobCancelled) {
        toast("Stopped - nothing was saved")
      } else if (err instanceof FriendlyError) {
        toast.error(err.message, { description: err.description })
      } else {
        console.error("[pdf-toolkit]", err)
        toast.error(pdfErrorMessage(err))
      }
      return false
    } finally {
      setProgress(null)
    }
  }

  return {
    progress,
    busy: progress !== null,
    run,
    cancel: () => {
      cancelled.current = true
    },
  }
}

export function JobStatus({
  progress,
  onCancel,
}: {
  progress: JobProgress | null
  onCancel: () => void
}) {
  if (!progress) return null
  const pct = progress.total ? (progress.done / progress.total) * 100 : 0
  return (
    <div className="space-y-2" role="status" aria-live="polite">
      <Progress value={pct} aria-label="Progress" />
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground text-xs">{progress.label}</span>
        <Button variant="ghost" className="text-muted-foreground px-2" onClick={onCancel}>
          Stop
        </Button>
      </div>
    </div>
  )
}

/** Object URLs that are all revoked on unmount. */
export function useObjectUrls() {
  const urls = useRef<Set<string>>(new Set())
  useEffect(() => {
    const set = urls.current
    return () => {
      set.forEach((url) => URL.revokeObjectURL(url))
      set.clear()
    }
  }, [])
  return {
    create(blob: Blob): string {
      const url = URL.createObjectURL(blob)
      urls.current.add(url)
      return url
    },
    revoke(url: string | null | undefined): void {
      if (!url) return
      URL.revokeObjectURL(url)
      urls.current.delete(url)
    },
  }
}

/** Mouse only - touch and keyboard users have the move buttons. */
export function useDragReorder(onMove: (from: number, to: number) => void) {
  const [drag, setDrag] = useState<{ from: number; over: number } | null>(null)
  return {
    overIndex: drag && drag.over !== drag.from ? drag.over : null,
    draggingIndex: drag?.from ?? null,
    itemProps(index: number) {
      return {
        draggable: true,
        onDragStart(e: DragEvent) {
          e.dataTransfer.effectAllowed = "move"
          // Firefox won't start a drag without some data.
          e.dataTransfer.setData("text/plain", String(index))
          setDrag({ from: index, over: index })
        },
        onDragOver(e: DragEvent) {
          if (!drag) return // a file from the desktop, not one of ours
          e.preventDefault()
          e.dataTransfer.dropEffect = "move"
          if (drag.over !== index) setDrag({ from: drag.from, over: index })
        },
        onDrop(e: DragEvent) {
          if (!drag) return
          e.preventDefault()
          onMove(drag.from, index)
          setDrag(null)
        },
        onDragEnd() {
          setDrag(null)
        },
      }
    },
  }
}

export function MoveButtons({
  index,
  count,
  name,
  onMove,
  layout = "list",
  disabled,
}: {
  index: number
  count: number
  /** What the item is called in the button labels: "report.pdf", "page 3". */
  name: string
  onMove: (from: number, to: number) => void
  layout?: "list" | "grid"
  disabled?: boolean
}) {
  const Earlier = layout === "list" ? ArrowUp : ArrowLeft
  const Later = layout === "list" ? ArrowDown : ArrowRight
  const earlierLabel = `Move ${name} ${layout === "list" ? "up" : "earlier"}`
  const laterLabel = `Move ${name} ${layout === "list" ? "down" : "later"}`
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={earlierLabel}
        title={earlierLabel}
        disabled={disabled || index === 0}
        onClick={() => onMove(index, index - 1)}
      >
        <Earlier />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={laterLabel}
        title={laterLabel}
        disabled={disabled || index === count - 1}
        onClick={() => onMove(index, index + 1)}
      >
        <Later />
      </Button>
    </>
  )
}

export function Announcer({ message }: { message: string }) {
  return (
    <p className="sr-only" aria-live="polite">
      {message}
    </p>
  )
}

export function TwoColumn({ main, side }: { main: ReactNode; side: ReactNode }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-4">{main}</div>
      <div className="lg:sticky lg:top-20 lg:self-start">
        <Card>
          <CardContent className="space-y-5 p-5">{side}</CardContent>
        </Card>
      </div>
    </div>
  )
}

export function PdfFileCard({
  file,
  pageCount,
  onRemove,
  disabled,
}: {
  file: File
  pageCount: number | null
  onRemove: () => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-3 rounded-sm border p-3">
      <div className="bg-muted text-muted-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-sm">
        <FileText className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={file.name}>
          {file.name}
        </p>
        <p className="text-muted-foreground text-xs">
          {pageCount === null
            ? "Reading..."
            : `${pagesLabel(pageCount)} · ${formatBytes(file.size)}`}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Remove ${file.name}`}
        title="Choose a different file"
        className="text-muted-foreground hover:text-destructive"
        disabled={disabled}
        onClick={onRemove}
      >
        <X />
      </Button>
    </div>
  )
}

export interface Choice<T extends string> {
  value: T
  label: string
  hint?: string
}

/** Native radios, so arrow keys work. */
export function ChoiceGroup<T extends string>({
  name,
  legend,
  value,
  options,
  onChange,
  disabled,
}: {
  name: string
  legend: string
  value: T
  options: readonly Choice<T>[]
  onChange: (value: T) => void
  disabled?: boolean
}) {
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="mb-2 text-sm leading-none font-medium">{legend}</legend>
      {options.map((o) => (
        <label
          key={o.value}
          className={cn(
            "has-[:focus-visible]:ring-ring flex cursor-pointer items-start gap-3 rounded-sm border p-3 transition-colors has-[:focus-visible]:ring-2",
            value === o.value ? "border-primary bg-primary/5" : "hover:bg-accent/50",
            disabled && "cursor-not-allowed opacity-60",
          )}
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="accent-primary mt-0.5 h-4 w-4 shrink-0"
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium">{o.label}</span>
            {o.hint && <span className="text-muted-foreground block text-xs">{o.hint}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  )
}

let lastId = 0
export function nextId(): number {
  lastId += 1
  return lastId
}
