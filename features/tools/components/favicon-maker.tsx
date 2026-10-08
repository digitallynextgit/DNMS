"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  Copy,
  Download,
  FileArchive,
  FileCode,
  ImageIcon,
  Lock,
  Plus,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { SegmentedControl } from "@/components/shared/segmented-control"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import {
  FAVICON_FILES,
  buildIco,
  buildWebManifest,
  contentBox,
  cornerRadius,
  faviconHtml,
  faviconZipName,
  logoBox,
  svgSizing,
  type Box,
  type FaviconFile,
  type IconKind,
  type IconShape,
} from "../lib/favicon"
import { canvasToBlob, fileMatches, formatBytes, loadImage, saveBlob, zipBlobs } from "../lib/files"
import { FileDrop } from "./file-drop"
import { PrivacyNote, ToolPage } from "./tool-page"

const ACCEPT = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".svg",
]
const MAX_BYTES = 10 * 1024 * 1024
/** Below this a raster logo gets stretched for the 512 px Android icon. */
const SHARP_PX = 512

type Background = "transparent" | "colour"

interface Logo {
  name: string
  bytes: number
  el: HTMLImageElement
  width: number
  height: number
  isSvg: boolean
  /** The non-see-through part, when the logo has empty space round it. */
  content: Box | null
}

interface IconOptions {
  padding: number
  trim: boolean
  /** Null = see-through. */
  background: string | null
  /** The iPhone icon is never see-through. */
  appleBackground: string
  shape: IconShape
}

