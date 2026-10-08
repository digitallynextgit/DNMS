"use client"

import {
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import {
  AlertTriangle,
  Copy,
  Globe,
  ImageIcon,
  MoreVertical,
  Monitor,
  Share2,
  Smartphone,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { formatBytes } from "../lib/files"
import { graphemes } from "../lib/text-stats"
import { parseWebsiteUrl } from "../lib/utm"
import { FileDrop } from "./file-drop"
import { PrivacyNote, ToolPage } from "./tool-page"

// Google cuts results by pixel width ("WWW" sooner than "iii"). Fonts and widths follow
// Google's result styles - close, not exact.

const GOOGLE = {
  desktopTitle: { font: "20px Arial, sans-serif", width: 600, lines: 1 },
  /** Google shows about 920 px of description on a computer (about two lines). */
  desktopDesc: { font: "14px Arial, sans-serif", width: 920, lines: 1 },
  /** A 360 px phone, less the result's padding. */
  mobileTitle: { font: "18px Arial, sans-serif", width: 326, lines: 2 },
  /** ...and about 680 px on a phone. */
  mobileDesc: { font: "14px Arial, sans-serif", width: 680, lines: 1 },
} as const

const TITLE_GOOD = { min: 50, max: 60 }
const DESC_GOOD = { min: 120, max: 160 }

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const
/** Facebook's own cap for a share image. */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024

const SAMPLE = {
  title: "Your page title - the blue link people click",
  description:
    "Your meta description. One or two sentences that say what the page offers and why someone should click it.",
  url: "https://www.example.com/your-page",
}

let measureCtx: CanvasRenderingContext2D | null | undefined

function measure(text: string, font: string): number {
  if (measureCtx === undefined) {
    measureCtx =
      typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d")
  }
  if (!measureCtx) return text.length * 8
  measureCtx.font = font
  return measureCtx.measureText(text).width
}

interface Fit {
  lines: string[]
  cut: boolean
  shown: number
}

const ELLIPSIS = " ..."

function ellipsize(line: string, font: string, width: number): string {
  const words = line.split(" ")
  while (words.length > 1 && measure(words.join(" ") + ELLIPSIS, font) > width) words.pop()
  const out = words.join(" ")
  if (measure(out + ELLIPSIS, font) <= width) return out + ELLIPSIS
  // One very long word (a URL, say): cut it letter by letter.
  const chars = graphemes(out)
  while (chars.length && measure(chars.join("") + "...", font) > width) chars.pop()
  return chars.join("") + "..."
}

function fitLines(text: string, spec: { font: string; width: number; lines: number }): Fit {
  const words = text.split(" ").filter(Boolean)
  const lines: string[] = []
  let line = ""
  let cut = false
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (measure(next, spec.font) <= spec.width) {
      line = next
      continue
    }
    if (lines.length + 1 >= spec.lines) {
      cut = true
      line = next
      break
    }
    if (line) lines.push(line)
    line = word
  }
  // One word too wide for the last line (a long URL) is cut too.
  if (!cut && lines.length + 1 >= spec.lines && measure(line, spec.font) > spec.width) cut = true
  if (cut) lines.push(ellipsize(line, spec.font, spec.width))
  else if (line) lines.push(line)
  const shownText = lines.join(" ").replace(/ ?\.\.\.$/, "")
  return { lines, cut, shown: graphemes(shownText).length }
}

/** No fitting on the server (no canvas): the browser render takes over straight after. */
function unfitted(text: string): Fit {
  return { lines: [text], cut: false, shown: graphemes(text).length }
}

const subscribeNothing = () => () => {}
/** False on the server and during hydration, true after - without an effect. */
function useInBrowser(): boolean {
  return useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  )
}

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim()

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

interface ShareImage {
  url: string
  name: string
  size: number
  width: number
  height: number
}

