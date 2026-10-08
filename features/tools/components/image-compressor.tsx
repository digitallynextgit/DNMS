"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ImageDown,
  ImageIcon,
  Info,
  Loader2,
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
import { formatBytes, saveBlob, savedPercent, zipBlobs } from "../lib/files"
import {
  batchTotals,
  canEncode,
  compressJobKey,
  compressOutput,
  decodeRaster,
  encodeImage,
  errorText,
  fitWithin,
  imageKind,
  outputName,
  thumbnailDataUrl,
  type CompressFormat,
  type CompressSettings,
  type InputKind,
} from "../lib/images"

const ACCEPT = ["image/jpeg", "image/png", "image/webp", ".jpg", ".jpeg", ".png", ".webp"]
const MAX_BYTES = 25 * 1024 * 1024
/** More than this in one go and a phone may run out of memory. */
const MAX_FILES = 100
const MAX_SIDES = [
  { value: "original", label: "Original size" },
  { value: "3840", label: "3840 px (4K)" },
  { value: "2560", label: "2560 px" },
  { value: "1920", label: "1920 px (Full HD)" },
  { value: "1280", label: "1280 px" },
  { value: "1080", label: "1080 px" },
] as const
const FORMATS: { value: CompressFormat; label: string }[] = [
  { value: "keep", label: "Keep original" },
  { value: "jpeg", label: "JPG" },
  { value: "webp", label: "WebP" },
]
const DEFAULT_SETTINGS: CompressSettings = { quality: 80, maxSide: null, format: "keep" }

interface Result {
  blob: Blob
  name: string
  width: number
  height: number
  /** A smaller file wasn't possible, so this is the original, untouched. */
  kept: boolean
  resized: boolean
}

interface Item {
  id: string
  file: File
  kind: InputKind
  /** Small preview (a data URL), made the first time the file is opened. */
  thumb?: string
  /** The settings key the result or error below was made with. */
  doneKey?: string
  result?: Result
  error?: string
}

async function compress(
  item: Item,
  s: CompressSettings,
): Promise<{ result: Result; thumb?: string }> {
  const out = compressOutput(item.kind, s.format)
  if (out === "webp" && !(await canEncode("image/webp"))) {
    throw new Error("Your browser can't save WebP files - pick JPG, or use Chrome or Edge")
  }
  const src = await decodeRaster(item.file)
  const thumb = item.thumb === undefined ? thumbnailDataUrl(src) : undefined
  const size = fitWithin(src.width, src.height, s.maxSide)
  const blob = await encodeImage(src, {
    width: size.width,
    height: size.height,
    format: out,
    quality: s.quality,
    // JPG can't be see-through: transparent areas go white, not black.
    background: out === "jpeg" ? "#ffffff" : undefined,
  })
  if (blob.size >= item.file.size) {
    return {
      thumb,
      result: {
        blob: item.file,
        name: item.file.name,
        width: src.width,
        height: src.height,
        kept: true,
        resized: false,
      },
    }
  }
  return {
    thumb,
    result: {
      blob,
      name: outputName(item.file.name, item.kind, out),
      width: size.width,
      height: size.height,
      kept: false,
      resized: size.resized,
    },
  }
}

