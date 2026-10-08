"use client"

import { useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react"
import { AlertTriangle, Code, Copy, RotateCcw, RotateCw, UserRound } from "lucide-react"
import { toast } from "sonner"
import { Link } from "@/components/tenant-link"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { useSignatureSource } from "../hooks/use-signature-source"
import {
  DEFAULT_SIGNATURE_OPTIONS,
  GMAIL_SIGNATURE_LIMIT,
  buildSignatureHtml,
  buildSignatureText,
  isPlausiblePhone,
  isPublicImageUrl,
  normaliseUrl,
  type SignatureOptions,
  type SignatureSource,
} from "../lib/signature"
import { ToolPage } from "./tool-page"

export function EmailSignature() {
  const { data: source, isPending, isError, error, refetch, isRefetching } = useSignatureSource()

  return (
    <ToolPage slug="email-signature">
      {isPending ? (
        <LoadingState />
      ) : isError ? (
        <Card>
          <CardContent className="p-5">
            <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center">
              <AlertTriangle className="text-destructive h-8 w-8" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Couldn&apos;t load your details</p>
                <p className="text-muted-foreground text-xs">
                  {error?.message || "Check your connection and try again."}
                </p>
              </div>
              <Button
                variant="outline"
                className="gap-1.5"
                disabled={isRefetching}
                onClick={() => void refetch()}
              >
                <RotateCw className="h-4 w-4" />
                Try again
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : !source ? (
        <EmptyState
          variant="card"
          icon={UserRound}
          title="No employee profile found"
          description="Your signature is built from your DNMS employee profile, and this account doesn't have one. Ask HR to set it up."
        />
      ) : (
        <SignatureBuilder source={source} />
      )}
    </ToolPage>
  )
}

function SignatureBuilder({ source }: { source: SignatureSource }) {
  const [opts, setOpts] = useState<SignatureOptions>(DEFAULT_SIGNATURE_OPTIONS)
  const preview = useRef<HTMLDivElement>(null)
  const set = <K extends keyof SignatureOptions>(key: K, value: SignatureOptions[K]) =>
    setOpts((o) => ({ ...o, [key]: value }))

  const html = useMemo(() => buildSignatureHtml(source, opts), [source, opts])
  const text = useMemo(() => buildSignatureText(source, opts), [source, opts])

  const hasPhone = !!source.phone?.trim()
  const hasAddress = !!source.address?.trim()
  const hasSocials = source.socials.some((s) => normaliseUrl(s.url))
  const linkedinError =
    opts.linkedinUrl.trim() && !normaliseUrl(opts.linkedinUrl)
      ? "That doesn't look like a link. Try linkedin.com/in/your-name"
      : null
  const ctaUrlError =
    opts.ctaUrl.trim() && !normaliseUrl(opts.ctaUrl)
      ? "That doesn't look like a link. Try calendly.com/your-name"
      : null
  const phoneWarning =
    opts.extraPhone.trim() && !isPlausiblePhone(opts.extraPhone)
      ? "Check the number - use digits, spaces, + or -."
      : null
  const changed = JSON.stringify(opts) !== JSON.stringify(DEFAULT_SIGNATURE_OPTIONS)
  const imagesPrivate = !!source.logoUrl && !isPublicImageUrl(source.logoUrl)
  const imageHost = source.logoUrl ? new URL(source.logoUrl).host : ""

  async function copySignature() {
    try {
      if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
        throw new Error("Rich copy not supported")
      }
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ])
      toast.success("Signature copied - paste it into Gmail or Outlook")
    } catch {
      // Older browsers: copy the preview itself, the way a person would.
      if (copyBySelecting()) toast.success("Signature copied - paste it into Gmail or Outlook")
      else toast.error("Your browser blocked copying. Select the preview and press Ctrl+C.")
    }
  }

  function copyBySelecting(): boolean {
    const node = preview.current
    const selection = window.getSelection()
    if (!node || !selection) return false
    const range = document.createRange()
    range.selectNodeContents(node)
    selection.removeAllRanges()
    selection.addRange(range)
    let ok = false
    try {
      ok = document.execCommand("copy")
    } catch {
      ok = false
    }
    selection.removeAllRanges()
    return ok
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(html)
      toast.success("HTML code copied")
    } catch {
      // Fallback: a hidden textarea and the old copy command.
      const area = document.createElement("textarea")
      area.value = html
      area.setAttribute("readonly", "")
      area.style.position = "fixed"
      area.style.opacity = "0"
      document.body.appendChild(area)
      area.select()
      let ok = false
      try {
        ok = document.execCommand("copy")
      } catch {
        ok = false
      }
      area.remove()
      if (ok) toast.success("HTML code copied")
      else toast.error("Your browser blocked copying - try another browser")
    }
  }

  // Links in the preview open in a new tab, so checking one doesn't leave DNMS.
  function openPreviewLink(e: MouseEvent<HTMLDivElement>) {
    const anchor = (e.target as HTMLElement).closest("a")
    if (!anchor) return
    e.preventDefault()
    window.open(anchor.href, "_blank", "noopener,noreferrer")
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,34rem)]">
        <Card>
          <CardContent className="space-y-6 p-5">
            <div className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold">From your profile</h2>
                <p className="text-muted-foreground text-xs">
                  Filled in from DNMS. To fix your phone, edit{" "}
                  <Link href="/profile" className="text-primary underline-offset-2 hover:underline">
                    My Profile
                  </Link>
                  . For your name or job title, ask HR.
                </p>
              </div>
              <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                <ProfileItem label="Name" value={source.name} />
                <ProfileItem label="Job title" value={source.designation} />
                <ProfileItem label="Email" value={source.email} />
                <ProfileItem label="Phone" value={source.phone} />
              </dl>
            </div>

            <div className="space-y-4 border-t pt-5">
              <div>
                <h2 className="text-sm font-semibold">Change this copy</h2>
                <p className="text-muted-foreground text-xs">
                  Only for the signature you copy now - nothing is saved to your profile.
                </p>
              </div>

              <SwitchRow
                id="sig-show-phone"
                label="Show my phone number"
                checked={hasPhone && opts.showPhone}
                disabled={!hasPhone}
                onCheckedChange={(v) => set("showPhone", v)}
                help={hasPhone ? undefined : "There's no phone number on your profile."}
              />

              <div className="space-y-2">
                <Label htmlFor="sig-extra-phone">Another phone (optional)</Label>
                <Input
                  id="sig-extra-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  maxLength={40}
                  value={opts.extraPhone}
                  onChange={(e) => set("extraPhone", e.target.value)}
                  placeholder="An office line, e.g. 011 4567 8900"
                  aria-describedby={phoneWarning ? "sig-extra-phone-msg" : undefined}
                />
                {phoneWarning && (
                  <p
                    id="sig-extra-phone-msg"
                    className="text-xs text-amber-600 dark:text-amber-400"
                  >
                    {phoneWarning}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="sig-linkedin">Your LinkedIn profile (optional)</Label>
                <Input
                  id="sig-linkedin"
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  maxLength={200}
                  value={opts.linkedinUrl}
                  onChange={(e) => set("linkedinUrl", e.target.value)}
                  placeholder="linkedin.com/in/your-name"
                  aria-invalid={!!linkedinError}
                  aria-describedby={linkedinError ? "sig-linkedin-msg" : undefined}
                />
                {linkedinError && (
                  <p id="sig-linkedin-msg" className="text-destructive text-xs">
                    {linkedinError}
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sig-cta-text">Short line (optional)</Label>
                  <Input
                    id="sig-cta-text"
                    maxLength={80}
                    value={opts.ctaText}
                    onChange={(e) => set("ctaText", e.target.value)}
                    placeholder="Book a call with me"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sig-cta-url">Link for the line (optional)</Label>
                  <Input
                    id="sig-cta-url"
                    type="url"
                    inputMode="url"
                    autoComplete="off"
                    maxLength={300}
                    value={opts.ctaUrl}
                    onChange={(e) => set("ctaUrl", e.target.value)}
                    placeholder="calendly.com/your-name"
                    aria-invalid={!!ctaUrlError}
                    aria-describedby={
                      ctaUrlError || (opts.ctaUrl.trim() && !opts.ctaText.trim())
                        ? "sig-cta-url-msg"
                        : undefined
                    }
                  />
                  {ctaUrlError ? (
                    <p id="sig-cta-url-msg" className="text-destructive text-xs">
                      {ctaUrlError}
                    </p>
                  ) : opts.ctaUrl.trim() && !opts.ctaText.trim() ? (
                    <p id="sig-cta-url-msg" className="text-muted-foreground text-xs">
                      Add the short line too - the link sits on it.
                    </p>
                  ) : null}
                </div>
              </div>

              {hasAddress && (
                <SwitchRow
                  id="sig-show-address"
                  label="Show the office address"
                  checked={opts.showAddress}
                  onCheckedChange={(v) => set("showAddress", v)}
                />
              )}
              {hasSocials && (
                <SwitchRow
                  id="sig-show-socials"
                  label="Show the company's social media icons"
                  checked={opts.showSocials}
                  onCheckedChange={(v) => set("showSocials", v)}
                />
              )}

              {changed && (
                <Button
                  variant="ghost"
                  className="text-muted-foreground -mt-1 gap-1.5 px-2"
                  onClick={() => setOpts(DEFAULT_SIGNATURE_OPTIONS)}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Start over
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="xl:sticky xl:top-20 xl:self-start">
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold">Preview</h2>
                <p className="text-muted-foreground text-xs">
                  This is how it looks in an email. Click a link to check it.
                </p>
              </div>
              {/* White whatever the theme (the signature is designed for it); focusable as it scrolls on phones. */}
              <div
                role="region"
                aria-label="Signature preview"
                tabIndex={0}
                className="focus-visible:ring-ring overflow-x-auto rounded-sm border bg-white p-4 focus-visible:ring-2 focus-visible:outline-none"
              >
                <div
                  ref={preview}
                  onClick={openPreviewLink}
                  // Built by lib/signature.ts: every value is escaped and every
                  // link is checked to be http(s) before it gets here.
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button className="gap-1.5" onClick={copySignature}>
                  <Copy className="h-4 w-4" />
                  Copy signature
                </Button>
                <Button variant="outline" className="gap-1.5" onClick={copyCode}>
                  <Code className="h-4 w-4" />
                  Copy HTML code
                </Button>
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                &quot;Copy signature&quot; pastes with its design into Gmail or Outlook. &quot;Copy
                HTML code&quot; is for apps that ask for HTML.
              </p>

              {imagesPrivate && (
                <Warning>
                  The logo and icons load from {imageHost}, which people outside can&apos;t reach,
                  so they&apos;d see broken pictures. Copy your signature from DNMS on its live web
                  address instead.
                </Warning>
              )}
              {html.length > GMAIL_SIGNATURE_LIMIT && (
                <Warning>
                  This is too long for Gmail ({GMAIL_SIGNATURE_LIMIT.toLocaleString("en-IN")}{" "}
                  characters max). Shorten the extra lines.
                </Warning>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <HowToAdd />
    </div>
  )
}

function ProfileItem({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="truncate">
        {value?.trim() || <span className="text-muted-foreground">-</span>}
      </dd>
    </div>
  )
}

function SwitchRow({
  id,
  label,
  help,
  checked,
  disabled,
  onCheckedChange,
}: {
  id: string
  label: string
  help?: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start gap-3">
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        aria-describedby={help ? `${id}-help` : undefined}
      />
      <div className="space-y-1">
        <Label htmlFor={id} className="mb-0 font-normal">
          {label}
        </Label>
        {help && (
          <p id={`${id}-help`} className="text-muted-foreground text-xs">
            {help}
          </p>
        )}
      </div>
    </div>
  )
}

function Warning({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  )
}

const GMAIL_STEPS = [
  "Click Copy signature above.",
  "In Gmail, click the gear icon, then See all settings.",
  "On the General tab, scroll to Signature and click Create new. Give it a name.",
  "Click in the signature box and paste (Ctrl+V, or Cmd+V on a Mac).",
  "Under Signature defaults, pick it for new emails and for replies.",
  "Scroll to the bottom and click Save Changes.",
]

const OUTLOOK_STEPS = [
  "Click Copy signature above.",
  "In Outlook (web or the new Outlook app), open Settings, then Accounts, then Signatures.",
  "Click New signature, give it a name, and paste into the box.",
  "Pick it as the default for new messages and for replies.",
  "Click Save.",
]

function HowToAdd() {
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <h2 className="text-sm font-semibold">How to add it</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <Steps title="Gmail" steps={GMAIL_STEPS} />
          <div className="space-y-3">
            <Steps title="Outlook" steps={OUTLOOK_STEPS} />
            <p className="text-muted-foreground text-xs leading-relaxed">
              Classic Outlook on Windows: File, then Options, then Mail, then Signatures. Click New,
              paste, set the defaults and click OK.
            </p>
          </div>
        </div>
        <p className="text-muted-foreground border-t pt-4 text-xs leading-relaxed">
          The logo and icons load from the DNMS website, so they show for everyone you email. If
          your details change, come back and copy it again.
        </p>
      </CardContent>
    </Card>
  )
}

function Steps({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">{title}</h3>
      <ol className="text-muted-foreground list-decimal space-y-1.5 pl-5 text-sm">
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
    </div>
  )
}

function LoadingState() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading your details"
      className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,34rem)]"
    >
      <Card>
        <CardContent className="space-y-4 p-5">
          <Skeleton className="h-4 w-32" />
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-4 p-5">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-36 w-full" />
          <div className="grid gap-2 sm:grid-cols-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
