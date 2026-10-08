"use client"

import { useDeferredValue, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import {
  AlertTriangle,
  ArrowLeftRight,
  Check,
  Copy,
  Download,
  Link2,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { canvasToBlob, saveBlob } from "../lib/files"
import { buildQr, drawQr, qrFileName, type QrStyle } from "../lib/qr"
import {
  MEDIUM_CHIPS,
  RECENT_MAX,
  SOURCE_CHIPS,
  UTM_KEYS,
  addRecent,
  buildUtmLink,
  cleanUtmValue,
  cleanUtmValues,
  emptyUtm,
  missingUtm,
  parseRecent,
  parseWebsiteUrl,
  removeRecent,
  sourceMediumHint,
  splitUtmLink,
  type RecentLink,
  type UtmKey,
  type UtmValues,
} from "../lib/utm"
import { ToolPage } from "./tool-page"

/** On-screen QR size, CSS px, and the size of the downloaded PNG. */
const QR_PREVIEW_PX = 200
const QR_DOWNLOAD_PX = 1024
const QR_STYLE: QrStyle = { dark: "#000000", light: "#ffffff", imageScale: 0.22, imagePlate: false }

interface FieldDef {
  key: UtmKey
  label: string
  hint: string
  placeholder: string
  chips?: readonly string[]
  required?: boolean
}

const FIELDS: Record<UtmKey, FieldDef> = {
  utm_source: {
    key: "utm_source",
    label: "Source",
    hint: "Where the visit comes from - a website, app or newsletter.",
    placeholder: "facebook",
    chips: SOURCE_CHIPS,
    required: true,
  },
  utm_medium: {
    key: "utm_medium",
    label: "Medium",
    hint: "The type of traffic - a paid ad, a social post, an email.",
    placeholder: "paid_social",
    chips: MEDIUM_CHIPS,
    required: true,
  },
  utm_campaign: {
    key: "utm_campaign",
    label: "Campaign",
    hint: "The campaign name. Use the exact same name in every link for this campaign.",
    placeholder: "diwali-sale-2026",
    required: true,
  },
  utm_term: {
    key: "utm_term",
    label: "Term",
    hint: "The keyword, for paid search ads. Optional.",
    placeholder: "seo agency delhi",
  },
  utm_content: {
    key: "utm_content",
    label: "Content",
    hint: "Tells apart two ads or links in the same campaign. Optional.",
    placeholder: "video-ad-1",
  },
}

const FIELD_NAMES: Record<UtmKey, string> = {
  utm_source: "Source",
  utm_medium: "Medium",
  utm_campaign: "Campaign",
  utm_term: "Term",
  utm_content: "Content",
}

// Recent links: localStorage via useSyncExternalStore, so the server and first browser render
// agree. If storage is blocked the list still works for this visit, from memory.

const RECENT_KEY = "dnms-tools-utm-recent"
const NO_RECENT: RecentLink[] = []
const recentListeners = new Set<() => void>()
let storageBlocked = false
let memoryRaw: string | null = null
let cachedRaw: string | null | undefined
let cachedList: RecentLink[] = NO_RECENT

function readRecentRaw(): string | null {
  if (storageBlocked) return memoryRaw
  try {
    return window.localStorage.getItem(RECENT_KEY)
  } catch {
    storageBlocked = true
    return memoryRaw
  }
}

function getRecent(): RecentLink[] {
  const raw = readRecentRaw()
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedList = parseRecent(raw)
  }
  return cachedList
}

function saveRecent(list: RecentLink[]) {
  const raw = JSON.stringify(list)
  memoryRaw = raw
  if (!storageBlocked) {
    try {
      window.localStorage.setItem(RECENT_KEY, raw)
    } catch {
      storageBlocked = true
    }
  }
  recentListeners.forEach((fn) => fn())
}

function subscribeRecent(onChange: () => void) {
  recentListeners.add(onChange)
  window.addEventListener("storage", onChange)
  return () => {
    recentListeners.delete(onChange)
    window.removeEventListener("storage", onChange)
  }
}

function rememberLink(link: string) {
  saveRecent(addRecent(getRecent(), link, Date.now()))
}

async function copyText(text: string, done: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(done)
    return true
  } catch {
    toast.error("Your browser blocked copying - select the link and copy it yourself")
    return false
  }
}

