"use client"

import { useMemo, useState } from "react"
import { Images } from "lucide-react"
import { toast } from "sonner"
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
import { FileDrop } from "../file-drop"
import { baseName, canvasToBlob, saveBlob, zipBlobs } from "../../lib/files"
import {
  MAX_PDF_BYTES,
  PDF_ACCEPT,
  dpiScale,
  formatPageList,
  pageSuffix,
  pagesLabel,
  parsePageRanges,
  safeRenderScale,
  type PageRangeResult,
} from "../../lib/pdf"
import {
  JobStatus,
  PdfFileCard,
  closePdfJs,
  TwoColumn,
  inspectWithPdfJs,
  openPdfJs,
  releaseCanvas,
  renderPage,
  useJob,
  usePdfPick,
} from "./shared"

type Format = "png" | "jpg"
type Dpi = "72" | "150" | "300"

const FORMATS: { value: Format; label: string }[] = [
  { value: "png", label: "PNG - sharpest, bigger files" },
  { value: "jpg", label: "JPG - smaller files" },
]

const RESOLUTIONS: { value: Dpi; label: string }[] = [
  { value: "72", label: "Screen - 72 DPI" },
  { value: "150", label: "Standard - 150 DPI" },
  { value: "300", label: "Print - 300 DPI" },
]

export function PdfToImagesTab() {
  const pdf = usePdfPick(inspectWithPdfJs)
  const [format, setFormat] = useState<Format>("png")
  const [dpi, setDpi] = useState<Dpi>("150")
  const [pagesText, setPagesText] = useState("")
  const job = useJob()
  const { file, info } = pdf

  /** Blank means every page. */
  const selection = useMemo<PageRangeResult | null>(() => {
    if (!info) return null
    if (!pagesText.trim()) {
      return { ok: true, pages: Array.from({ length: info.pages }, (_, i) => i + 1) }
    }
    return parsePageRanges(pagesText, info.pages)
  }, [pagesText, info])

  // What page 1 will come out at - a hint for picking a resolution.
  const firstSize = useMemo(() => {
    if (!info) return null
    const s = safeRenderScale(info.width, info.height, dpiScale(Number(dpi)))
    return `${Math.floor(info.width * s)} × ${Math.floor(info.height * s)} pixels`
  }, [info, dpi])

  const showError = !!selection && !selection.ok && pagesText.trim() !== ""
  const count = selection?.ok ? selection.pages.length : 0

  function pick(files: File[]) {
    const next = files[0]
    if (!next) return
    setPagesText("")
    void pdf.pick(next)
  }

  async function convert() {
    if (!file || !selection?.ok) return
    const pages = selection.pages
    const mime = format === "png" ? "image/png" : "image/jpeg"
    const scale = dpiScale(Number(dpi))
    const base = baseName(file.name)
    const ok = await job.run(async (step) => {
      const doc = await openPdfJs(file)
      try {
        const images: { name: string; blob: Blob }[] = []
        for (const [i, n] of pages.entries()) {
          await step(i, pages.length, `Page ${n} (${i + 1} of ${pages.length})`)
          const page = await doc.getPage(n)
          const canvas = await renderPage(page, scale)
          const blob = await canvasToBlob(canvas, mime, format === "jpg" ? 0.92 : undefined)
          releaseCanvas(canvas)
          page.cleanup()
          images.push({ name: `${base}-${pageSuffix(n, doc.numPages)}.${format}`, blob })
        }
        const only = images.length === 1 ? images[0] : undefined
        if (only) {
          saveBlob(only.blob, only.name)
        } else {
          await step(pages.length, pages.length, "Packing the ZIP...")
          saveBlob(await zipBlobs(images), `${base}-images.zip`)
        }
      } finally {
        closePdfJs(doc)
      }
    })
    if (ok)
      toast.success(pages.length === 1 ? "Image saved" : `Saved ${pages.length} images in a ZIP`)
  }

  return (
    <TwoColumn
      main={
        <Card>
          <CardContent className="space-y-4 p-3 sm:p-5">
            {file ? (
              <PdfFileCard
                file={file}
                pageCount={info?.pages ?? null}
                onRemove={pdf.clear}
                disabled={job.busy}
              />
            ) : (
              <FileDrop
                accept={PDF_ACCEPT}
                maxBytes={MAX_PDF_BYTES}
                label="Drop a PDF here or click to choose"
                hint="One PDF, up to 100 MB"
                onFiles={pick}
              />
            )}
          </CardContent>
        </Card>
      }
      side={
        <>
          <div className="space-y-2">
            <Label htmlFor="pdf-img-format">Image type</Label>
            <Select
              value={format}
              onValueChange={(v) => setFormat(v as Format)}
              disabled={job.busy}
            >
              <SelectTrigger id="pdf-img-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMATS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pdf-img-dpi">Resolution</Label>
            <Select value={dpi} onValueChange={(v) => setDpi(v as Dpi)} disabled={job.busy}>
              <SelectTrigger id="pdf-img-dpi" aria-describedby="pdf-img-dpi-help">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESOLUTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p id="pdf-img-dpi-help" className="text-muted-foreground text-xs">
              {firstSize
                ? `Page 1 comes out at ${firstSize}.`
                : "Higher DPI is sharper but makes bigger files."}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pdf-img-pages">Pages (optional)</Label>
            <Input
              id="pdf-img-pages"
              value={pagesText}
              onChange={(e) => setPagesText(e.target.value)}
              placeholder="All pages"
              autoComplete="off"
              disabled={!info || job.busy}
              aria-invalid={showError}
              aria-describedby="pdf-img-pages-help"
            />
            <p
              id="pdf-img-pages-help"
              className={showError ? "text-destructive text-xs" : "text-muted-foreground text-xs"}
            >
              {showError && selection && !selection.ok
                ? selection.error
                : selection?.ok && pagesText.trim()
                  ? `${pagesLabel(count)}: ${formatPageList(selection.pages)}`
                  : 'Leave empty for every page, or type pages like "1-3, 5".'}
            </p>
          </div>
          <Button
            className="w-full"
            disabled={!count || job.busy}
            loading={job.busy}
            onClick={convert}
          >
            {!job.busy && <Images />}
            {count > 1 ? `Convert ${count} pages` : "Convert to image"}
          </Button>
          <JobStatus progress={job.progress} onCancel={job.cancel} />
          {count > 1 && (
            <p className="text-muted-foreground text-xs">
              More than one page downloads as a ZIP file.
              {dpi === "300" && count > 30 && " At 300 DPI that can be a big download."}
            </p>
          )}
        </>
      }
    />
  )
}
