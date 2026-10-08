"use client"

import { useEffect, useRef, useState } from "react"
import type { PDFDocumentProxy } from "pdfjs-dist"
import { Download, FileText, RotateCw, Trash2, Undo2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { FileDrop } from "../file-drop"
import { baseName, canvasToBlob, saveBlob } from "../../lib/files"
import {
  MAX_PDF_BYTES,
  PDF_ACCEPT,
  moveItem,
  normaliseRotation,
  pagesLabel,
  pdfErrorMessage,
} from "../../lib/pdf"
import {
  Announcer,
  JobStatus,
  MoveButtons,
  PdfFileCard,
  closePdfJs,
  countPagesWithPdfLib,
  loadPdfLib,
  newPdf,
  nextId,
  openPdfJs,
  openPdfLib,
  pdfBlob,
  releaseCanvas,
  renderPage,
  useDragReorder,
  useJob,
  useObjectUrls,
} from "./shared"

interface PageItem {
  id: number
  /** 0-based page number in the original file. */
  index: number
  /** Extra clockwise turn on top of the page's own, in degrees. */
  rotation: number
  removed: boolean
}

/** Long side of a page preview, in pixels (about 2x its on-screen size). */
const THUMB_PX = 260
/** Previews are added to the screen in small batches rather than one re-render per page. */
const THUMB_BATCH = 6

export function OrganiseTab() {
  const [file, setFile] = useState<File | null>(null)
  const [pages, setPages] = useState<PageItem[]>([])
  const [thumbs, setThumbs] = useState<Record<number, string>>({})
  const [drawing, setDrawing] = useState<{ done: number; total: number } | null>(null)
  const [announcement, setAnnouncement] = useState("")
  const urls = useObjectUrls()
  const job = useJob()
  // The file previews are being drawn for. Changing it (or closing the tool)
  // tells a running preview loop to stop.
  const current = useRef<File | null>(null)
  useEffect(() => {
    return () => {
      current.current = null
    }
  }, [])

  const kept = pages.filter((p) => !p.removed)
  const removedCount = pages.length - kept.length
  const rotatedCount = kept.filter((p) => p.rotation).length
  const moved = pages.some((p, i) => p.index !== i)
  const changed = removedCount > 0 || rotatedCount > 0 || moved

  function move(from: number, to: number) {
    const page = pages[from]
    if (!page || to < 0 || to >= pages.length) return
    setPages((prev) => moveItem(prev, from, to))
    setAnnouncement(`Page ${page.index + 1} moved to position ${to + 1} of ${pages.length}`)
  }
  const reorder = useDragReorder(move)

  function forgetThumbs() {
    Object.values(thumbs).forEach((url) => urls.revoke(url))
    setThumbs({})
  }

  function close() {
    current.current = null
    forgetThumbs()
    setFile(null)
    setPages([])
    setDrawing(null)
  }

  async function pick(files: File[]) {
    const next = files[0]
    if (!next) return
    forgetThumbs()
    current.current = next
    setFile(next)
    setPages([])
    setDrawing(null)
    const stale = () => current.current !== next

    // pdf-lib saves the result, so make sure it can open the file before anything else.
    let count: number
    try {
      count = await countPagesWithPdfLib(next)
    } catch (err) {
      if (stale()) return
      close()
      toast.error(pdfErrorMessage(err), { description: next.name })
      return
    }
    if (stale()) return
    setPages(
      Array.from({ length: count }, (_, index) => ({
        id: nextId(),
        index,
        rotation: 0,
        removed: false,
      })),
    )
    await drawThumbs(next, count, stale)
  }

  async function drawThumbs(source: File, count: number, stale: () => boolean) {
    setDrawing({ done: 0, total: count })
    let doc: PDFDocumentProxy | null = null
    let batch: Record<number, string> = {}
    try {
      doc = await openPdfJs(source)
      for (let i = 0; i < count && !stale(); i++) {
        try {
          const page = await doc.getPage(i + 1)
          const base = page.getViewport({ scale: 1 })
          const canvas = await renderPage(page, THUMB_PX / Math.max(base.width, base.height))
          const blob = await canvasToBlob(canvas, "image/jpeg", 0.8)
          releaseCanvas(canvas)
          page.cleanup()
          batch[i] = urls.create(blob)
        } catch (err) {
          // One page that won't draw just goes without a preview - it can still be moved and saved.
          console.warn("[pdf-toolkit] page preview failed", i + 1, err)
        }
        if (!stale() && ((i + 1) % THUMB_BATCH === 0 || i === count - 1)) {
          const ready = batch
          batch = {}
          setThumbs((prev) => ({ ...prev, ...ready }))
          setDrawing({ done: i + 1, total: count })
        }
      }
    } catch (err) {
      console.warn("[pdf-toolkit] previews failed", err)
      if (!stale()) {
        toast.error("Couldn't draw the page previews", {
          description: "You can still move, rotate and remove pages by number.",
        })
      }
    } finally {
      closePdfJs(doc)
      // Previews drawn for a file that has since been closed are thrown away.
      Object.values(batch).forEach((url) => urls.revoke(url))
      if (!stale()) setDrawing(null)
    }
  }

  function rotate(id: number) {
    setPages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, rotation: normaliseRotation(p.rotation + 90) } : p)),
    )
  }

  function toggleRemoved(page: PageItem) {
    setPages((prev) => prev.map((p) => (p.id === page.id ? { ...p, removed: !p.removed } : p)))
    setAnnouncement(`Page ${page.index + 1} ${page.removed ? "put back" : "removed"}`)
  }

  function rotateAll() {
    setPages((prev) => prev.map((p) => ({ ...p, rotation: normaliseRotation(p.rotation + 90) })))
    setAnnouncement("All pages rotated")
  }

  function undoChanges() {
    setPages((prev) =>
      prev
        .slice()
        .sort((a, b) => a.index - b.index)
        .map((p) => ({ ...p, rotation: 0, removed: false })),
    )
    setAnnouncement("Back to the original pages")
  }

  async function save() {
    if (!file) return
    const keep = kept
    if (!keep.length) return
    const ok = await job.run(async (step) => {
      await step(0, 2, "Putting your pages together...")
      const { degrees } = await loadPdfLib()
      const src = await openPdfLib(file)
      const out = await newPdf()
      const copied = await out.copyPages(
        src,
        keep.map((p) => p.index),
      )
      copied.forEach((page, i) => {
        const extra = keep[i]?.rotation ?? 0
        if (extra) page.setRotation(degrees(normaliseRotation(page.getRotation().angle + extra)))
        out.addPage(page)
      })
      await step(1, 2, "Saving...")
      saveBlob(pdfBlob(await out.save()), `${baseName(file.name)}-organised.pdf`)
    })
    if (ok) toast.success(`Saved ${pagesLabel(keep.length)}`)
  }

  if (!file) {
    return (
      <Card>
        <CardContent className="p-3 sm:p-5">
          <FileDrop
            accept={PDF_ACCEPT}
            maxBytes={MAX_PDF_BYTES}
            label="Drop a PDF here or click to choose"
            hint="One PDF, up to 100 MB - you'll see all its pages"
            onFiles={pick}
          />
        </CardContent>
      </Card>
    )
  }

  const summary = [
    pagesLabel(kept.length) + (removedCount ? ` kept, ${removedCount} removed` : ""),
    rotatedCount ? `${rotatedCount} rotated` : "",
    moved ? "order changed" : "",
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 p-3 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1">
              <PdfFileCard
                file={file}
                pageCount={pages.length || null}
                onRemove={close}
                disabled={job.busy}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={!pages.length || job.busy} onClick={rotateAll}>
                <RotateCw />
                Rotate all
              </Button>
              <Button variant="outline" disabled={!changed || job.busy} onClick={undoChanges}>
                <Undo2 />
                Undo changes
              </Button>
              <Button disabled={!kept.length} loading={job.busy} onClick={save}>
                {!job.busy && <Download />}
                Save PDF
              </Button>
            </div>
          </div>
          {pages.length > 0 && (
            <p className="text-muted-foreground text-xs">
              {kept.length
                ? `${summary}. Drag a page to move it, or use its arrow buttons.`
                : "Every page is removed - put at least one back to save."}
            </p>
          )}
          {drawing && (
            <p className="text-muted-foreground text-xs" role="status">
              Drawing page previews: {drawing.done} of {drawing.total}
            </p>
          )}
          <JobStatus progress={job.progress} onCancel={job.cancel} />
        </CardContent>
      </Card>

      {pages.length > 0 && (
        <ol
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6"
          aria-label="Pages, in order"
        >
          {pages.map((page, index) => {
            const number = page.index + 1
            const thumb = thumbs[page.index]
            return (
              <li
                key={page.id}
                {...reorder.itemProps(index)}
                className={cn(
                  "bg-background flex flex-col gap-2 rounded-sm border p-2",
                  reorder.overIndex === index && "border-primary ring-primary ring-1",
                  reorder.draggingIndex === index && "opacity-50",
                )}
              >
                <div
                  className={cn(
                    "bg-muted/40 flex aspect-square cursor-grab items-center justify-center overflow-hidden rounded-sm p-2",
                    page.removed && "opacity-30",
                  )}
                >
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a local object URL, not a served image
                    <img
                      src={thumb}
                      alt={`Page ${number}`}
                      draggable={false}
                      className="max-h-full max-w-full border bg-white object-contain shadow-sm"
                      style={
                        page.rotation ? { transform: `rotate(${page.rotation}deg)` } : undefined
                      }
                    />
                  ) : (
                    <FileText aria-hidden="true" className="text-muted-foreground h-6 w-6" />
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 px-0.5 text-xs">
                  <span className="font-medium">Page {number}</span>
                  <span className="text-muted-foreground truncate">
                    {page.removed ? "Removed" : page.rotation ? `Rotated ${page.rotation}°` : ""}
                  </span>
                </div>
                <div className="flex flex-wrap justify-center gap-0.5">
                  <MoveButtons
                    layout="grid"
                    index={index}
                    count={pages.length}
                    name={`page ${number}`}
                    onMove={move}
                    disabled={job.busy}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Rotate page ${number}`}
                    title="Rotate"
                    disabled={job.busy || page.removed}
                    onClick={() => rotate(page.id)}
                  >
                    <RotateCw />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={page.removed ? `Put page ${number} back` : `Remove page ${number}`}
                    title={page.removed ? "Put back" : "Remove"}
                    className={
                      page.removed ? undefined : "text-muted-foreground hover:text-destructive"
                    }
                    disabled={job.busy}
                    onClick={() => toggleRemoved(page)}
                  >
                    {page.removed ? <Undo2 /> : <Trash2 />}
                  </Button>
                </div>
              </li>
            )
          })}
        </ol>
      )}
      <Announcer message={announcement} />
    </div>
  )
}
