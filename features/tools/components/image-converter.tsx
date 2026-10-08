"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  Download,
  ImageIcon,
  Info,
  Loader2,
  RefreshCw,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { useDebounce } from "@/hooks/use-debounce"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FileDrop } from "./file-drop"
import { PrivacyNote, ToolPage } from "./tool-page"
import { formatBytes, saveBlob, zipBlobs } from "../lib/files"
import {
  KIND_LABEL,
  OUTPUT_MIME,
  batchTotals,
  canEncode,
  convertJobKey,
  decodeHeic,
  decodeRaster,
  decodeSvg,
  encodeImage,
  errorText,
  imageKind,
  isLossy,
  outputName,
  thumbnailDataUrl,
  type ConvertSettings,
  type DecodedImage,
  type InputKind,
  type OutputFormat,
} from "../lib/images"

// Browsers often give HEIC photos an empty type, so the extensions matter.
const ACCEPT = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/x-ms-bmp",
  "image/svg+xml",
  "image/heic",
  "image/heif",
  "image/avif",
  ".jpg",
  ".jpeg",
  ".jfif",
  ".png",
  ".webp",
  ".gif",
  ".bmp",
  ".svg",
  ".heic",
  ".heif",
  ".avif",
]
const MAX_BYTES = 25 * 1024 * 1024
/** More than this in one go and a phone may run out of memory. */
const MAX_FILES = 100
const FORMATS: { value: OutputFormat; label: string; hint: string }[] = [
  {
    value: "jpeg",
    label: "JPG",
    hint: "Best for photos. Opens everywhere. Can't be see-through.",
  },
  {
    value: "png",
    label: "PNG",
    hint: "Keeps every pixel and see-through areas. Bigger files - best for logos and screenshots.",
  },
  {
    value: "webp",
    label: "WebP",
    hint: "Smaller than JPG and PNG, and can be see-through. Great for websites.",
  },
  {
    value: "avif",
    label: "AVIF",
    hint: "The smallest files, but some older apps can't open them.",
  },
]
const SVG_SIZES = [
  { value: "own", label: "As set in the file" },
  { value: "512", label: "512 px" },
  { value: "1024", label: "1024 px" },
  { value: "2048", label: "2048 px" },
  { value: "4096", label: "4096 px" },
] as const
const DEFAULT_BACKGROUND = "#ffffff"
const DEFAULT_SETTINGS: ConvertSettings = {
  format: "jpeg",
  quality: 90,
  background: DEFAULT_BACKGROUND,
  svgSize: 1024,
}

interface Result {
  blob: Blob
  name: string
  width: number
  height: number
}

interface Item {
  id: string
  file: File
  kind: InputKind
  /** Small preview (a data URL), made the first time the file is opened. */
  thumb?: string
  /** A HEIC photo already turned into PNG, so new settings don't redo the slow part. */
  heicPng?: Blob
  /** The settings key the result or error below was made with. */
  doneKey?: string
  result?: Result
  error?: string
}

async function convert(
  item: Item,
  s: ConvertSettings,
): Promise<{ result: Result; thumb?: string; heicPng?: Blob }> {
  if (!(await canEncode(OUTPUT_MIME[s.format]))) {
    throw new Error(`Your browser can't save ${KIND_LABEL[s.format]} files - pick another format`)
  }
  let src: DecodedImage
  let heicPng: Blob | undefined
  if (item.kind === "svg") {
    src = await decodeSvg(item.file, s.svgSize)
  } else if (item.kind === "heic" && !item.heicPng) {
    const opened = await decodeHeic(item.file)
    src = opened.decoded
    heicPng = opened.png
  } else {
    src = await decodeRaster(item.heicPng ?? item.file)
  }
  const thumb = item.thumb === undefined ? thumbnailDataUrl(src) : undefined
  const blob = await encodeImage(src, {
    width: src.width,
    height: src.height,
    format: s.format,
    quality: s.quality,
    background: s.format === "jpeg" ? s.background : undefined,
  })
  return {
    thumb,
    heicPng,
    result: {
      blob,
      name: outputName(item.file.name, item.kind, s.format),
      width: src.width,
      height: src.height,
    },
  }
}

