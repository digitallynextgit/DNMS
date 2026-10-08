"use client"

import { useMemo, useState } from "react"
import { Scissors } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FileDrop } from "../file-drop"
import { baseName, saveBlob, zipBlobs } from "../../lib/files"
import {
  MAX_PDF_BYTES,
  PDF_ACCEPT,
  extractFileName,
  formatPageList,
  pageSuffix,
  pagesLabel,
  parsePageRanges,
} from "../../lib/pdf"
import {
  ChoiceGroup,
  JobStatus,
  PdfFileCard,
  TwoColumn,
  countPagesWithPdfLib,
  newPdf,
  openPdfLib,
  pdfBlob,
  useJob,
  usePdfPick,
  type Choice,
} from "./shared"

type SplitMode = "extract" | "each"

const MODES: readonly Choice<SplitMode>[] = [
  {
    value: "extract",
    label: "Extract pages",
    hint: "Pick the pages you want - they go into one new PDF.",
  },
  { value: "each", label: "Every page as its own file", hint: "One PDF per page, all in a ZIP." },
]

export function SplitTab() {
  const pdf = usePdfPick(countPagesWithPdfLib)
  const [mode, setMode] = useState<SplitMode>("extract")
  const [ranges, setRanges] = useState("")
  const job = useJob()
  const { file, info: pageCount } = pdf

  const parsed = useMemo(
    () => (pageCount ? parsePageRanges(ranges, pageCount) : null),
    [ranges, pageCount],
  )
  const showRangeError = !!parsed && !parsed.ok && ranges.trim() !== ""
  const ready = !!file && !!pageCount && !job.busy
  const canRun = ready && (mode === "each" ? (pageCount ?? 0) > 1 : !!parsed?.ok)

  function pick(files: File[]) {
    const next = files[0]
    if (!next) return
    setRanges("")
    void pdf.pick(next)
  }

  async function extract() {
    if (!file || !parsed?.ok) return
    const pages = parsed.pages
    const ok = await job.run(async (step) => {
      await step(0, 2, `Copying ${pagesLabel(pages.length)}...`)
      const src = await openPdfLib(file)
      const out = await newPdf()
      const copied = await out.copyPages(
        src,
        pages.map((p) => p - 1),
      )
      copied.forEach((page) => out.addPage(page))
      await step(1, 2, "Saving...")
      saveBlob(pdfBlob(await out.save()), extractFileName(baseName(file.name), pages))
    })
    if (ok) toast.success(`Saved ${pagesLabel(pages.length)} as a new PDF`)
  }

  async function splitEach() {
    if (!file) return
    const base = baseName(file.name)
    let count = 0
    const ok = await job.run(async (step) => {
      const src = await openPdfLib(file)
      const total = src.getPageCount()
      const files: { name: string; blob: Blob }[] = []
      for (let i = 0; i < total; i++) {
        await step(i, total, `Page ${i + 1} of ${total}`)
        const out = await newPdf()
        const [page] = await out.copyPages(src, [i])
        out.addPage(page)
        files.push({
          name: `${base}-${pageSuffix(i + 1, total)}.pdf`,
          blob: pdfBlob(await out.save()),
        })
      }
      await step(total, total, "Packing the ZIP...")
      saveBlob(await zipBlobs(files), `${base}-pages.zip`)
      count = total
    })
    if (ok) toast.success(`Split into ${count} PDFs`)
  }

  return (
    <TwoColumn
      main={
        <Card>
          <CardContent className="space-y-4 p-3 sm:p-5">
            {file ? (
              <PdfFileCard
                file={file}
                pageCount={pageCount}
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
          <ChoiceGroup
            name="split-mode"
            legend="How to split"
            value={mode}
            options={MODES}
            onChange={setMode}
            disabled={job.busy}
          />

          {mode === "extract" ? (
            <div className="space-y-2">
              <Label htmlFor="split-pages">Pages to extract</Label>
              <Input
                id="split-pages"
                value={ranges}
                onChange={(e) => setRanges(e.target.value)}
                placeholder="e.g. 1-3, 5, 8-10"
                inputMode="text"
                autoComplete="off"
                disabled={!pageCount || job.busy}
                aria-invalid={showRangeError}
                aria-describedby="split-pages-help"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canRun) void extract()
                }}
              />
              <p
                id="split-pages-help"
                className={
                  showRangeError ? "text-destructive text-xs" : "text-muted-foreground text-xs"
                }
              >
                {showRangeError && parsed && !parsed.ok
                  ? parsed.error
                  : parsed?.ok
                    ? `${pagesLabel(parsed.pages.length)}: ${formatPageList(parsed.pages)}`
                    : `Separate with commas. "8-" means page 8 to the end.${pageCount ? ` This PDF has ${pagesLabel(pageCount)}.` : ""}`}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">
              {pageCount === null
                ? "Choose a PDF first."
                : pageCount > 1
                  ? `Makes ${pageCount} PDFs, one for each page, in a ZIP file.`
                  : "This PDF has only one page - there's nothing to split."}
            </p>
          )}

          <Button
            className="w-full"
            disabled={!canRun}
            loading={job.busy}
            onClick={mode === "extract" ? extract : splitEach}
          >
            {!job.busy && <Scissors />}
            {mode === "extract"
              ? "Extract pages"
              : `Split into ${pageCount && pageCount > 1 ? `${pageCount} files` : "files"}`}
          </Button>
          <JobStatus progress={job.progress} onCancel={job.cancel} />
        </>
      }
    />
  )
}