export function UtmBuilder() {
  const [website, setWebsite] = useState("")
  const [values, setValues] = useState<UtmValues>(emptyUtm)
  const [clean, setClean] = useState(true)
  const [copied, setCopied] = useState(false)
  const recent = useSyncExternalStore(subscribeRecent, getRecent, () => NO_RECENT)
  const preview = useRef<HTMLCanvasElement>(null)
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const parsed = parseWebsiteUrl(website)
  const used = cleanUtmValues(values, clean)
  const missing = missingUtm(used)
  const result = parsed.ok && missing.length === 0 ? buildUtmLink(parsed.url, used) : null
  const link = result?.link ?? ""
  const hint = sourceMediumHint(used.utm_source, used.utm_medium)
  const hasCapitals = !clean && UTM_KEYS.some((k) => used[k] !== used[k].toLowerCase())
  const touched = website.trim() !== "" || UTM_KEYS.some((k) => values[k].trim() !== "")

  // The QR code catches up a beat after typing, so typing stays snappy.
  const deferredLink = useDeferredValue(link)
  const qr = useMemo(() => buildQr(deferredLink, false), [deferredLink])

  useEffect(() => {
    const canvas = preview.current
    if (!canvas || !qr.ok) return
    const dpr = window.devicePixelRatio || 1
    const px = Math.round(QR_PREVIEW_PX * dpr)
    canvas.width = px
    canvas.height = px
    const ctx = canvas.getContext("2d")
    if (ctx) drawQr(ctx, px, qr.matrix, QR_STYLE)
  }, [qr])

  function setValue(key: UtmKey, value: string) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  function swapSourceMedium() {
    setValues((v) => ({ ...v, utm_source: v.utm_medium, utm_medium: v.utm_source }))
  }

  function reset() {
    setWebsite("")
    setValues(emptyUtm())
  }

  async function copyLink() {
    if (!link) return
    if (await copyText(link, "Link copied - paste it in your ad, post or email")) {
      rememberLink(link)
      setCopied(true)
      clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(() => setCopied(false), 2000)
    }
  }

  async function downloadQr() {
    if (!link || !parsed.ok) return
    const code = buildQr(link, false)
    if (!code.ok) return
    const canvas = document.createElement("canvas")
    canvas.width = QR_DOWNLOAD_PX
    canvas.height = QR_DOWNLOAD_PX
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    drawQr(ctx, QR_DOWNLOAD_PX, code.matrix, QR_STYLE)
    try {
      const blob = await canvasToBlob(canvas, "image/png")
      const name = [parsed.url.hostname.replace(/^www\./, ""), used.utm_campaign, used.utm_content]
        .filter(Boolean)
        .join(" ")
      saveBlob(blob, qrFileName(name, "png"))
      rememberLink(link)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create the QR code image")
    }
  }

  function loadRecent(r: RecentLink) {
    const parts = splitUtmLink(r.link)
    if (!parts) return
    setWebsite(parts.base)
    setValues(parts.values)
    toast.success("Link loaded into the form - change what you need")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <ToolPage slug="utm-builder">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardContent className="space-y-6 p-5">
              <div className="space-y-2">
                <Label required htmlFor="utm-website">
                  Website URL
                </Label>
                <Input
                  id="utm-website"
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="digitallynext.com/offer"
                  aria-describedby="utm-website-hint"
                  aria-invalid={!parsed.ok && parsed.reason !== "empty"}
                />
                {!parsed.ok && parsed.reason !== "empty" ? (
                  <p
                    id="utm-website-hint"
                    className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400"
                  >
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {parsed.reason === "spaces"
                      ? "A web address can't have spaces - check what you pasted."
                      : "That doesn't look like a web address. Try something like digitallynext.com/offer."}
                  </p>
                ) : (
                  <p id="utm-website-hint" className="text-muted-foreground text-xs">
                    The page people land on. We add https:// if you leave it out.
                  </p>
                )}
              </div>

              <UtmField
                def={FIELDS.utm_source}
                value={values.utm_source}
                used={used.utm_source}
                onChange={(v) => setValue("utm_source", v)}
              />
              <UtmField
                def={FIELDS.utm_medium}
                value={values.utm_medium}
                used={used.utm_medium}
                onChange={(v) => setValue("utm_medium", v)}
              />
              {hint && (
                <div className="-mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-amber-700 dark:text-amber-400">
                  <span className="flex items-start gap-1.5">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {hint === "swapped"
                      ? "Source and medium look swapped. Source is where the visit comes from (google, facebook); medium is the type of traffic (cpc, email)."
                      : hint === "medium-is-source"
                        ? `"${used.utm_medium}" is usually a source. Medium is the type of traffic, like cpc, social or email.`
                        : `"${used.utm_source}" is usually a medium. Source is where the visit comes from, like google or newsletter.`}
                  </span>
                  {hint === "swapped" && (
                    <button
                      type="button"
                      onClick={swapSourceMedium}
                      className="focus-visible:ring-ring inline-flex items-center gap-1 rounded-sm font-medium underline underline-offset-2 hover:no-underline focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5" />
                      Swap them
                    </button>
                  )}
                </div>
              )}
              <UtmField
                def={FIELDS.utm_campaign}
                value={values.utm_campaign}
                used={used.utm_campaign}
                onChange={(v) => setValue("utm_campaign", v)}
              />
              <div className="grid gap-6 sm:grid-cols-2">
                <UtmField
                  def={FIELDS.utm_term}
                  value={values.utm_term}
                  used={used.utm_term}
                  onChange={(v) => setValue("utm_term", v)}
                />
                <UtmField
                  def={FIELDS.utm_content}
                  value={values.utm_content}
                  used={used.utm_content}
                  onChange={(v) => setValue("utm_content", v)}
                />
              </div>

              <div className="space-y-2 border-t pt-5">
                <div className="flex items-center gap-3">
                  <Switch
                    id="utm-clean"
                    checked={clean}
                    onCheckedChange={setClean}
                    aria-describedby="utm-clean-hint"
                  />
                  <Label htmlFor="utm-clean" className="mb-0">
                    Clean up values
                  </Label>
                </div>
                <p id="utm-clean-hint" className="text-muted-foreground text-xs">
                  Makes everything lowercase and turns spaces into hyphens, so reports don&apos;t
                  split &quot;Facebook&quot; and &quot;facebook&quot; into two sources.
                </p>
                {hasCapitals && (
                  <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Some values have capital letters. Analytics counts &quot;Facebook&quot; and
                    &quot;facebook&quot; separately - turn on Clean up values to avoid that.
                  </p>
                )}
              </div>

              {touched && (
                <Button
                  variant="ghost"
                  className="text-muted-foreground -mt-2 gap-1.5 px-2"
                  onClick={reset}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Start again
                </Button>
              )}
            </CardContent>
          </Card>

          <RecentLinks list={recent} onLoad={loadRecent} />
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardContent className="space-y-4 p-5">
              <h2 className="text-sm font-semibold">Your link</h2>
              {link ? (
                <>
                  <p className="bg-muted/40 rounded-sm border p-3 font-mono text-xs leading-relaxed break-all">
                    {link}
                  </p>
                  <Button className="w-full gap-1.5" onClick={copyLink}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copied" : "Copy link"}
                  </Button>
                  {result && result.replaced.length > 0 && (
                    <p className="text-muted-foreground text-xs">
                      The page link already had UTM tags ({result.replaced.join(", ")}) - they have
                      been replaced with yours.
                    </p>
                  )}
                  {parsed.ok && parsed.url.protocol === "http:" && (
                    <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      This link starts with http:// - use https:// if the site supports it.
                    </p>
                  )}

                  <div className="border-t pt-4">
                    <div
                      className="mx-auto flex items-center justify-center overflow-hidden rounded-sm border bg-white"
                      style={{ width: QR_PREVIEW_PX, height: QR_PREVIEW_PX, maxWidth: "100%" }}
                    >
                      {qr.ok ? (
                        <canvas
                          ref={preview}
                          role="img"
                          aria-label="QR code of your link"
                          style={{ width: QR_PREVIEW_PX, height: QR_PREVIEW_PX, maxWidth: "100%" }}
                        />
                      ) : (
                        <p className="px-4 text-center text-xs text-neutral-600">
                          {qr.reason === "too-long"
                            ? "This link is too long for a QR code - shorten the page link."
                            : "Making the QR code..."}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      className="mt-3 w-full gap-1.5"
                      disabled={!qr.ok}
                      onClick={downloadQr}
                    >
                      <Download className="h-4 w-4" />
                      Download QR code (PNG)
                    </Button>
                  </div>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Click the link once yourself to check the page opens. For print, scan the QR
                    code with your phone first.
                  </p>
                </>
              ) : (
                <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-sm border border-dashed px-4 py-10 text-center text-xs">
                  <Link2 className="h-8 w-8" />
                  <p>Your tracking link and its QR code show here.</p>
                  <p>
                    Still needed:{" "}
                    {[
                      ...(parsed.ok ? [] : ["Website URL"]),
                      ...missing.map((k) => FIELD_NAMES[k]),
                    ].join(", ")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ToolPage>
  )
}

function UtmField({
  def,
  value,
  used,
  onChange,
}: {
  def: FieldDef
  value: string
  used: string
  onChange: (value: string) => void
}) {
  const id = `utm-${def.key}`
  const changed = used !== "" && used !== value.trim()
  return (
    <div className="space-y-2">
      <Label required={def.required} htmlFor={id}>
        {def.label}{" "}
        <span className="text-muted-foreground font-mono text-xs font-normal">{def.key}</span>
      </Label>
      <Input
        id={id}
        value={value}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        placeholder={def.placeholder}
        aria-describedby={`${id}-hint`}
      />
      {def.chips && (
        <div
          role="group"
          aria-label={`Quick picks for ${def.label.toLowerCase()}`}
          className="flex flex-wrap gap-1.5"
        >
          {def.chips.map((chip) => {
            const active = cleanUtmValue(value, true) === chip
            return (
              <button
                key={chip}
                type="button"
                aria-pressed={active}
                onClick={() => onChange(chip)}
                className={cn(
                  "focus-visible:ring-ring rounded-sm border px-2 py-1 font-mono text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {chip}
              </button>
            )
          })}
        </div>
      )}
      <p id={`${id}-hint`} className="text-muted-foreground text-xs">
        {def.hint}
        {changed && (
          <>
            {" "}
            Will be used as <span className="text-foreground font-mono">{used}</span>.
          </>
        )}
      </p>
    </div>
  )
}

function RecentLinks({ list, onLoad }: { list: RecentLink[]; onLoad: (r: RecentLink) => void }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Recent links</h2>
            <p className="text-muted-foreground text-xs">
              Your last {RECENT_MAX} links, saved in this browser only when you copy a link or
              download its QR code.
            </p>
          </div>
          {list.length > 0 && (
            <Button
              variant="ghost"
              className="text-muted-foreground hover:text-destructive gap-1.5 px-2"
              onClick={() => saveRecent([])}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear all
            </Button>
          )}
        </div>
        {list.length === 0 ? (
          <p className="text-muted-foreground rounded-sm border border-dashed px-4 py-6 text-center text-xs">
            No links yet. Links you copy will show up here.
          </p>
        ) : (
          <ul className="divide-y rounded-sm border">
            {list.map((r) => (
              <li key={r.link} className="flex items-center gap-2 py-2 pr-2 pl-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs" title={r.link}>
                    {r.link}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {new Date(r.at).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Copy link"
                  title="Copy link"
                  onClick={() => copyText(r.link, "Link copied")}
                >
                  <Copy />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Load into the form to edit"
                  title="Load into the form to edit"
                  onClick={() => onLoad(r)}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove from recent links"
                  title="Remove"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => saveRecent(removeRecent(list, r.link))}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
