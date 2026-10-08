"use client"

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, Copy, Download, ImagePlus, QrCode, RotateCcw, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { buildQr, colourProblem, drawQr, qrFileName, qrToSvg, type QrStyle } from "../lib/qr"

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"]
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
/** On-screen preview size, CSS px. */
const PREVIEW_PX = 288
const DOWNLOAD_SIZES = [
  { value: "512", label: "Small - 512 px" },
  { value: "1024", label: "Medium - 1024 px" },
  { value: "2048", label: "Large - 2048 px (print)" },
] as const
type DownloadSize = (typeof DOWNLOAD_SIZES)[number]["value"]
const DEFAULT_DARK = "#000000"
const DEFAULT_LIGHT = "#ffffff"

interface CentreImage {
  src: string
  el: HTMLImageElement
  aspect: number
  name: string
}

export function QrCodeGenerator() {
  const [text, setText] = useState("")
  const [image, setImage] = useState<CentreImage | null>(null)
  const [imageScale, setImageScale] = useState(0.22)
  const [imagePlate, setImagePlate] = useState(true)
  const [dark, setDark] = useState(DEFAULT_DARK)
  const [light, setLight] = useState(DEFAULT_LIGHT)
  const [downloadSize, setDownloadSize] = useState<DownloadSize>("1024")
  const fileInput = useRef<HTMLInputElement>(null)
  const preview = useRef<HTMLCanvasElement>(null)

  // Typing stays snappy on long text: the code catches up a beat later.
  const deferredText = useDeferredValue(text)
  const build = useMemo(() => buildQr(deferredText, !!image), [deferredText, image])
  const style: QrStyle = { dark, light, imageScale, imagePlate }
  const problem = colourProblem(dark, light)

  useEffect(() => {
    const canvas = preview.current
    if (!canvas || !build.ok) return
    const dpr = window.devicePixelRatio || 1
    const px = Math.round(PREVIEW_PX * dpr)
    canvas.width = px
    canvas.height = px
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    drawQr(ctx, px, build.matrix, { dark, light, imageScale, imagePlate }, image ?? undefined)
  }, [build, dark, light, imageScale, imagePlate, image])

  function pickImage(file: File | undefined) {
    if (!file) return
    if (!IMAGE_TYPES.includes(file.type)) {
      toast.error("Pick a PNG, JPG, WebP, SVG or GIF image")
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("That image is over 5 MB - pick a smaller one")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const src = String(reader.result)
      const el = new Image()
      el.onload = () => {
        // An SVG without a set size reports 0 - treat it as square.
        const aspect = el.naturalWidth && el.naturalHeight ? el.naturalWidth / el.naturalHeight : 1
        setImage({ src, el, aspect, name: file.name })
      }
      el.onerror = () => toast.error("Couldn't read that image")
      el.src = src
    }
    reader.onerror = () => toast.error("Couldn't read that image")
    reader.readAsDataURL(file)
  }

  function renderPng(): Promise<Blob | null> {
    if (!build.ok) return Promise.resolve(null)
    const px = Number(downloadSize)
    const canvas = document.createElement("canvas")
    canvas.width = px
    canvas.height = px
    const ctx = canvas.getContext("2d")
    if (!ctx) return Promise.resolve(null)
    drawQr(ctx, px, build.matrix, style, image ?? undefined)
    return new Promise((resolve) => canvas.toBlob(resolve, "image/png"))
  }

  function save(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function downloadPng() {
    const blob = await renderPng()
    if (blob) save(blob, qrFileName(text, "png"))
  }

  function downloadSvg() {
    if (!build.ok) return
    const svg = qrToSvg(build.matrix, style, image ?? undefined)
    save(new Blob([svg], { type: "image/svg+xml" }), qrFileName(text, "svg"))
  }

  async function copyImage() {
    try {
      const blob = await renderPng()
      if (!blob) return
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])
      toast.success("QR code copied - paste it anywhere")
    } catch {
      toast.error("Your browser blocked copying - use Download PNG instead")
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="QR Code Generator"
        description="Turn a link or text into a QR code. Add your own image in the middle if you like."
        backHref="/tools"
        backLabel="Back to tools"
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardContent className="space-y-6 p-5">
            <div className="space-y-2">
              <Label required htmlFor="qr-text">
                Link or text
              </Label>
              <Textarea
                id="qr-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="https://www.digitallynext.com"
                rows={3}
              />
              <p className="text-muted-foreground text-xs">
                A website, a phone number, a Wi-Fi note - anything up to a few hundred characters.
                Shorter text makes a simpler code that scans more easily.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <Label>Image in the middle (optional)</Label>
                <p className="text-muted-foreground text-xs">
                  Your logo or photo. It stays on your computer - nothing is uploaded.
                </p>
              </div>
              <input
                ref={fileInput}
                type="file"
                accept={IMAGE_TYPES.join(",")}
                className="hidden"
                onChange={(e) => {
                  pickImage(e.target.files?.[0])
                  e.target.value = ""
                }}
              />
              {image ? (
                <div className="flex items-center gap-3 rounded-sm border p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a local data URL, not a served image */}
                  <img
                    src={image.src}
                    alt=""
                    className="bg-muted h-12 w-12 shrink-0 rounded-sm object-contain"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">{image.name}</span>
                  <Button variant="outline" onClick={() => fileInput.current?.click()}>
                    Change
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove image"
                    title="Remove image"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setImage(null)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => fileInput.current?.click()}
                >
                  <ImagePlus className="h-4 w-4" />
                  Upload image
                </Button>
              )}

              {image && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="qr-image-size">
                      Image size: {Math.round(imageScale * 100)}%
                    </Label>
                    <input
                      id="qr-image-size"
                      type="range"
                      min={0.15}
                      max={0.3}
                      step={0.01}
                      value={imageScale}
                      onChange={(e) => setImageScale(Number(e.target.value))}
                      className="accent-primary w-full"
                    />
                  </div>
                  <div className="flex items-center gap-3 sm:pt-6">
                    <Switch
                      id="qr-image-plate"
                      checked={imagePlate}
                      onCheckedChange={setImagePlate}
                    />
                    <Label htmlFor="qr-image-plate" className="mb-0 font-normal">
                      Plain background behind the image
                    </Label>
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <ColourField id="qr-dark" label="QR colour" value={dark} onChange={setDark} />
              <ColourField id="qr-light" label="Background" value={light} onChange={setLight} />
              <div className="space-y-2">
                <Label>Download size</Label>
                <Select
                  value={downloadSize}
                  onValueChange={(v) => setDownloadSize(v as DownloadSize)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOWNLOAD_SIZES.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {(dark !== DEFAULT_DARK || light !== DEFAULT_LIGHT) && (
              <Button
                variant="ghost"
                className="text-muted-foreground -mt-2 gap-1.5 px-2"
                onClick={() => {
                  setDark(DEFAULT_DARK)
                  setLight(DEFAULT_LIGHT)
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset colours
              </Button>
            )}
            {problem && (
              <p className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {problem === "inverted"
                  ? "Many phones can't scan a light code on a dark background. Keep the QR colour darker than the background."
                  : "These colours are too close - some phones won't scan it. Pick a darker QR colour or a lighter background."}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardContent className="space-y-4 p-5">
              <div
                className="bg-muted/40 mx-auto flex items-center justify-center overflow-hidden rounded-sm border"
                style={{ width: PREVIEW_PX, height: PREVIEW_PX, maxWidth: "100%" }}
              >
                {build.ok ? (
                  <canvas
                    ref={preview}
                    aria-label="QR code preview"
                    role="img"
                    style={{ width: PREVIEW_PX, height: PREVIEW_PX, maxWidth: "100%" }}
                  />
                ) : (
                  <div className="text-muted-foreground flex flex-col items-center gap-2 px-6 text-center text-xs">
                    <QrCode className="h-8 w-8" />
                    {build.reason === "empty"
                      ? "Type a link or text to see your QR code"
                      : "That's too much text for one QR code - shorten it, or use a link instead"}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button className="gap-1.5" disabled={!build.ok} onClick={downloadPng}>
                  <Download className="h-4 w-4" />
                  Download PNG
                </Button>
                <Button
                  variant="outline"
                  className="gap-1.5"
                  disabled={!build.ok}
                  onClick={downloadSvg}
                >
                  <Download className="h-4 w-4" />
                  Download SVG
                </Button>
              </div>
              <Button
                variant="outline"
                className="w-full gap-1.5"
                disabled={!build.ok}
                onClick={copyImage}
              >
                <Copy className="h-4 w-4" />
                Copy image
              </Button>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Scan it with your phone camera before you print or share it. PNG is best for chats
                and slides; SVG stays sharp at any size, for print and designers.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function ColourField({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="border-input flex h-9 items-center gap-2 rounded-sm border px-2">
        <input
          id={id}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-8 cursor-pointer rounded-sm border-0 bg-transparent p-0"
        />
        <span className="text-muted-foreground font-mono text-xs uppercase">{value}</span>
      </div>
    </div>
  )
}