export function ImageConverter() {
  const [items, setItems] = useState<Item[]>([])
  const [settings, setSettings] = useState<ConvertSettings>(DEFAULT_SETTINGS)
  const [webpOk, setWebpOk] = useState(true)
  const [avifOk, setAvifOk] = useState(false)
  const [zipping, setZipping] = useState(false)
  // Sliders and the colour picker fire on every step - redo the files once they stop.
  const applied = useDebounce(settings, 400)
  const busy = useRef(false)
  const nextId = useRef(0)

  useEffect(() => {
    let live = true
    void Promise.all([canEncode("image/webp"), canEncode("image/avif")]).then(([webp, avif]) => {
      if (!live) return
      setWebpOk(webp)
      setAvifOk(avif)
    })
    return () => {
      live = false
    }
  }, [])

  // One file at a time so a big batch can't exhaust memory: do the first stale file, repeat.
  useEffect(() => {
    if (busy.current) return
    const job = items.find((i) => i.doneKey !== convertJobKey(i.kind, applied))
    if (!job) return
    busy.current = true
    const key = convertJobKey(job.kind, applied)
    convert(job, applied).then(
      ({ result, thumb, heicPng }) => {
        busy.current = false
        setItems((prev) =>
          prev.map((i) =>
            i.id === job.id
              ? {
                  ...i,
                  doneKey: key,
                  result,
                  error: undefined,
                  thumb: i.thumb ?? thumb,
                  heicPng: i.heicPng ?? heicPng,
                }
              : i,
          ),
        )
      },
      (err: unknown) => {
        busy.current = false
        const message = errorText(err, "Couldn't open this image - it may be damaged")
        toast.error(`Couldn't convert ${job.file.name}`, {
          id: `convert-${job.id}`,
          description: message,
        })
        setItems((prev) =>
          prev.map((i) =>
            i.id === job.id ? { ...i, doneKey: key, result: undefined, error: message } : i,
          ),
        )
      },
    )
  }, [items, applied])

  const view = useMemo(() => {
    const pending = items.filter((i) => i.doneKey !== convertJobKey(i.kind, applied))
    const done = items.flatMap((i) =>
      i.doneKey === convertJobKey(i.kind, applied) && i.result
        ? [{ item: i, result: i.result }]
        : [],
    )
    return {
      pendingIds: new Set(pending.map((i) => i.id)),
      currentId: pending[0]?.id,
      finished: items.length - pending.length,
      done,
      failed: items.filter((i) => !pending.includes(i) && i.error).length,
      totals: batchTotals(
        done.map((d) => ({ before: d.item.file.size, after: d.result.blob.size })),
      ),
      hasSvg: items.some((i) => i.kind === "svg"),
      hasGif: items.some((i) => i.kind === "gif"),
      hasHeic: items.some((i) => i.kind === "heic"),
    }
  }, [items, applied])

  const working = view.pendingIds.size > 0
  const settling = settings !== applied
  const formats = FORMATS.filter((f) => f.value !== "avif" || avifOk)
  const formatHint = FORMATS.find((f) => f.value === settings.format)?.hint

  function update(patch: Partial<ConvertSettings>) {
    setSettings((s) => ({ ...s, ...patch }))
  }

  function addFiles(files: File[]) {
    const room = MAX_FILES - items.length
    if (room <= 0) {
      toast.error(`You can add up to ${MAX_FILES} images at a time`)
      return
    }
    if (files.length > room) {
      toast.error(`Added the first ${room} - up to ${MAX_FILES} images at a time`)
    }
    const added: Item[] = files.slice(0, room).map((file) => ({
      id: `img-${nextId.current++}`,
      file,
      kind: imageKind(file),
    }))
    setItems((prev) => [...prev, ...added])
  }

  function remove(id: string) {
    toast.dismiss(`convert-${id}`)
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  function clearAll() {
    for (const i of items) toast.dismiss(`convert-${i.id}`)
    setItems([])
  }

  async function downloadAll() {
    const files = view.done.map((d) => ({ name: d.result.name, blob: d.result.blob }))
    const [only] = files
    if (!only) return
    if (files.length === 1) {
      saveBlob(only.blob, only.name)
      return
    }
    setZipping(true)
    try {
      saveBlob(await zipBlobs(files), "converted-images.zip")
    } catch {
      toast.error("Couldn't make the ZIP - download the images one by one instead")
    } finally {
      setZipping(false)
    }
  }

  return (
    <ToolPage slug="image-converter">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="lg:col-start-1">
          <CardContent className="space-y-6 p-5">
            <div className="space-y-2">
              <FileDrop
                accept={ACCEPT}
                multiple
                maxBytes={MAX_BYTES}
                allowPaste
                onFiles={addFiles}
                label="Drop images here or click to choose"
                hint="iPhone HEIC, JPG, PNG, WebP, GIF, BMP or SVG - up to 25 MB each"
              />
              <PrivacyNote />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cv-format">Convert to</Label>
                <Select
                  value={settings.format}
                  onValueChange={(v) => update({ format: v as OutputFormat })}
                >
                  <SelectTrigger id="cv-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {formats.map((f) => {
                      const blocked = f.value === "webp" && !webpOk
                      return (
                        <SelectItem key={f.value} value={f.value} disabled={blocked}>
                          {blocked ? `${f.label} (not in this browser)` : f.label}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                {formatHint && <p className="text-muted-foreground text-xs">{formatHint}</p>}
              </div>

              {isLossy(settings.format) && (
                <div className="space-y-2">
                  <Label htmlFor="cv-quality">Quality: {settings.quality}</Label>
                  <input
                    id="cv-quality"
                    type="range"
                    min={10}
                    max={100}
                    step={1}
                    value={settings.quality}
                    onChange={(e) => update({ quality: Number(e.target.value) })}
                    aria-describedby="cv-quality-hint"
                    className="accent-primary w-full"
                  />
                  <p id="cv-quality-hint" className="text-muted-foreground text-xs">
                    90 looks the same as the original. Lower makes smaller files.
                  </p>
                </div>
              )}
            </div>

            {(settings.format === "jpeg" || view.hasSvg) && (
              <div className="grid gap-4 sm:grid-cols-2">
                {settings.format === "jpeg" && (
                  <div className="space-y-2">
                    <Label htmlFor="cv-background">Background for see-through areas</Label>
                    <div className="flex items-center gap-2">
                      <div className="border-input flex h-9 flex-1 items-center gap-2 rounded-sm border px-2">
                        <input
                          id="cv-background"
                          type="color"
                          value={settings.background}
                          onChange={(e) => update({ background: e.target.value })}
                          aria-describedby="cv-background-hint"
                          className="h-6 w-8 cursor-pointer rounded-sm border-0 bg-transparent p-0"
                        />
                        <span className="text-muted-foreground font-mono text-xs uppercase">
                          {settings.background}
                        </span>
                      </div>
                      {settings.background !== DEFAULT_BACKGROUND && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Reset background to white"
                          title="Reset to white"
                          className="text-muted-foreground"
                          onClick={() => update({ background: DEFAULT_BACKGROUND })}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <p id="cv-background-hint" className="text-muted-foreground text-xs">
                      JPG can&apos;t be see-through, so transparent parts get this colour.
                    </p>
                  </div>
                )}

                {view.hasSvg && (
                  <div className="space-y-2">
                    <Label htmlFor="cv-svg-size">SVG size (longest side)</Label>
                    <Select
                      value={settings.svgSize === null ? "own" : String(settings.svgSize)}
                      onValueChange={(v) => update({ svgSize: v === "own" ? null : Number(v) })}
                    >
                      <SelectTrigger id="cv-svg-size">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SVG_SIZES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-muted-foreground text-xs">
                      SVGs stay sharp at any size, so pick how big the picture should be.
                    </p>
                  </div>
                )}
              </div>
            )}

            {(view.hasHeic || view.hasGif) && (
              <div className="bg-muted/40 text-muted-foreground space-y-1.5 rounded-sm border p-3 text-xs leading-relaxed">
                {view.hasHeic && (
                  <p className="flex items-start gap-2">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>iPhone HEIC photos take a few seconds each to open.</span>
                  </p>
                )}
                {view.hasGif && (
                  <p className="flex items-start gap-2">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>Moving GIFs keep only their first frame.</span>
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div
          className={cn(
            "lg:sticky lg:top-20 lg:col-start-2 lg:row-start-1 lg:self-start",
            items.length > 0 && "lg:row-span-2",
          )}
        >
          <Card>
            <CardContent className="space-y-4 p-5">
              {items.length === 0 ? (
                <div className="text-muted-foreground flex flex-col items-center gap-2 px-4 py-8 text-center text-xs">
                  <RefreshCw className="h-8 w-8" />
                  Add some images - your converted files will be ready here.
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <p className="text-sm font-medium" aria-live="polite">
                      {working
                        ? `Converting ${view.finished + 1} of ${items.length}…`
                        : `${items.length} image${items.length === 1 ? "" : "s"} done`}
                    </p>
                    {working && (
                      <Progress
                        value={(view.finished / items.length) * 100}
                        aria-label="Conversion progress"
                      />
                    )}
                  </div>

                  {view.done.length > 0 && (
                    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
                      <dt className="text-muted-foreground">Before</dt>
                      <dd className="text-right tabular-nums">{formatBytes(view.totals.before)}</dd>
                      <dt className="text-muted-foreground">
                        After ({KIND_LABEL[applied.format]})
                      </dt>
                      <dd className="text-right tabular-nums">{formatBytes(view.totals.after)}</dd>
                    </dl>
                  )}

                  {view.failed > 0 && (
                    <p className="text-destructive flex items-start gap-2 text-xs">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {view.failed === 1
                        ? "1 image couldn't be converted - see the list."
                        : `${view.failed} images couldn't be converted - see the list.`}
                    </p>
                  )}

                  <div className="space-y-2">
                    <Button
                      className="w-full gap-1.5"
                      disabled={working || settling || view.done.length === 0}
                      loading={zipping}
                      onClick={downloadAll}
                    >
                      {!zipping && <Download className="h-4 w-4" />}
                      {view.done.length > 1 ? "Download all (ZIP)" : "Download"}
                    </Button>
                    <Button variant="outline" className="w-full gap-1.5" onClick={clearAll}>
                      <Trash2 className="h-4 w-4" />
                      Clear all
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {items.length > 0 && (
          <Card className="lg:col-start-1">
            <div className="border-b px-5 py-3">
              <h2 className="text-sm font-semibold">Your images ({items.length})</h2>
            </div>
            <ul className="divide-y">
              {items.map((item) => (
                <ImageRow
                  key={item.id}
                  item={item}
                  format={applied.format}
                  state={
                    view.pendingIds.has(item.id)
                      ? item.id === view.currentId
                        ? "working"
                        : "waiting"
                      : "done"
                  }
                  onRemove={() => remove(item.id)}
                />
              ))}
            </ul>
          </Card>
        )}
      </div>
    </ToolPage>
  )
}

function ImageRow({
  item,
  format,
  state,
  onRemove,
}: {
  item: Item
  format: OutputFormat
  state: "working" | "waiting" | "done"
  onRemove: () => void
}) {
  const result = state === "done" ? item.result : undefined
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      {item.thumb ? (
        // eslint-disable-next-line @next/next/no-img-element -- a local data URL, not a served image
        <img
          src={item.thumb}
          alt=""
          className="bg-muted h-12 w-12 shrink-0 rounded-sm border object-contain"
        />
      ) : (
        <div className="bg-muted text-muted-foreground flex h-12 w-12 shrink-0 items-center justify-center rounded-sm border">
          <ImageIcon className="h-5 w-5" />
        </div>
      )}

      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate text-sm font-medium" title={item.file.name}>
          {item.file.name}
        </p>
        {state === "working" && (
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {item.kind === "heic" && !item.heicPng ? "Opening iPhone photo…" : "Converting…"}
          </p>
        )}
        {state === "waiting" && (
          <p className="text-muted-foreground text-xs">
            {KIND_LABEL[item.kind]} · {formatBytes(item.file.size)} · Waiting…
          </p>
        )}
        {state === "done" && item.error && (
          <p className="text-destructive flex items-start gap-1.5 text-xs">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {item.error}
          </p>
        )}
        {result && (
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs tabular-nums">
            <span className="text-foreground font-medium">
              {KIND_LABEL[item.kind]} → {KIND_LABEL[format]}
            </span>
            <span>
              {formatBytes(item.file.size)} → {formatBytes(result.blob.size)}
            </span>
            <span>
              {result.width} × {result.height} px
            </span>
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {result && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Download ${result.name}`}
            title="Download"
            onClick={() => saveBlob(result.blob, result.name)}
          >
            <Download className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Remove ${item.file.name}`}
          title="Remove"
          className="text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </li>
  )
}
