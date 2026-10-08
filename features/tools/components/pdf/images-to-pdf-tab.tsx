"use client"

import { useState } from "react"
import type { PDFDocument, PDFImage } from "pdf-lib"
import { FileImage, GripVertical, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { FileDrop } from "../file-drop"
import { baseName, canvasToBlob, formatBytes, loadImage, saveBlob } from "../../lib/files"
import {
  IMAGE_ACCEPT,
  MAX_IMAGE_BYTES,
  imageKind,
  jpegOrientation,
  moveItem,
  pagesLabel,
  placeImage,
  safeRenderScale,
  type MarginOption,
  type PageSizeOption,
} from "../../lib/pdf"
import {
  Announcer,
  FriendlyError,
  JobStatus,
  MoveButtons,
  TwoColumn,
  newPdf,
  nextId,
  pdfBlob,
  releaseCanvas,
  useDragReorder,
  useJob,
  useObjectUrls,
} from "./shared"

interface ImageItem {
  id: number
  file: File
  url: string
}

const PAGE_SIZES: { value: PageSizeOption; label: string }[] = [
  { value: "a4-portrait", label: "A4 portrait" },
  { value: "a4-landscape", label: "A4 landscape" },
  { value: "fit", label: "Same as each image" },
]

const MARGINS: { value: MarginOption; label: string }[] = [
  { value: "none", label: "No margin" },
  { value: "small", label: "Small margin" },
  { value: "large", label: "Large margin" },
]

/** JPEG/PNG go in as-is; WebP, EXIF-rotated photos and files pdf-lib can't read are redrawn as JPEG. */
async function embedImage(
  doc: PDFDocument,
  file: File,
): Promise<{ image: PDFImage; width: number; height: number }> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const kind = imageKind(bytes)
  try {
    if (kind === "jpeg" && jpegOrientation(bytes) === 1) {
      const image = await doc.embedJpg(bytes)
      return { image, width: image.width, height: image.height }
    }
    if (kind === "png") {
      const image = await doc.embedPng(bytes)
      return { image, width: image.width, height: image.height }
    }
  } catch (err) {
    // Unusual JPEG / PNG flavours pdf-lib can't parse: fall through and redraw it.
    console.warn("[pdf-toolkit] embedding as-is failed, redrawing", file.name, err)
  }

  const img = await loadImage(file)
  const scale = safeRenderScale(img.naturalWidth, img.naturalHeight, 1)
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.floor(img.naturalWidth * scale))
  canvas.height = Math.max(1, Math.floor(img.naturalHeight * scale))
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Your browser couldn't create this file")
  // A page is white, so see-through parts of the image stay white too.
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  const jpeg = await canvasToBlob(canvas, "image/jpeg", 0.92)
  releaseCanvas(canvas)
  const image = await doc.embedJpg(await jpeg.arrayBuffer())
  return { image, width: image.width, height: image.height }
}

export function ImagesToPdfTab({ active }: { active: boolean }) {
  const [items, setItems] = useState<ImageItem[]>([])
  const [pageSize, setPageSize] = useState<PageSizeOption>("a4-portrait")
  const [margin, setMargin] = useState<MarginOption>("small")
  const [announcement, setAnnouncement] = useState("")
  const urls = useObjectUrls()
  const job = useJob()

  function move(from: number, to: number) {
    const item = items[from]
    if (!item || to < 0 || to >= items.length) return
    setItems((prev) => moveItem(prev, from, to))
    setAnnouncement(`${item.file.name} moved to position ${to + 1} of ${items.length}`)
  }
  const reorder = useDragReorder(move)

  function add(files: File[]) {
    const added = files.map((file) => ({ id: nextId(), file, url: urls.create(file) }))
    setItems((prev) => [...prev, ...added])
  }

  function remove(item: ImageItem) {
    urls.revoke(item.url)
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    setAnnouncement(`${item.file.name} removed`)
  }

  function removeAll() {
    items.forEach((i) => urls.revoke(i.url))
    setItems([])
    setAnnouncement("All images removed")
  }

  async function build() {
    const list = items
    const size = pageSize
    const gap = margin
    const ok = await job.run(async (step) => {
      const out = await newPdf()
      for (const [i, item] of list.entries()) {
        await step(i, list.length, `Adding image ${i + 1} of ${list.length}`)
        let placed: Awaited<ReturnType<typeof embedImage>>
        try {
          placed = await embedImage(out, item.file)
        } catch (err) {
          console.error("[pdf-toolkit]", err)
          // Name the image that failed - with 40 photos, "something went wrong" doesn't help.
          throw new FriendlyError(
            "Couldn't read this image - it may be damaged. Remove it and try again.",
            item.file.name,
          )
        }
        const spot = placeImage(placed.width, placed.height, size, gap)
        out.addPage([spot.pageWidth, spot.pageHeight]).drawImage(placed.image, {
          x: spot.x,
          y: spot.y,
          width: spot.width,
          height: spot.height,
        })
      }
      await step(list.length, list.length, "Saving...")
      const first = list[0]
      const name = list.length === 1 && first ? `${baseName(first.file.name)}.pdf` : "images.pdf"
      saveBlob(pdfBlob(await out.save()), name)
    })
    if (ok) toast.success(`Made a PDF with ${pagesLabel(list.length)}`)
  }

  return (
    <TwoColumn
      main={
        <Card>
          <CardContent className="space-y-4 p-3 sm:p-5">
            <FileDrop
              accept={IMAGE_ACCEPT}
              multiple
              maxBytes={MAX_IMAGE_BYTES}
              label={items.length ? "Add more images" : "Drop images here or click to choose"}
              hint="JPG, PNG or WebP - up to 25 MB each"
              allowPaste={active}
              onFiles={add}
              className={items.length ? "py-6" : undefined}
            />
            {items.length > 0 && (
              <ol className="space-y-2" aria-label="Images, in page order">
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
                    {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL, not a served image */}
                    <img
                      src={item.url}
                      alt=""
                      draggable={false}
                      className="bg-muted h-10 w-10 shrink-0 rounded-sm object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" title={item.file.name}>
                        {item.file.name}
                      </p>
                      <p className="text-muted-foreground text-xs">{formatBytes(item.file.size)}</p>
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
          <div className="space-y-2">
            <Label htmlFor="img-pdf-size">Page size</Label>
            <Select
              value={pageSize}
              onValueChange={(v) => setPageSize(v as PageSizeOption)}
              disabled={job.busy}
            >
              <SelectTrigger id="img-pdf-size">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="img-pdf-margin">Margin</Label>
            <Select
              value={margin}
              onValueChange={(v) => setMargin(v as MarginOption)}
              disabled={job.busy}
            >
              <SelectTrigger id="img-pdf-margin">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MARGINS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-muted-foreground text-xs">
            One image per page, in the order shown. Images are fitted to the page without cropping.
          </p>
          <Button
            className="w-full"
            disabled={!items.length || job.busy}
            loading={job.busy}
            onClick={build}
          >
            {!job.busy && <FileImage />}
            {items.length > 1 ? `Make PDF (${items.length} pages)` : "Make PDF"}
          </Button>
          <JobStatus progress={job.progress} onCancel={job.cancel} />
          {items.length > 1 && !job.busy && (
            <Button variant="ghost" className="text-muted-foreground w-full" onClick={removeAll}>
              Remove all
            </Button>
          )}
          <p className="text-muted-foreground text-xs leading-relaxed">
            iPhone HEIC photos? Turn them into JPG first with the Image Converter.
          </p>
        </>
      }
    />
  )
}