/** Advice on a share image's size: 1200 x 630 (1.91 : 1) is what every network wants. */
function imageAdvice(img: ShareImage): { ok: boolean; text: string } {
  const size = `${img.width} × ${img.height} px`
  if (img.width < 600 || img.height < 315)
    return {
      ok: false,
      text: `${size} is small - Facebook and LinkedIn may show it as a little thumbnail. Use 1200 × 630.`,
    }
  const ratio = img.width / img.height
  if (Math.abs(ratio - 1.91) / 1.91 > 0.08)
    return {
      ok: false,
      text: `${size} isn't the 1.91 : 1 shape, so the edges get cropped (as shown in the previews). 1200 × 630 fits exactly.`,
    }
  if (img.width < 1200)
    return { ok: true, text: `${size} works. 1200 × 630 looks sharpest on big screens.` }
  return { ok: true, text: `${size} - a good size.` }
}

function metaTags(p: {
  title: string
  description: string
  url: string
  origin: string | null
  siteName: string
  imageName: string | null
}): string {
  const imageFile = p.imageName
    ? p.imageName.toLowerCase().replace(/[^a-z0-9.]+/g, "-")
    : "share-image.jpg"
  const imageUrl = `${p.origin ?? "https://www.example.com"}/images/${imageFile}`
  const lines = [
    `<title>${escapeAttr(p.title)}</title>`,
    `<meta name="description" content="${escapeAttr(p.description)}">`,
    "",
    "<!-- How the link looks when shared on Facebook, LinkedIn, WhatsApp and X -->",
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${escapeAttr(p.title)}">`,
    `<meta property="og:description" content="${escapeAttr(p.description)}">`,
    `<meta property="og:url" content="${escapeAttr(p.url)}">`,
  ]
  if (p.siteName) lines.push(`<meta property="og:site_name" content="${escapeAttr(p.siteName)}">`)
  lines.push(
    "<!-- Upload the share image (1200 x 630 px) to the website, then put its full link here -->",
    `<meta property="og:image" content="${escapeAttr(imageUrl)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
  )
  return lines.join("\n")
}

export function SearchPreview() {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [pageUrl, setPageUrl] = useState("")
  const [siteName, setSiteName] = useState("")
  const [image, setImage] = useState<ShareImage | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const inBrowser = useInBrowser()

  useEffect(() => {
    if (!image) return
    const url = image.url
    return () => URL.revokeObjectURL(url)
  }, [image])

  // Previews catch up a beat after typing, so typing stays snappy.
  const deferredTitle = useDeferredValue(title)
  const deferredDescription = useDeferredValue(description)
  const deferredSiteName = useDeferredValue(siteName)
  const d = {
    title: oneLine(deferredTitle),
    description: oneLine(deferredDescription),
    siteName: oneLine(deferredSiteName),
  }
  const parsed = parseWebsiteUrl(pageUrl)
  const url = parsed.ok ? parsed.url : new URL(SAMPLE.url)
  const host = url.hostname.replace(/^www\./, "")
  const shownTitle = d.title || SAMPLE.title
  const shownDesc = d.description || SAMPLE.description
  const shownSite = d.siteName || host

  const fit = (text: string, spec: (typeof GOOGLE)[keyof typeof GOOGLE]) =>
    inBrowser ? fitLines(text, spec) : unfitted(text)
  const desktopTitle = fit(shownTitle, GOOGLE.desktopTitle)
  const desktopDesc = fit(shownDesc, GOOGLE.desktopDesc)
  const mobileTitle = fit(shownTitle, GOOGLE.mobileTitle)
  const mobileDesc = fit(shownDesc, GOOGLE.mobileDesc)
  const titlePx = inBrowser && d.title ? Math.round(measure(d.title, GOOGLE.desktopTitle.font)) : 0

  const titleCount = graphemes(oneLine(title)).length
  const descCount = graphemes(oneLine(description)).length

  function pickImage(file: File | undefined) {
    if (!file) return
    if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) {
      toast.error("Pick a JPG, PNG, WebP or GIF image")
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("That image is over 8 MB - pick a smaller one")
      return
    }
    const src = URL.createObjectURL(file)
    const el = new Image()
    el.onload = () =>
      setImage({
        url: src,
        name: file.name,
        size: file.size,
        width: el.naturalWidth,
        height: el.naturalHeight,
      })
    el.onerror = () => {
      URL.revokeObjectURL(src)
      toast.error("Couldn't open that image")
    }
    el.src = src
  }

  async function copyTags() {
    const tags = metaTags({
      title: oneLine(title) || "Page title",
      description: oneLine(description) || "Page description",
      url: parsed.ok ? parsed.url.href : SAMPLE.url,
      origin: parsed.ok ? parsed.url.origin : null,
      siteName: oneLine(siteName),
      imageName: image?.name ?? null,
    })
    try {
      await navigator.clipboard.writeText(tags)
      toast.success("Meta tags copied - paste them inside the page's <head>")
    } catch {
      toast.error("Your browser blocked copying - select the code and copy it yourself")
    }
  }

  const imageSrc = image?.url ?? null
  const advice = image ? imageAdvice(image) : null
  const snippet = metaTags({
    title: d.title || "Page title",
    description: d.description || "Page description",
    url: parsed.ok ? parsed.url.href : SAMPLE.url,
    origin: parsed.ok ? parsed.url.origin : null,
    siteName: d.siteName,
    imageName: image?.name ?? null,
  })

  return (
    <ToolPage slug="search-preview">
      <div className="space-y-6">
        <Card>
          <CardContent className="grid gap-6 p-5 md:grid-cols-2">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="sp-title">Page title</Label>
                <Input
                  id="sp-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="SEO Services in Delhi | Digitally Next"
                  aria-describedby="sp-title-hint"
                />
                <div id="sp-title-hint" className="space-y-1">
                  <LengthChip count={titleCount} good={TITLE_GOOD} />
                  {d.title && desktopTitle.cut ? (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      Google cuts this after about {desktopTitle.shown} characters on a computer (
                      {titlePx} of 600 px).
                    </p>
                  ) : (
                    <p className="text-muted-foreground text-xs">
                      The blue link in Google. Put the main keyword first, brand name last.
                      {titlePx > 0 && ` ${titlePx} of 600 px used.`}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sp-desc">Meta description</Label>
                <Textarea
                  id="sp-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="We help Indian brands grow with SEO, social media and websites. Book a free call today."
                  rows={4}
                  aria-describedby="sp-desc-hint"
                />
                <div id="sp-desc-hint" className="space-y-1">
                  <LengthChip count={descCount} good={DESC_GOOD} />
                  {d.description && (desktopDesc.cut || mobileDesc.cut) ? (
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      {desktopDesc.cut
                        ? `Google cuts this after about ${desktopDesc.shown} characters on a computer and ${mobileDesc.shown} on a phone.`
                        : `Fits on a computer; phones cut it after about ${mobileDesc.shown} characters.`}
                    </p>
                  ) : (
                    <p className="text-muted-foreground text-xs">
                      The grey text under the link. Say what the page offers and why to click.
                      Google sometimes writes its own instead.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="sp-url">Page URL</Label>
                <Input
                  id="sp-url"
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  value={pageUrl}
                  onChange={(e) => setPageUrl(e.target.value)}
                  placeholder="digitallynext.com/seo-services"
                  aria-describedby="sp-url-hint"
                  aria-invalid={!parsed.ok && parsed.reason !== "empty"}
                />
                {!parsed.ok && parsed.reason !== "empty" ? (
                  <p
                    id="sp-url-hint"
                    className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400"
                  >
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    That doesn&apos;t look like a web address. Try digitallynext.com/seo-services.
                  </p>
                ) : (
                  <p id="sp-url-hint" className="text-muted-foreground text-xs">
                    The page&apos;s address. We add https:// if you leave it out.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="sp-site">Site name (optional)</Label>
                <Input
                  id="sp-site"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="Digitally Next"
                  aria-describedby="sp-site-hint"
                />
                <p id="sp-site-hint" className="text-muted-foreground text-xs">
                  The brand name Google shows above the link. Leave empty to show the domain.
                </p>
              </div>

              <div className="space-y-2">
                <Label id="sp-image-label">Share image (optional)</Label>
                <input
                  ref={fileInput}
                  type="file"
                  accept={IMAGE_TYPES.join(",")}
                  className="hidden"
                  aria-labelledby="sp-image-label"
                  onChange={(e) => {
                    pickImage(e.target.files?.[0])
                    e.target.value = ""
                  }}
                />
                {image ? (
                  <div className="flex items-center gap-3 rounded-sm border p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL, not a served image */}
                    <img
                      src={image.url}
                      alt=""
                      className="bg-muted h-12 w-20 shrink-0 rounded-sm object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{image.name}</p>
                      <p className="text-muted-foreground text-xs">{formatBytes(image.size)}</p>
                    </div>
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
                  <FileDrop
                    accept={IMAGE_TYPES}
                    maxBytes={MAX_IMAGE_BYTES}
                    onFiles={(files) => pickImage(files[0])}
                    label="Drop the share image here or click to choose"
                    hint="JPG, PNG, WebP or GIF - 1200 × 630 px is best"
                    className="py-6"
                  />
                )}
                {advice && (
                  <p
                    className={cn(
                      "text-xs",
                      advice.ok
                        ? "text-muted-foreground"
                        : "flex items-start gap-1.5 text-amber-700 dark:text-amber-400",
                    )}
                  >
                    {!advice.ok && <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                    {advice.text}
                  </p>
                )}
                <PrivacyNote />
              </div>
            </div>
          </CardContent>
        </Card>

        <PreviewCard icon={Monitor} title="Google - computer">
          <div style={{ width: 600, fontFamily: "Arial, sans-serif" }}>
            <ResultHeader site={shownSite} url={url} sample={!parsed.ok} />
            <div
              className={cn(
                "mt-[5px] pt-[5px] text-[20px] leading-[26px] whitespace-nowrap text-[#1a0dab]",
                !d.title && "opacity-60",
                !inBrowser && "truncate",
              )}
            >
              {desktopTitle.lines[0]}
            </div>
            <p
              className={cn(
                "mt-[3px] text-[14px] leading-[22px] break-words text-[#4d5156]",
                !d.description && "opacity-60",
                !inBrowser && "line-clamp-2",
              )}
            >
              {desktopDesc.lines[0]}
            </p>
          </div>
        </PreviewCard>

        <div className="grid gap-6 xl:grid-cols-2">
          <PreviewCard icon={Smartphone} title="Google - phone">
            <div
              className="rounded-[20px] border border-[#dadce0] bg-white p-4 shadow-sm"
              style={{ width: 360, fontFamily: "Arial, sans-serif" }}
            >
              <ResultHeader site={shownSite} url={url} sample={!parsed.ok} />
              <div
                className={cn(
                  "mt-2 text-[18px] leading-[24px] text-[#1558d6]",
                  !d.title && "opacity-60",
                  !inBrowser && "line-clamp-2",
                )}
              >
                {mobileTitle.lines.map((line, i) => (
                  <span key={i} className="block whitespace-nowrap">
                    {line}
                  </span>
                ))}
              </div>
              <p
                className={cn(
                  "mt-1.5 text-[14px] leading-[20px] break-words text-[#4d5156]",
                  !d.description && "opacity-60",
                  !inBrowser && "line-clamp-3",
                )}
              >
                {mobileDesc.lines[0]}
              </p>
            </div>
          </PreviewCard>

          <PreviewCard icon={Share2} title="Facebook, LinkedIn & WhatsApp">
            <div
              className="w-full max-w-[500px] min-w-[280px] overflow-hidden rounded-lg border border-[#dadde1] bg-white"
              style={{ fontFamily: "Helvetica, Arial, sans-serif" }}
            >
              <ShareImageBox src={imageSrc} />
              <div className="border-t border-[#dadde1] bg-[#f0f2f5] px-3 py-2.5">
                <p className="truncate text-[12px] leading-4 text-[#65676b] uppercase">{host}</p>
                <p
                  className={cn(
                    "mt-0.5 line-clamp-2 text-[16px] leading-5 font-semibold text-[#050505]",
                    !d.title && "opacity-60",
                  )}
                >
                  {shownTitle}
                </p>
                <p
                  className={cn(
                    "mt-0.5 truncate text-[14px] leading-5 text-[#65676b]",
                    !d.description && "opacity-60",
                  )}
                >
                  {shownDesc}
                </p>
              </div>
            </div>
          </PreviewCard>

          <PreviewCard icon={Share2} title="X (Twitter)">
            <div
              className="w-full max-w-[500px] min-w-[280px]"
              style={{
                fontFamily:
                  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
              }}
            >
              <div className="relative overflow-hidden rounded-2xl border border-[#cfd9de]">
                <ShareImageBox src={imageSrc} />
                <span
                  className={cn(
                    "absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)] truncate rounded-[4px] bg-black/75 px-1.5 text-[13px] leading-5 text-white",
                    !d.title && "opacity-80",
                  )}
                >
                  {shownTitle}
                </span>
              </div>
              <p className="mt-1 text-[13px] text-[#536471]">From {host}</p>
            </div>
          </PreviewCard>

          <Card className="min-w-0">
            <CardContent className="space-y-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold">Meta tags</h2>
                  <p className="text-muted-foreground text-xs">
                    For the developer: paste inside the page&apos;s &lt;head&gt;.
                  </p>
                </div>
                <Button variant="outline" className="gap-1.5" onClick={copyTags}>
                  <Copy className="h-4 w-4" />
                  Copy meta tags
                </Button>
              </div>
              <pre className="bg-muted/40 max-h-72 overflow-auto rounded-sm border p-3 font-mono text-xs leading-relaxed">
                {snippet}
              </pre>
              <p className="text-muted-foreground text-xs">
                Your image isn&apos;t uploaded anywhere - the og:image link is a placeholder to
                change once the image is on the website.
              </p>
            </CardContent>
          </Card>
        </div>

        <p className="text-muted-foreground text-xs leading-relaxed">
          Previews are close to the real thing, not exact: Google may rewrite titles and
          descriptions, and each app changes its look from time to time. Facebook, LinkedIn and
          WhatsApp keep an old preview for a while after you change a page.
        </p>
      </div>
    </ToolPage>
  )
}

function LengthChip({ count, good }: { count: number; good: { min: number; max: number } }) {
  const state =
    count === 0 ? "empty" : count < good.min ? "short" : count > good.max ? "long" : "good"
  const text = {
    empty: `0 characters - aim for ${good.min}-${good.max}`,
    short: `${count} characters - a bit short, aim for ${good.min}-${good.max}`,
    good: `${count} characters - good length`,
    long: `${count} characters - long, Google may cut it`,
  }[state]
  return (
    <span
      className={cn(
        "inline-flex rounded-sm px-2 py-0.5 text-xs font-medium",
        state === "empty" && "bg-muted text-muted-foreground",
        state === "short" && "bg-amber-500/10 text-amber-700 dark:text-amber-400",
        state === "good" && "bg-green-500/10 text-green-700 dark:text-green-400",
        state === "long" && "bg-red-500/10 text-red-700 dark:text-red-400",
      )}
    >
      {text}
    </span>
  )
}

function PreviewCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Monitor
  title: string
  children: ReactNode
}) {
  return (
    <Card className="min-w-0">
      <CardContent className="space-y-3 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="text-muted-foreground h-4 w-4" />
          {title}
        </h2>
        {/* Always light, like the real thing - even when DNMS is dark. */}
        <div
          className="overflow-x-auto rounded-sm border bg-white p-4 sm:p-6"
          style={{ colorScheme: "light" }}
        >
          {children}
        </div>
      </CardContent>
    </Card>
  )
}

function ResultHeader({ site, url, sample }: { site: string; url: URL; sample: boolean }) {
  const path = url.pathname
    .split("/")
    .filter(Boolean)
    .map((s) => {
      try {
        return decodeURIComponent(s)
      } catch {
        return s
      }
    })
  return (
    <div className={cn("flex items-center gap-3", sample && "opacity-60")}>
      <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border border-[#dadce0] bg-[#f1f3f4]">
        <Globe className="h-3.5 w-3.5 text-[#5f6368]" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] leading-[20px] text-[#202124]">{site}</p>
        <p className="flex items-center gap-1 text-[12px] leading-[18px] text-[#4d5156]">
          <span className="truncate">
            <span className="text-[#202124]">{`${url.protocol}//${url.hostname}`}</span>
            {path.length > 0 && ` › ${path.join(" › ")}`}
          </span>
          <MoreVertical className="h-3.5 w-3.5 shrink-0 text-[#5f6368]" aria-hidden="true" />
        </p>
      </div>
    </div>
  )
}

function ShareImageBox({ src }: { src: string | null }) {
  return (
    <div className="relative aspect-[1.91/1] w-full bg-[#e4e6eb]">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- a local object URL, not a served image
        <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-[12px] text-[#65676b]">
          <ImageIcon className="h-6 w-6" aria-hidden="true" />
          Add a share image to see it here
        </div>
      )}
    </div>
  )
}
