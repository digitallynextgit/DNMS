"use client"

import { useState } from "react"
import { Combine, FileText, GripVertical, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { FileDrop } from "../file-drop"
import { formatBytes, saveBlob } from "../../lib/files"
import { MAX_PDF_BYTES, PDF_ACCEPT, moveItem, pagesLabel, pdfErrorMessage } from "../../lib/pdf"
import {
  Announcer,
  FriendlyError,
  JobStatus,
  MoveButtons,
  TwoColumn,
  newPdf,
  nextId,
  openPdfLib,
  pdfBlob,
  useDragReorder,
  useJob,
} from "./shared"

interface MergeItem {
  id: number
  file: File
  /** null while the file is still being read. */
  pages: number | null
}

export function MergeTab() {
  const [items, setItems] = useState<MergeItem[]>([])
  const [announcement, setAnnouncement] = useState("")
  const job = useJob()

  const reading = items.some((i) => i.pages === null)
  const totalPages = items.reduce((sum, i) => sum + (i.pages ?? 0), 0)
  const canMerge = items.length >= 2 && !reading && !job.busy

  function move(from: number, to: number) {
    const item = items[from]
    if (!item || to < 0 || to >= items.length) return
    setItems((prev) => moveItem(prev, from, to))
    setAnnouncement(`${item.file.name} moved to position ${to + 1} of ${items.length}`)
  }
  const reorder = useDragReorder(move)

  async function addFiles(files: File[]) {
    const added: MergeItem[] = files.map((file) => ({ id: nextId(), file, pages: null }))
    setItems((prev) => [...prev, ...added])
    for (const item of added) {
      try {
        const doc = await openPdfLib(item.file)
        const pages = doc.getPageCount()
        if (!pages) throw new Error("Invalid PDF: no pages")
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, pages } : i)))
      } catch (err) {
        setItems((prev) => prev.filter((i) => i.id !== item.id))
        toast.error(pdfErrorMessage(err), { description: item.file.name })
      }
    }
  }

  function remove(item: MergeItem) {
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    setAnnouncement(`${item.file.name} removed`)
  }

  async function merge() {
    const list = items
    const pageTotal = totalPages
    const ok = await job.run(async (step) => {
      const out = await newPdf()
      for (const [i, item] of list.entries()) {
        await step(i, list.length, `Adding ${item.file.name} (${i + 1} of ${list.length})`)
        let src: Awaited<ReturnType<typeof openPdfLib>>
        try {
          src = await openPdfLib(item.file)
        } catch (err) {
          // Say which file - it may have been moved or changed since it was added.
          throw new FriendlyError(pdfErrorMessage(err), item.file.name)
        }
        const pages = await out.copyPages(src, src.getPageIndices())
        pages.forEach((page) => out.addPage(page))
      }
      await step(list.length, list.length, "Saving merged.pdf...")
      saveBlob(pdfBlob(await out.save()), "merged.pdf")
    })
    if (ok) toast.success(`Merged ${list.length} PDFs - ${pagesLabel(pageTotal)}`)
  }

  return (
    <TwoColumn
      main={
        <Card>
          <CardContent className="space-y-4 p-3 sm:p-5">
            <FileDrop
              accept={PDF_ACCEPT}
              multiple
              maxBytes={MAX_PDF_BYTES}
              label={items.length ? "Add more PDFs" : "Drop PDFs here or click to choose"}
              hint="Up to 100 MB each"
              onFiles={addFiles}
              className={items.length ? "py-6" : undefined}
            />
            {items.length > 0 && (
              <ol className="space-y-2" aria-label="PDFs to merge, in order">
                {items.map((item, index) => (
                  <li
                    key={item.id}
                    {...reorder.itemProps(index)}
                    className={cn(
                      "bg-background flex items-center gap-2 rounded-sm border py-2 pr-1 pl-2",
                      reorder.overIndex === index && "border-primary ring-primary ring-1",
                      reorder.draggingIndex === index && "opacity-50",
                    )}
                  >
                    <GripVertical
                      aria-hidden="true"
                      className="text-muted-foreground hidden h-4 w-4 shrink-0 cursor-grab sm:block"
                    />
                    <span className="text-muted-foreground w-5 shrink-0 text-center text-xs tabular-nums">
                      {index + 1}
                    </span>
                    <FileText
                      aria-hidden="true"
                      className="text-muted-foreground hidden h-5 w-5 shrink-0 sm:block"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" title={item.file.name}>
                        {item.file.name}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {item.pages === null
                          ? "Reading..."
                          : `${pagesLabel(item.pages)} · ${formatBytes(item.file.size)}`}
                      </p>
                    </div>
                    <div className="flex shrink-0">
                      <MoveButtons
                        index={index}
                        count={items.length}
                        name={item.file.name}
                        onMove={move}
                        disabled={job.busy}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${item.file.name}`}
                        title="Remove"
                        className="text-muted-foreground hover:text-destructive"
                        disabled={job.busy}
                        onClick={() => remove(item)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <Announcer message={announcement} />
          </CardContent>
        </Card>
      }
      side={
        <>
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {items.length
                ? `${items.length} PDF${items.length === 1 ? "" : "s"}${reading ? "" : ` · ${pagesLabel(totalPages)}`}`
                : "No PDFs yet"}
            </p>
            <p className="text-muted-foreground text-xs">
              Pages are joined in the order shown. Drag a file to move it, or use the arrows.
            </p>
          </div>
          <Button className="w-full" disabled={!canMerge} loading={job.busy} onClick={merge}>
            {!job.busy && <Combine />}
            Merge PDFs
          </Button>
          {items.length === 1 && !job.busy && (
            <p className="text-muted-foreground -mt-2 text-xs">Add at least one more PDF.</p>
          )}
          <JobStatus progress={job.progress} onCancel={job.cancel} />
          {items.length > 1 && !job.busy && (
            <Button
              variant="ghost"
              className="text-muted-foreground w-full"
              onClick={() => {
                setItems([])
                setAnnouncement("All files removed")
              }}
            >
              Remove all
            </Button>
          )}
          <p className="text-muted-foreground text-xs leading-relaxed">
            Bookmarks and fillable form fields aren&apos;t carried into the merged file.
          </p>
        </>
      }
    />
  )
}