export function FaviconMaker() {
  const [logo, setLogo] = useState<Logo | null>(null)
  const [opening, setOpening] = useState(false)
  const [siteName, setSiteName] = useState("")
  const [padding, setPadding] = useState(0)
  const [trim, setTrim] = useState(true)
  const [bgMode, setBgMode] = useState<Background>("transparent")
  const [bgColour, setBgColour] = useState("#ffffff")
  const [appleBg, setAppleBg] = useState("#ffffff")
  const [shape, setShape] = useState<IconShape>("square")
  const [busy, setBusy] = useState<string | null>(null)
  const changeInput = useRef<HTMLInputElement>(null)

  const opts = useMemo<IconOptions>(
    () => ({
      padding,
      trim,
      background: bgMode === "colour" ? bgColour : null,
      appleBackground: bgMode === "colour" ? bgColour : appleBg,
      shape,
    }),
    [padding, trim, bgMode, bgColour, appleBg, shape],
  )
  const themeColour = bgMode === "colour" ? bgColour : "#ffffff"
  const html = faviconHtml(themeColour)
  const title = siteName.trim() || "Your website"

  const area = logo ? logoArea(logo, trim) : null
  // Judged on the part that's used: a trimmed logo can be much smaller than its file.
  const small = !!logo && !!area && !logo.isSvg && Math.max(area.w, area.h) < SHARP_PX
  const notSquare = area ? Math.abs(area.w / area.h - 1) > 0.05 : false

  async function openFile(file: File | undefined) {
    if (!file) return
    if (!fileMatches(file, ACCEPT)) {
      toast.error("Pick a PNG, JPG, WebP or SVG image")
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error(`That image is over ${formatBytes(MAX_BYTES)} - pick a smaller one`)
      return
    }
    setOpening(true)
    try {
      const isSvg = file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg")
      const img = await loadImage(isSvg ? await sizedSvg(file) : file)
      if (!img.naturalWidth || !img.naturalHeight) throw new Error("no size")
      const content = findContent(img)
      if (content === "empty") {
        toast.error("That image looks empty - it's all see-through")
        return
      }
      setLogo({
        name: file.name,
        bytes: file.size,
        el: img,
        width: img.naturalWidth,
        height: img.naturalHeight,
        isSvg,
        content,
      })
    } catch {
      toast.error("Couldn't open that image - try a PNG, JPG, WebP or SVG")
    } finally {
      setOpening(false)
    }
  }

  async function renderPng(size: number, kind: IconKind): Promise<Blob> {
    if (!logo) throw new Error("Add a logo first")
    const canvas = document.createElement("canvas")
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Your browser couldn't draw the icon")
    drawIcon(ctx, size, logo, opts, kind)
    return canvasToBlob(canvas, "image/png")
  }

  async function makeFile(f: FaviconFile): Promise<Blob> {
    if (f.type === "png") return renderPng(f.size, f.kind)
    if (f.type === "ico") {
      const pngs = await Promise.all(f.sizes.map((s) => renderPng(s, "favicon")))
      const bytes = await Promise.all(pngs.map((b) => b.arrayBuffer()))
      const ico = buildIco(f.sizes.map((size, i) => ({ size, png: new Uint8Array(bytes[i]!) })))
      return new Blob([ico], { type: "image/x-icon" })
    }
    const manifest = buildWebManifest({
      name: siteName,
      themeColour,
      backgroundColour: themeColour,
    })
    return new Blob([manifest], { type: "application/manifest+json" })
  }

  async function downloadFile(f: FaviconFile) {
    setBusy(f.name)
    try {
      saveBlob(await makeFile(f), f.name)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't make that file")
    } finally {
      setBusy(null)
    }
  }

  async function downloadAll() {
    setBusy("zip")
    try {
      const files = await Promise.all(
        FAVICON_FILES.map(async (f) => ({ name: f.name, blob: await makeFile(f) })),
      )
      saveBlob(await zipBlobs(files), faviconZipName(siteName))
      toast.success("All icons saved as one ZIP")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't make the icons")
    } finally {
      setBusy(null)
    }
  }

  async function copyHtml() {
    try {
      await navigator.clipboard.writeText(html)
      toast.success("Copied - paste it inside <head>")
    } catch {
      toast.error("Your browser blocked copying - select the code and copy it yourself")
    }
  }

  return (
    <ToolPage slug="favicon-maker">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="min-w-0 lg:col-start-1 lg:row-start-1">
          <CardContent className="space-y-6 p-5">
            <div className="space-y-2">
              <Label>Your logo</Label>
              {logo ? (
                <div className="flex items-center gap-3 rounded-sm border p-3">
                  <ImageIcon className="text-muted-foreground h-5 w-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{logo.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {logo.isSvg
                        ? "SVG - sharp at every size"
                        : `${logo.width} x ${logo.height} px`}{" "}
                      · {formatBytes(logo.bytes)}
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => changeInput.current?.click()}>
                    Change
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove logo"
                    title="Remove logo"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setLogo(null)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <input
                    ref={changeInput}
                    type="file"
                    accept={ACCEPT.join(",")}
                    className="hidden"
                    onChange={(e) => {
                      void openFile(e.target.files?.[0])
                      e.target.value = ""
                    }}
                  />
                </div>
              ) : (
                <FileDrop
                  accept={ACCEPT}
                  maxBytes={MAX_BYTES}
                  allowPaste
                  onFiles={(files) => void openFile(files[0])}
                  label={
                    opening ? "Opening your logo..." : "Drop your logo here or click to choose"
                  }
                  hint="PNG, JPG, WebP or SVG - square works best, 512 px or bigger"
                />
              )}
              {small && (
                <p className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Your logo is quite small, so the big phone icons may look soft. A PNG of 512 px or
                  more - or an SVG - works best.
                </p>
              )}
              {notSquare && (
                <p className="text-muted-foreground text-xs">
                  Your logo isn&apos;t square, so it&apos;s centred with space around it.
                </p>
              )}
            </div>

            {logo?.content && (
              <div className="flex items-start gap-3">
                <Switch id="fm-trim" checked={trim} onCheckedChange={setTrim} />
                <div>
                  <Label htmlFor="fm-trim" className="mb-1 font-normal">
                    Trim the empty space around the logo
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    Makes the logo as big as it can be in the tiny tab icon.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="fm-name">Website name (optional)</Label>
              <Input
                id="fm-name"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="Digitally Next"
                maxLength={60}
              />
              <p className="text-muted-foreground text-xs">
                Shown under the icon when someone adds your site to their phone&apos;s home screen.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fm-padding">Padding: {padding}%</Label>
              <input
                id="fm-padding"
                type="range"
                min={0}
                max={30}
                step={1}
                value={padding}
                onChange={(e) => setPadding(Number(e.target.value))}
                className="accent-primary w-full"
              />
              <p className="text-muted-foreground text-xs">
                Space between your logo and the edge of the icon. Less padding makes the tab icon
                easier to see.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Background</Label>
                <SegmentedControl
                  aria-label="Background"
                  value={bgMode}
                  onChange={setBgMode}
                  options={[
                    { value: "transparent", label: "See-through" },
                    { value: "colour", label: "Colour" },
                  ]}
                />
              </div>
              {bgMode === "colour" ? (
                <ColourField
                  id="fm-bg"
                  label="Background colour"
                  value={bgColour}
                  onChange={setBgColour}
                />
              ) : (
                <ColourField
                  id="fm-apple-bg"
                  label="iPhone icon background"
                  value={appleBg}
                  onChange={setAppleBg}
                />
              )}
            </div>
            {bgMode === "transparent" && (
              <p className="text-muted-foreground -mt-3 text-xs">
                iPhones show see-through parts as black, so the iPhone icon always gets a solid
                background.
              </p>
            )}

            <div className="space-y-2">
              <Label>Corners</Label>
              <SegmentedControl
                aria-label="Corners"
                value={shape}
                onChange={setShape}
                options={[
                  { value: "square", label: "Square" },
                  { value: "rounded", label: "Rounded" },
                  { value: "circle", label: "Circle" },
                ]}
              />
              <p className="text-muted-foreground text-xs">
                For the tab and Android icons. iPhones round their icon themselves, so it stays
                square.
              </p>
              {shape !== "square" && padding < 10 && logo && (
                <p className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Add some padding so the corners don&apos;t cut off the edges of your logo.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="lg:sticky lg:top-20 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          <Card>
            <CardContent className="space-y-4 p-5">
              <p className="text-sm font-medium">Preview</p>
              <BrowserTab dark={false} logo={logo} opts={opts} title={title} />
              <BrowserTab dark logo={logo} opts={opts} title={title} />
              <PhoneScreen logo={logo} opts={opts} title={title} />

              <div className="space-y-2">
                <p className="text-muted-foreground text-xs">Real size</p>
                <div className="bg-muted/60 flex items-end gap-4 rounded-sm p-3">
                  {[16, 32, 48].map((s) => (
                    <div key={s} className="flex flex-col items-center gap-1">
                      <IconPreview logo={logo} opts={opts} kind="favicon" size={s} display={s} />
                      <span className="text-muted-foreground text-[10px]">{s} px</span>
                    </div>
                  ))}
                  <div className="flex flex-col items-center gap-1">
                    <IconPreview logo={logo} opts={opts} kind="android" size={192} display={48} />
                    <span className="text-muted-foreground text-[10px]">Android</span>
                  </div>
                </div>
              </div>

              <Button
                className="w-full gap-1.5"
                disabled={!logo || busy !== null}
                loading={busy === "zip"}
                onClick={downloadAll}
              >
                {busy !== "zip" && <FileArchive className="h-4 w-4" />}
                Download all (ZIP)
              </Button>
              <PrivacyNote />
            </CardContent>
          </Card>
        </div>

        <Card className="min-w-0 lg:col-start-1 lg:row-start-2">
          <CardContent className="space-y-5 p-5">
            <div>
              <h2 className="text-sm font-semibold">Your files</h2>
              <p className="text-muted-foreground text-xs">
                Download them all as a ZIP, or one at a time.
              </p>
            </div>
            <ul className="divide-y rounded-sm border">
              {FAVICON_FILES.map((f) => (
                <li key={f.name} className="flex items-center gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs">{f.name}</p>
                    <p className="text-muted-foreground text-xs">{f.label}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Download ${f.name}`}
                    title={`Download ${f.name}`}
                    disabled={!logo || busy !== null}
                    loading={busy === f.name}
                    onClick={() => downloadFile(f)}
                  >
                    {busy !== f.name && <Download className="h-4 w-4" />}
                  </Button>
                </li>
              ))}
            </ul>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="mb-0 flex items-center gap-1.5">
                  <FileCode className="h-4 w-4" />
                  Code for your website
                </Label>
                <Button variant="outline" className="gap-1.5" onClick={copyHtml}>
                  <Copy className="h-4 w-4" />
                  Copy
                </Button>
              </div>
              <pre className="bg-muted overflow-x-auto rounded-sm p-3 font-mono text-xs leading-relaxed">
                <code>{html}</code>
              </pre>
              <p className="text-muted-foreground text-xs">
                Put these files in your site&apos;s root folder (next to the home page), then paste
                the code inside the &lt;head&gt; of every page.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </ToolPage>
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

function IconPreview({
  logo,
  opts,
  kind,
  size,
  display,
  className,
}: {
  logo: Logo | null
  opts: IconOptions
  kind: IconKind
  size: number
  display: number
  className?: string
}) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const c = canvas.current
    if (!c || !logo) return
    c.width = size
    c.height = size
    const ctx = c.getContext("2d")
    if (!ctx) return
    drawIcon(ctx, size, logo, opts, kind)
  }, [logo, opts, kind, size])

  if (!logo) {
    return (
      <span
        aria-hidden="true"
        className={cn("bg-muted-foreground/25 block shrink-0 rounded-[3px]", className)}
        style={{ width: display, height: display }}
      />
    )
  }
  return (
    <canvas
      ref={canvas}
      aria-hidden="true"
      className={cn("block shrink-0", className)}
      style={{ width: display, height: display }}
    />
  )
}

function BrowserTab({
  dark,
  logo,
  opts,
  title,
}: {
  dark: boolean
  logo: Logo | null
  opts: IconOptions
  title: string
}) {
  return (
    <div
      role="img"
      aria-label={`Your icon in a ${dark ? "dark" : "light"} browser tab`}
      className={cn(
        "overflow-hidden rounded-sm border",
        dark ? "border-neutral-700 bg-[#202124]" : "border-neutral-200 bg-[#dee1e6]",
      )}
    >
      <div className="flex items-end gap-2 px-2 pt-2">
        <div
          className={cn(
            "flex h-8 max-w-[13rem] min-w-0 flex-1 items-center gap-2 rounded-t-lg px-3",
            dark ? "bg-[#35363a] text-neutral-100" : "bg-white text-neutral-800",
          )}
        >
          {/* 32 px drawn at 16: what a sharp screen shows. */}
          <IconPreview logo={logo} opts={opts} kind="favicon" size={32} display={16} />
          <span className="min-w-0 flex-1 truncate text-xs">{title}</span>
          <X className="h-3 w-3 shrink-0 opacity-60" />
        </div>
        <Plus
          className={cn(
            "mb-2 h-3.5 w-3.5 shrink-0",
            dark ? "text-neutral-400" : "text-neutral-600",
          )}
        />
      </div>
      <div className={cn("px-3 py-1.5", dark ? "bg-[#35363a]" : "bg-white")}>
        <div
          className={cn(
            "flex h-6 items-center gap-1.5 rounded-full px-3 text-[11px]",
            dark ? "bg-[#202124] text-neutral-400" : "bg-[#f1f3f4] text-neutral-500",
          )}
        >
          <Lock className="h-3 w-3 shrink-0" />
          <span className="truncate">yourwebsite.com</span>
        </div>
      </div>
    </div>
  )
}

function PhoneScreen({
  logo,
  opts,
  title,
}: {
  logo: Logo | null
  opts: IconOptions
  title: string
}) {
  return (
    <div
      role="img"
      aria-label="Your icon on a phone home screen"
      className="mx-auto w-full max-w-60 rounded-[1.75rem] border-4 border-neutral-800 bg-linear-to-br from-sky-400 via-indigo-500 to-fuchsia-500 px-4 pt-6 pb-8"
    >
      <div className="grid grid-cols-4 gap-x-3 gap-y-4">
        <div className="flex min-w-0 flex-col items-center gap-1">
          {/* iPhones round the icon's corners themselves. */}
          <IconPreview
            logo={logo}
            opts={opts}
            kind="apple"
            size={180}
            display={44}
            className="overflow-hidden rounded-[22%]"
          />
          <span className="w-full truncate text-center text-[9px] text-white">{title}</span>
        </div>
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <span className="block h-11 w-11 rounded-[22%] bg-white/25" />
            <span className="block h-1.5 w-7 rounded-full bg-white/30" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** An SVG with a fixed size, so every browser can draw it on a canvas. */
async function sizedSvg(file: File): Promise<Blob> {
  const doc = new DOMParser().parseFromString(await file.text(), "image/svg+xml")
  const svg = doc.documentElement
  if (svg.nodeName.toLowerCase() !== "svg" || doc.getElementsByTagName("parsererror").length)
    throw new Error("Not an SVG")
  const size = svgSizing(
    svg.getAttribute("width"),
    svg.getAttribute("height"),
    svg.getAttribute("viewBox"),
  )
  if (size.viewBox) svg.setAttribute("viewBox", size.viewBox)
  svg.setAttribute("width", String(size.width))
  svg.setAttribute("height", String(size.height))
  return new Blob([new XMLSerializer().serializeToString(doc)], { type: "image/svg+xml" })
}

/** In the logo's own pixels; null when that's the whole logo (or unknown), "empty" when nothing shows. */
function findContent(img: HTMLImageElement): Box | null | "empty" {
  const w = img.naturalWidth
  const h = img.naturalHeight
  const k = Math.min(1, 512 / Math.max(w, h))
  const c = document.createElement("canvas")
  c.width = Math.max(1, Math.round(w * k))
  c.height = Math.max(1, Math.round(h * k))
  const ctx = c.getContext("2d", { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, c.width, c.height)
  let pixels: Uint8ClampedArray
  try {
    pixels = ctx.getImageData(0, 0, c.width, c.height).data
  } catch {
    return null
  }
  const box = contentBox(pixels, c.width, c.height)
  if (!box) return "empty"
  if (box.x === 0 && box.y === 0 && box.w === c.width && box.h === c.height) return null
  // One pixel of slack each side, so soft edges aren't shaved off.
  const x0 = Math.max(0, (box.x - 1) / k)
  const y0 = Math.max(0, (box.y - 1) / k)
  const x1 = Math.min(w, (box.x + box.w + 1) / k)
  const y1 = Math.min(h, (box.y + box.h + 1) / k)
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

function logoArea(logo: Logo, trim: boolean): Box {
  return trim && logo.content ? logo.content : { x: 0, y: 0, w: logo.width, h: logo.height }
}

function roundedSquare(ctx: CanvasRenderingContext2D, size: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(r, 0)
  ctx.arcTo(size, 0, size, size, r)
  ctx.arcTo(size, size, 0, size, r)
  ctx.arcTo(0, size, 0, 0, r)
  ctx.arcTo(0, 0, size, 0, r)
  ctx.closePath()
}

/** Every preview and every file comes from here. */
function drawIcon(
  ctx: CanvasRenderingContext2D,
  size: number,
  logo: Logo,
  o: IconOptions,
  kind: IconKind,
) {
  const background = kind === "apple" ? o.appleBackground : o.background
  const radius = cornerRadius(kind === "apple" ? "square" : o.shape, size)
  ctx.clearRect(0, 0, size, size)
  ctx.save()
  if (radius > 0) {
    roundedSquare(ctx, size, radius)
    ctx.clip()
  }
  if (background) {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, size, size)
  }
  const src = logoArea(logo, o.trim)
  const dst = logoBox(size, o.padding, src.w, src.h)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  if (logo.isSvg) {
    // Vector: drawn straight at the target size, crisp.
    ctx.drawImage(logo.el, src.x, src.y, src.w, src.h, dst.x, dst.y, dst.w, dst.h)
  } else {
    // A big shrink in one go makes edges jagged; halve step by step instead.
    let from: CanvasImageSource = logo.el
    let r = src
    while (r.w / 2 >= dst.w && r.h / 2 >= dst.h) {
      const c = document.createElement("canvas")
      c.width = Math.max(1, Math.round(r.w / 2))
      c.height = Math.max(1, Math.round(r.h / 2))
      const cx = c.getContext("2d")
      if (!cx) break
      cx.imageSmoothingEnabled = true
      cx.imageSmoothingQuality = "high"
      cx.drawImage(from, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height)
      from = c
      r = { x: 0, y: 0, w: c.width, h: c.height }
    }
    ctx.drawImage(from, r.x, r.y, r.w, r.h, dst.x, dst.y, dst.w, dst.h)
  }
  ctx.restore()
}
