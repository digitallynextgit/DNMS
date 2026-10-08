"use client"

import { useEffect, useMemo, useState, useSyncExternalStore } from "react"
import {
  ArrowUpDown,
  Check,
  Contrast,
  Copy,
  Image as ImageIcon,
  Palette,
  Pipette,
  Trash2,
  X,
} from "lucide-react"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import {
  contrastRatio,
  extractPalette,
  formatCmyk,
  formatHsl,
  formatRatio,
  formatRgb,
  parseColour,
  rgbToHex,
  textColourOn,
  wcagChecks,
  type Rgb,
} from "../lib/colour"
import { loadImage } from "../lib/files"
import { FileDrop } from "./file-drop"
import { PrivacyNote, ToolPage } from "./tool-page"

type Tab = "picker" | "palette" | "contrast"

export function ColourTools() {
  const [tab, setTab] = useState<Tab>("picker")
  return (
    <ToolPage slug="colour-tools">
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList aria-label="Colour tools">
          <TabsTrigger value="picker">
            <Pipette />
            Picker &amp; converter
          </TabsTrigger>
          <TabsTrigger value="palette">
            <Palette />
            Palette from image
          </TabsTrigger>
          <TabsTrigger value="contrast">
            <Contrast />
            Contrast checker
          </TabsTrigger>
        </TabsList>
        {/* forceMount keeps each part's colours when you switch tabs. */}
        <TabsContent value="picker" forceMount className="mt-4 data-[state=inactive]:hidden">
          <PickerPanel />
        </TabsContent>
        <TabsContent value="palette" forceMount className="mt-4 data-[state=inactive]:hidden">
          <PalettePanel active={tab === "palette"} />
        </TabsContent>
        <TabsContent value="contrast" forceMount className="mt-4 data-[state=inactive]:hidden">
          <ContrastPanel />
        </TabsContent>
      </Tabs>
    </ToolPage>
  )
}

/** What is typed in a colour field, and the last colour it made sense as. */
interface ColourValue {
  text: string
  rgb: Rgb
}

function colourValue(text: string): ColourValue {
  return { text, rgb: parseColour(text) ?? { r: 0, g: 0, b: 0 } }
}

async function copyText(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${what} copied`)
  } catch {
    toast.error("Your browser blocked copying - select the text and copy it instead")
  }
}

function ColourField({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string
  label: string
  hint: string
  value: ColourValue
  onChange: (v: ColourValue) => void
}) {
  const valid = parseColour(value.text) !== null
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <div className="border-input flex h-9 shrink-0 items-center rounded-sm border px-1.5">
          <input
            type="color"
            aria-label={`${label}: open the colour picker`}
            value={rgbToHex(value.rgb).toLowerCase()}
            onChange={(e) => onChange(colourValue(e.target.value.toUpperCase()))}
            className="h-6 w-8 cursor-pointer rounded-sm border-0 bg-transparent p-0"
          />
        </div>
        <Input
          id={id}
          value={value.text}
          onChange={(e) =>
            onChange({ text: e.target.value, rgb: parseColour(e.target.value) ?? value.rgb })
          }
          spellCheck={false}
          autoComplete="off"
          aria-invalid={!valid}
          aria-describedby={`${id}-hint`}
          className="font-mono"
        />
      </div>
      <p
        id={`${id}-hint`}
        className={cn("text-xs", valid ? "text-muted-foreground" : "text-destructive")}
      >
        {valid ? hint : "That doesn't look like a colour - try #2563EB or rgb(37, 99, 235)."}
      </p>
    </div>
  )
}

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-sm border py-1.5 pr-1.5 pl-3">
      <div className="min-w-0 flex-1">
        <div className="text-muted-foreground text-xs">{label}</div>
        <div className="truncate font-mono text-sm">{value}</div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Copy ${label}`}
        title={`Copy ${label}`}
        onClick={() => copyText(value, label)}
      >
        <Copy />
      </Button>
    </div>
  )
}

/** Chrome and Edge's "pick a colour from anywhere on screen". Not in Firefox or Safari yet. */
type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> }