export function ImageCompressor() {
  const [items, setItems] = useState<Item[]>([])
  const [settings, setSettings] = useState<CompressSettings>(DEFAULT_SETTINGS)
  const [webpOk, setWebpOk] = useState(true)
  const [zipping, setZipping] = useState(false)
  // The quality slider fires on every step of a drag - redo the files once it stops.
  const applied = useDebounce(settings, 400)
  const busy = useRef(false)
  const nextId = useRef(0)

  useEffect(() => {
    let live = true
    void canEncode("image/webp").then((ok) => {
      if (live) setWebpOk(ok)
    })
    return () => {
      live = false
    }
  }, [])

  // One file at a time so a big batch can't exhaust memory: do the first stale file, repeat.
  useEffect(() => {
    if (busy.current) return
    const job = items.find((i) => i.doneKey !== compressJobKey(i.kind, applied))
    if (!job) return
    busy.current = true
    const key = compressJobKey(job.kind, applied)
    compress(job, applied).then(
      ({ result, thumb }) => {
        busy.current = false
        setItems((prev) =>
          prev.map((i) =>
            i.id === job.id
              ? { ...i, doneKey: key, result, error: undefined, thumb: i.thumb ?? thumb }
              : i,
          ),
        )
      },
      (err: unknown) => {
        busy.current = false
        const message = errorText(err, "Couldn't open this image - it may be damaged")
        toast.error(`Couldn't compress ${job.file.name}`, {
          id: `compress-${job.id}`,
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
    const pending = items.filter((i) => i.doneKey !== compressJobKey(i.kind, applied))
    const done = items.flatMap((i) =>
      i.doneKey === compressJobKey(i.kind, applied) && i.result
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
    }
  }, [items, applied])

  const working = view.pendingIds.size > 0
  const settling = settings !== applied

  function update(patch: Partial<CompressSettings>) {
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
    toast.dismiss(`compress-${id}`)
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  function clearAll() {
    for (const i of items) toast.dismiss(`compress-${i.id}`)
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
      saveBlob(await zipBlobs(files), "compressed-images.zip")
    } catch {
      toast.error("Couldn't make the ZIP - download the images one by one instead")
    } finally {
      setZipping(false)
    }
  }

  return (
    <ToolPage slug="image-compressor">
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
                hint="JPG, PNG or WebP - up to 25 MB each. Add as many as you like."
              />
              <PrivacyNote />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ic-quality">Quality: {settings.quality}</Label>
              <input
                id="ic-quality"
                type="range"
                min={10}
                max={100}
                step={1}
                value={settings.quality}
                onChange={(e) => update({ quality: Number(e.target.value) })}
                aria-describedby="ic-quality-hint"
                className="accent-primary w-full"
              />
              <p id="ic-quality-hint" className="text-muted-foreground text-xs">
                80 is a good balance. Lower makes smaller files, but photos can start to look
                blurry.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ic-max-size">Max size (longest side)</Label>
                <Select
                  value={settings.maxSide === null ? "original" : String(settings.maxSide)}
                  onValueChange={(v) => update({ maxSide: v === "original" ? null : Number(v) })}
                >
                  <SelectTrigger id="ic-max-size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MAX_SIDES.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  Smaller images are never made bigger.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ic-format">Save as</Label>
                <Select
                  value={settings.format}
                  onValueChange={(v) => update({ format: v as CompressFormat })}
                >
                  <SelectTrigger id="ic-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMATS.map((f) => {
                      const blocked = f.value === "webp" && !webpOk
                      return (
                        <SelectItem key={f.value} value={f.value} disabled={blocked}>
                          {blocked ? `${f.label} (not in this browser)` : f.label}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  WebP is usually the smallest, and works on all modern websites.
                </p>
              </div>
            </div>

            <div className="bg-muted/40 text-muted-foreground space-y-1.5 rounded-sm border p-3 text-xs leading-relaxed">
              <p className="flex items-start gap-2">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  PNG files are saved without any loss, so the quality slider doesn&apos;t change
                  them. A PNG only gets smaller when you pick a max size or save it as WebP.
                </span>
              </p>
              {settings.format === "jpeg" && (
                <p className="flex items-start gap-2">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>JPG can&apos;t be see-through, so transparent areas turn white.</span>
                </p>
              )}
              <p className="flex items-start gap-2">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  If an image can&apos;t get any smaller, you get the original back, marked
                  &ldquo;Already optimised&rdquo;.
                </span>
              </p>
            </div>
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
                  <ImageDown className="h-8 w-8" />
                  Add some images - you&apos;ll see how much smaller each one gets.
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <p className="text-sm font-medium" aria-live="polite">
                      {working
                        ? `Compressing ${view.finished + 1} of ${items.length}…`
                        : `${items.length} image${items.length === 1 ? "" : "s"} done`}
                    </p>
                    {working && (
                      <Progress
                        value={(view.finished / items.length) * 100}
                        aria-label="Compression progress"
                      />
                    )}
                  </div>

                  {view.done.length > 0 && (
                    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
                      <dt className="text-muted-foreground">Before</dt>
                      <dd className="text-right tabular-nums">{formatBytes(view.totals.before)}</dd>
                      <dt className="text-muted-foreground">After</dt>
                      <dd className="text-right tabular-nums">{formatBytes(view.totals.after)}</dd>
                      <dt className="text-muted-foreground">You saved</dt>
                      <dd
                        className={cn(
                          "text-right font-semibold tabular-nums",
                          view.totals.saved > 0 && "text-emerald-600 dark:text-emerald-400",
                        )}
                      >
                        {view.totals.saved > 0
                          ? `${formatBytes(view.totals.saved)} (${view.totals.percent}%)`
                          : "-"}
                      </dd>
                    </dl>
                  )}

                  {view.failed > 0 && (
                    <p className="text-destructive flex items-start gap-2 text-xs">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {view.failed === 1
                        ? "1 image couldn't be compressed - see the list."
                        : `${view.failed} images couldn't be compressed - see the list.`}
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
  state,
  onRemove,
}: {
  item: Item
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
            Compressing…
          </p>
        )}
        {state === "waiting" && (
          <p className="text-muted-foreground text-xs">{formatBytes(item.file.size)} · Waiting…</p>
        )}
        {state === "done" && item.error && (
          <p className="text-destructive flex items-start gap-1.5 text-xs">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {item.error}
          </p>
        )}
        {result && (
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs tabular-nums">
            {result.kept ? (
              <>
                <span>{formatBytes(item.file.size)}</span>
                <span className="text-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  Already optimised
                </span>
              </>
            ) : (
              <>
                <span>
                  {formatBytes(item.file.size)} → {formatBytes(result.blob.size)}
                </span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  {savedPercent(item.file.size, result.blob.size)}% smaller
                </span>
                {result.resized && (
                  <span>
                    {result.width} × {result.height} px
                  </span>
                )}
              </>
            )}
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
