"use client"

import { Phone, Globe, Mail, MapPin } from "lucide-react"

export interface MailSignatureData {
  name: string
  designation: string | null
  email: string | null
  phone: string | null
  website: string | null
  address: string | null
  logoUrl: string | null
  socials: { label: string; url: string }[]
}

/** Brand accent colours (theme-independent). Text/surfaces use theme tokens so
 *  the block sits on the default background, not a white card. */
const SIG_RED = "#e5231b"
const SIG_TEAL = "#25c1c1"

/** Brand glyphs as inline SVG (lucide dropped its social icons over trademark). */
function YouTubeGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M23 7.5a3 3 0 0 0-2.1-2.1C19 5 12 5 12 5s-7 0-8.9.4A3 3 0 0 0 1 7.5 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.5a3 3 0 0 0 2.1 2.1C5 19 12 19 12 19s7 0 8.9-.4a3 3 0 0 0 2.1-2.1A31 31 0 0 0 23.5 12 31 31 0 0 0 23 7.5zM9.75 15.5v-7l6 3.5-6 3.5z" />
    </svg>
  )
}
function InstagramGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}
function LinkedInGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M4.98 3.5A2.5 2.5 0 1 1 5 8.5a2.5 2.5 0 0 1-.02-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-1 1.83-2.05 3.75-2.05 4 0 4.75 2.6 4.75 6V21h-4v-5.3c0-1.26-.02-2.9-1.77-2.9-1.77 0-2.04 1.38-2.04 2.8V21H9z" />
    </svg>
  )
}

const SIG_SOCIALS = [
  { label: "YouTube", Icon: YouTubeGlyph },
  { label: "Instagram", Icon: InstagramGlyph },
  { label: "LinkedIn", Icon: LinkedInGlyph },
] as const

/** The signature block, mirroring renderSignature() in the email template so the
 *  preview matches what's actually sent. Shared by the apply preview and the
 *  approve/reject dialog. */
export function MailSignature({ sig }: { sig: MailSignatureData }) {
  const hrefFor = (label: string) =>
    sig.socials.find((s) => s.label.toLowerCase() === label.toLowerCase())?.url
  const websiteHref = sig.website
    ? sig.website.startsWith("http")
      ? sig.website
      : `https://${sig.website}`
    : undefined

  return (
    <div className="mt-4">
      <div className="flex gap-4">
        {sig.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={sig.logoUrl}
            alt="Digitally Next"
            className="h-14 w-auto shrink-0 self-start object-contain"
          />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-foreground text-[15px] leading-tight font-bold">{sig.name}</p>
              <p className="text-foreground text-[13px] leading-tight font-bold">
                {sig.designation ? `${sig.designation}, ` : ""}Digitally Next
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {SIG_SOCIALS.map(({ label, Icon }) => {
                const href = hrefFor(label)
                const pill = (
                  <span
                    className="flex h-6 w-6 items-center justify-center text-white"
                    style={{ backgroundColor: SIG_TEAL }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                )
                return href ? (
                  <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label}>
                    {pill}
                  </a>
                ) : (
                  <span key={label} aria-label={label}>
                    {pill}
                  </span>
                )
              })}
            </div>
          </div>

          <div className="my-2.5" style={{ borderTop: `1.5px solid ${SIG_RED}` }} />

          <div className="text-muted-foreground space-y-1.5 text-[12px]">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-1.5">
              {sig.phone && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 shrink-0" style={{ color: SIG_RED }} /> {sig.phone}
                </span>
              )}
              {sig.website && (
                <span className="inline-flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 shrink-0" style={{ color: SIG_RED }} />
                  {websiteHref ? (
                    <a href={websiteHref} className="hover:text-foreground no-underline">
                      {sig.website}
                    </a>
                  ) : (
                    sig.website
                  )}
                </span>
              )}
            </div>
            {sig.email && (
              <div className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 shrink-0" style={{ color: SIG_RED }} /> {sig.email}
              </div>
            )}
            {sig.address && (
              <div className="flex items-start gap-1.5">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: SIG_RED }} />
                <span>{sig.address}</span>
              </div>
            )}
          </div>

          <div className="mt-3" style={{ borderTop: `1.5px solid ${SIG_RED}` }} />
        </div>
      </div>
    </div>
  )
}
