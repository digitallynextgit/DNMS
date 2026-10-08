"use client"

import { useState } from "react"
import { AlertTriangle, ArrowRight, Download, Minimize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { FileDrop } from "../file-drop"
import { baseName, canvasToBlob, formatBytes, saveBlob, savedPercent } from "../../lib/files"
import { MAX_PDF_BYTES, PDF_ACCEPT, dpiScale } from "../../lib/pdf"
import {
  ChoiceGroup,
  closePdfJs,
  JobStatus,
  PdfFileCard,
  TwoColumn,
  inspectWithPdfJs,
  newPdf,
  openPdfJs,
  pdfBlob,
  releaseCanvas,
  renderPage,
  useJob,
  usePdfPick,
  type Choice,
} from "./shared"

type Level = "smallest" | "balanced" | "quality"

/** How sharp each page is redrawn, and how hard the JPEG is squeezed. */
const LEVELS: Record<Level, { dpi: number; quality: number }> = {
  smallest: { dpi: 72, quality: 0.5 },
  balanced: { dpi: 110, quality: 0.6 },
  quality: { dpi: 150, quality: 0.75 },
}

const LEVEL_CHOICES: readonly Choice<Level>[] = [
  { value: "smallest", label: "Smallest file", hint: "Fine on screen, soft when printed." },
  { value: "balanced", label: "Balanced", hint: "Good for email and WhatsApp." },
  {
    value: "quality",
    label: "Better quality",
    hint: "Sharper text, bigger file. Good for printing.",
  },
]

type Result =
  | { smaller: true; blob: Blob; name: string; before: number; after: number }
  | { smaller: false; before: number; after: number }

export function CompressTab() {
  const pdf = usePdfPick(inspectWithPdfJs)
  const [level, setLevel] = useState<Level>("balanced")
  const [result, setResult] = useState<Result | null>(null)
  const job = useJob()
  const { file, info } = pdf

  function pick(files: File[]) {
    const next = files[0]
    if (!next) return
    setResult(null)
    void pdf.pick(next)
  }

  async function compress() {
    if (!file) return
    const { dpi, quality } = LEVELS[level]
    setResult(null)
    const done: { result?: Result } = {}
    const ok = await job.run(async (step) => {
      const doc = await openPdfJs(file)
      try {
        const out = await newPdf()
        const total = doc.numPages
        for (let n = 1; n <= total; n++) {
          await step(n - 1, total, `Compressing page ${n} of ${total}`)
          const page = await doc.getPage(n)
          // Page size in points, already turned the way the page displays.
          const { width, height } = page.getViewport({ scale: 1 })
          const canvas = await renderPage(page, dpiScale(dpi))
          const jpeg = await canvasToBlob(canvas, "image/jpeg", quality)
          releaseCanvas(canvas)
          page.cleanup()
          const image = await out.embedJpg(await jpeg.arrayBuffer())
          out.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height })
        }
        await step(total, total, "Saving...")
        const blob = pdfBlob(await out.save())
        done.result =
          blob.size < file.size
            ? {
                smaller: true,
                blob,
                name: `${baseName(file.name)}-compressed.pdf`,
                before: file.size,
                after: blob.size,
              }
            : { smaller: false, before: file.size, after: blob.size }
      } finally {
        closePdfJs(doc)
      }
    })
    if (ok && done.result) setResult(done.result)
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
                onRemove={() => {
                  setResult(null)
                  pdf.clear()
                }}
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

            {result && (
              <div className="space-y-3 rounded-sm border p-4" role="status">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{formatBytes(result.before)}</span>
                  <ArrowRight aria-label="to" className="text-muted-foreground h-4 w-4" />
                  <span className="font-semibold">{formatBytes(result.after)}</span>
                  {result.smaller && (
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      {savedPercent(result.before, result.after)}% smaller
                    </span>
                  )}
                </div>
                {result.smaller ? (
                  <Button onClick={() => saveBlob(result.blob, result.name)}>
                    <Download />
                    Download compressed PDF
                  </Button>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    That came out bigger than your original, so keep the original - it&apos;s
                    already well compressed.
                    {level !== "smallest" && ' You could try "Smallest file".'}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      }
      side={
        <>
          <ChoiceGroup
            name="compress-level"
            legend="Compression"
            value={level}
            options={LEVEL_CHOICES}
            onChange={(value) => {
              setLevel(value)
              setResult(null)
            }}
            disabled={job.busy}
          />
          <div className="flex gap-2 rounded-sm border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>
              Every page becomes a picture. After compressing, text <strong>can&apos;t</strong> be
              selected, searched or copied, and links stop working. Best for scans and photo-heavy
              PDFs - keep your original.
            </p>
          </div>
          <Button
            className="w-full"
            disabled={!info || job.busy}
            loading={job.busy}
            onClick={compress}
          >
            {!job.busy && <Minimize2 />}
            Compress PDF
          </Button>
          <JobStatus progress={job.progress} onCancel={job.cancel} />
        </>
      }
    />
  )
}