function getEyeDropper(): EyeDropperCtor | undefined {
  return (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper
}

const subscribeNothing = () => () => {}

/** False on the server and in browsers without it, so the button never flickers in and out. */
function useEyeDropperSupported(): boolean {
  return useSyncExternalStore(
    subscribeNothing,
    () => typeof getEyeDropper() === "function",
    () => false,
  )
}

function PickerPanel() {
  const [colour, setColour] = useState<ColourValue>(() => colourValue("#2563EB"))
  const canPick = useEyeDropperSupported()
  const { rgb } = colour
  const hex = rgbToHex(rgb)

  async function pickFromScreen() {
    const EyeDropper = getEyeDropper()
    if (!EyeDropper) return
    try {
      const { sRGBHex } = await new EyeDropper().open()
      const picked = parseColour(sRGBHex)
      if (picked) setColour({ text: rgbToHex(picked), rgb: picked })
    } catch {
      // Esc closes the picker without choosing anything - nothing to do.
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Card>
        <CardContent className="space-y-5 p-5">
          <ColourField
            id="colour-picker"
            label="Colour"
            hint="Type or paste HEX, RGB or HSL - like #2563EB, rgb(37, 99, 235) or hsl(221, 83%, 53%). Or click the swatch."
            value={colour}
            onChange={setColour}
          />
          {canPick && (
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" onClick={pickFromScreen}>
                <Pipette />
                Pick from screen
              </Button>
              <span className="text-muted-foreground text-xs">
                Then click anywhere on your screen. Esc cancels.
              </span>
            </div>
          )}
          <div
            className="flex h-40 items-end rounded-sm border p-4"
            style={{ background: hex, color: textColourOn(rgb) }}
            role="img"
            aria-label={`Colour preview: ${hex}`}
          >
            <span className="font-mono text-lg font-semibold">{hex}</span>
          </div>
        </CardContent>
      </Card>

      <div className="lg:sticky lg:top-20 lg:self-start">
        <Card>
          <CardContent className="space-y-3 p-5">
            <CopyRow label="HEX" value={hex} />
            <CopyRow label="RGB" value={formatRgb(rgb)} />
            <CopyRow label="HSL" value={formatHsl(rgb)} />
            <CopyRow label="CMYK (approx.)" value={formatCmyk(rgb)} />
            <p className="text-muted-foreground text-xs leading-relaxed">
              HEX, RGB and HSL are for screens. CMYK is only a rough guide for print - every printer
              is a little different, so ask for a proof before a big print run.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

const PALETTE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/bmp",
  "image/svg+xml",
] as const
const PALETTE_MAX_BYTES = 25 * 1024 * 1024
/** The image is shrunk to this many pixels across before counting colours - plenty, and fast. */
const SAMPLE_PX = 200
const COLOUR_COUNTS = ["5", "6", "7", "8"] as const

interface Picture {
  url: string
  name: string
  pixels: Uint8ClampedArray
}

function readPixels(img: HTMLImageElement): Uint8ClampedArray {
  // An SVG without a set size reports 0 x 0.
  const w0 = img.naturalWidth || SAMPLE_PX
  const h0 = img.naturalHeight || SAMPLE_PX
  const scale = Math.min(1, SAMPLE_PX / Math.max(w0, h0))
  const w = Math.max(1, Math.round(w0 * scale))
  const h = Math.max(1, Math.round(h0 * scale))
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) throw new Error("Your browser couldn't read this image")
  ctx.drawImage(img, 0, 0, w, h)
  return ctx.getImageData(0, 0, w, h).data
}

function percent(share: number): string {
  return share < 0.01 ? "<1%" : `${Math.round(share * 100)}%`
}

function PalettePanel({ active }: { active: boolean }) {
  const [picture, setPicture] = useState<Picture | null>(null)
  const [count, setCount] = useState<string>("6")
  const [reading, setReading] = useState(false)
  const palette = useMemo(
    () => (picture ? extractPalette(picture.pixels, Number(count)) : []),
    [picture, count],
  )

  useEffect(() => {
    if (!picture) return
    const { url } = picture
    return () => URL.revokeObjectURL(url)
  }, [picture])

  async function open(files: File[]) {
    const file = files[0]
    if (!file) return
    setReading(true)
    try {
      const pixels = readPixels(await loadImage(file))
      setPicture({ url: URL.createObjectURL(file), name: file.name, pixels })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't read that image")
    } finally {
      setReading(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Card>
        <CardContent className="space-y-4 p-5">
          {picture ? (
            <div className="space-y-3">
              <div className="bg-muted/40 flex justify-center rounded-sm border p-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- a local file, not a served image */}
                <img
                  src={picture.url}
                  alt={`Your image: ${picture.name}`}
                  className="max-h-80 max-w-full rounded-sm object-contain"
                />
              </div>
              <div className="flex items-center gap-2">
                <ImageIcon className="text-muted-foreground h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-sm">{picture.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove image"
                  title="Remove image"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setPicture(null)}
                >
                  <Trash2 />
                </Button>
              </div>
              <FileDrop
                accept={PALETTE_TYPES}
                maxBytes={PALETTE_MAX_BYTES}
                onFiles={open}
                allowPaste={active}
                label="Drop another image, or click to choose"
                className="py-5"
              />
            </div>
          ) : (
            <FileDrop
              accept={PALETTE_TYPES}
              maxBytes={PALETTE_MAX_BYTES}
              onFiles={open}
              allowPaste={active}
              label={reading ? "Reading the image..." : "Drop an image here, or click to choose"}
              hint="JPG, PNG, WebP, GIF or SVG - up to 25 MB"
            />
          )}
          <div className="max-w-56 space-y-2">
            <Label htmlFor="palette-count">Number of colours</Label>
            <Select value={count} onValueChange={setCount}>
              <SelectTrigger id="palette-count">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COLOUR_COUNTS.map((n) => (
                  <SelectItem key={n} value={n}>
                    {n} colours
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <PrivacyNote />
        </CardContent>
      </Card>

      <div className="lg:sticky lg:top-20 lg:self-start">
        <Card>
          <CardContent className="space-y-4 p-5">
            {palette.length > 0 ? (
              <>
                {/* Each colour as wide as its share of the picture. */}
                <div className="flex h-14 overflow-hidden rounded-sm border" aria-hidden>
                  {palette.map((p) => (
                    <div
                      key={p.hex}
                      style={{ background: p.hex, flexGrow: Math.max(p.share, 0.04) }}
                    />
                  ))}
                </div>
                <ul className="space-y-2" aria-label="Colours in your image">
                  {palette.map((p) => (
                    <li key={p.hex} className="flex items-center gap-3">
                      <span
                        className="h-9 w-9 shrink-0 rounded-sm border"
                        style={{ background: p.hex }}
                        aria-hidden
                      />
                      <span className="flex-1 font-mono text-sm">{p.hex}</span>
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {percent(p.share)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Copy ${p.hex}`}
                        title={`Copy ${p.hex}`}
                        onClick={() => copyText(p.hex, p.hex)}
                      >
                        <Copy />
                      </Button>
                    </li>
                  ))}
                </ul>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => copyText(palette.map((p) => p.hex).join(", "), "All colours")}
                >
                  <Copy />
                  Copy all
                </Button>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Most common colour first. The % is roughly how much of the picture it covers.
                </p>
              </>
            ) : (
              <div className="text-muted-foreground flex flex-col items-center gap-2 px-6 py-10 text-center text-xs">
                <Palette className="h-8 w-8" />
                {picture
                  ? "This image has no solid colours to pick - it's see-through."
                  : "Add an image to see its main colours"}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function verdict(ratio: number): { title: string; tone: "good" | "ok" | "bad" } {
  const c = wcagChecks(ratio)
  if (c.aaaNormal) return { title: "Excellent - easy to read at any size.", tone: "good" }
  if (c.aaNormal) return { title: "Good - fine for normal text.", tone: "good" }
  if (c.aaLarge)
    return { title: "Only OK for large text, like headings. Too faint for body text.", tone: "ok" }
  return { title: "Too low - hard to read. Make one colour darker or lighter.", tone: "bad" }
}

function PassFail({ pass, needs }: { pass: boolean; needs: string }) {
  return (
    <div className="flex flex-col items-start gap-0.5">
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-semibold",
          pass
            ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400"
            : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
        )}
      >
        {pass ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
        {pass ? "Pass" : "Fail"}
      </span>
      <span className="text-muted-foreground text-[11px]">needs {needs}</span>
    </div>
  )
}

function ContrastPanel() {
  const [text, setText] = useState<ColourValue>(() => colourValue("#1F2937"))
  const [bg, setBg] = useState<ColourValue>(() => colourValue("#FFFFFF"))
  const ratio = contrastRatio(text.rgb, bg.rgb)
  const checks = wcagChecks(ratio)
  const result = verdict(ratio)
  const textHex = rgbToHex(text.rgb)
  const bgHex = rgbToHex(bg.rgb)

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Card>
        <CardContent className="space-y-5 p-5">
          <div className="grid items-start gap-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
            <ColourField
              id="contrast-text"
              label="Text colour"
              hint="The colour of the words."
              value={text}
              onChange={setText}
            />
            <Button
              variant="outline"
              size="icon"
              aria-label="Swap text and background colours"
              title="Swap colours"
              className="sm:mt-6"
              onClick={() => {
                setText(bg)
                setBg(text)
              }}
            >
              <ArrowUpDown className="sm:rotate-90" />
            </Button>
            <ColourField
              id="contrast-bg"
              label="Background colour"
              hint="The colour behind the words."
              value={bg}
              onChange={setBg}
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Live sample</p>
            <div
              className="space-y-3 rounded-sm border p-5"
              style={{ background: bgHex, color: textHex }}
            >
              <p className="text-2xl font-semibold">Large text, like a heading</p>
              <p className="text-base">
                Normal text looks like this. Can you read it easily, even on a phone in sunlight?
              </p>
              <p className="text-xs">Small print, like a caption or a footer note.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="lg:sticky lg:top-20 lg:self-start">
        <Card>
          <CardContent className="space-y-4 p-5">
            <div>
              <p className="text-muted-foreground text-xs">Contrast ratio</p>
              <p className="text-3xl font-semibold tabular-nums" aria-live="polite">
                {formatRatio(ratio)}
              </p>
              <p
                className={cn(
                  "mt-1 text-sm font-medium",
                  result.tone === "good" && "text-green-700 dark:text-green-400",
                  result.tone === "ok" && "text-amber-600 dark:text-amber-400",
                  result.tone === "bad" && "text-destructive",
                )}
              >
                {result.title}
              </p>
            </div>
            <table className="w-full text-sm">
              <caption className="sr-only">WCAG results</caption>
              <thead>
                <tr className="text-muted-foreground text-left text-xs">
                  <th scope="col" className="pb-2 font-medium" />
                  <th scope="col" className="pb-2 font-medium">
                    AA
                  </th>
                  <th scope="col" className="pb-2 font-medium">
                    AAA
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t">
                  <th scope="row" className="py-2 pr-2 text-left font-medium">
                    Normal text
                  </th>
                  <td className="py-2">
                    <PassFail pass={checks.aaNormal} needs="4.5 : 1" />
                  </td>
                  <td className="py-2">
                    <PassFail pass={checks.aaaNormal} needs="7 : 1" />
                  </td>
                </tr>
                <tr className="border-t">
                  <th scope="row" className="py-2 pr-2 text-left font-medium">
                    Large text
                  </th>
                  <td className="py-2">
                    <PassFail pass={checks.aaLarge} needs="3 : 1" />
                  </td>
                  <td className="py-2">
                    <PassFail pass={checks.aaaLarge} needs="4.5 : 1" />
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="text-muted-foreground text-xs leading-relaxed">
              WCAG is the web&apos;s readability guideline. Aim for AA at least. Large text means
              24px and up, or 19px and up in bold.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
