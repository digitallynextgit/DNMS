// The same block DNMS puts under leave / WFH emails (renderSignature() in lib/email-layout.ts).
// Email-safe on purpose: tables and inline styles only (Gmail/Outlook strip <style>), images only
// by absolute public URL with explicit width/height (Outlook desktop otherwise draws them at 2x).

/** lib/email-layout.ts BRAND_NAME - that file is server-only, so it is mirrored here. */
export const BRAND_NAME = "Digitally Next"

/** Gmail refuses a signature longer than this many characters. */
export const GMAIL_SIGNATURE_LIMIT = 10_000

const RED = "#e5231b"
const INK = "#1a1a1a"
const BODY = "#374151"
const FONT = "font-family:Arial,Helvetica,sans-serif;"

/** The brand mark is 118x104 px; it's drawn 52 px tall like the email signature. */
const LOGO_HEIGHT = 52
const LOGO_WIDTH = 59

/** Same shape as the `signature` the leave / WFH apply previews return (MailSignatureData). */
export interface SignatureSource {
  name: string
  designation: string | null
  email: string | null
  phone: string | null
  website: string | null
  address: string | null
  /** Absolute URL of the brand mark. The hosted icons sit next to it. */
  logoUrl: string | null
  socials: { label: string; url: string }[]
}

/** What the person changed for this copy only - nothing is saved to their profile. */
export interface SignatureOptions {
  showPhone: boolean
  extraPhone: string
  linkedinUrl: string
  /** A short line under the signature, e.g. "Book a call with me". */
  ctaText: string
  ctaUrl: string
  showAddress: boolean
  showSocials: boolean
}

export const DEFAULT_SIGNATURE_OPTIONS: SignatureOptions = {
  showPhone: true,
  extraPhone: "",
  linkedinUrl: "",
  ctaText: "",
  ctaUrl: "",
  showAddress: true,
  showSocials: true,
}

export function escapeHtml(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** Adds https:// when missing; anything not http(s) (javascript:, mailto:, data:) is refused. */
export function normaliseUrl(input: string | null | undefined): string | null {
  const raw = (input ?? "").trim()
  if (!raw || /\s/.test(raw)) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`
  try {
    const url = new URL(withScheme)
    if (url.protocol !== "https:" && url.protocol !== "http:") return null
    if (!url.hostname.includes(".")) return null
    return url.href
  } catch {
    return null
  }
}

/** "https://www.linkedin.com/in/riya/" -> "linkedin.com/in/riya", for display. */
export function displayUrl(url: string): string {
  return url
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/$/, "")
}

/** A phone number: digits with the usual + - ( ) . / spaces, and an optional "ext". */
export function isPlausiblePhone(value: string): boolean {
  const v = value.trim()
  return (
    /^[+()\d][\d\s()+\-./]*(\s*(ext\.?|x)\s*\d+)?$/i.test(v) && /\d{3}/.test(v.replace(/\D/g, ""))
  )
}

/** Absolute https on a real host - a localhost or http link breaks in everyone else's inbox. */
export function isPublicImageUrl(url: string | null | undefined): boolean {
  if (!url) return false
  try {
    const u = new URL(url)
    if (u.protocol !== "https:") return false
    const host = u.hostname.toLowerCase()
    if (host === "localhost" || host.endsWith(".local") || host.endsWith(".localhost")) {
      return false
    }
    if (/^(127\.|10\.|192\.168\.|0\.0\.0\.0)/.test(host)) return false
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false
    return host.includes(".")
  } catch {
    return false
  }
}

/** Mirrors signatureIconUrl() on the server. */
export function signatureIconUrl(logoUrl: string, name: string): string {
  return new URL(`email-icons/${name}.png`, logoUrl).href
}

function website(source: SignatureSource): { text: string; href: string } | null {
  const text = source.website?.trim()
  if (!text) return null
  const href = normaliseUrl(text)
  return href ? { text, href } : null
}

const SOCIAL_ORDER = [
  { label: "YouTube", icon: "youtube" },
  { label: "Instagram", icon: "instagram" },
  { label: "LinkedIn", icon: "linkedin" },
] as const

function companySocials(source: SignatureSource) {
  return SOCIAL_ORDER.flatMap(({ label, icon }) => {
    const found = source.socials.find((s) => s.label.toLowerCase() === label.toLowerCase())
    const href = normaliseUrl(found?.url)
    return href ? [{ label, icon, href }] : []
  })
}

/** Images get max-width:none: a global img { max-width: 100% } would shrink the logo cell to 0. */
export function buildSignatureHtml(source: SignatureSource, opts: SignatureOptions): string {
  const logo = source.logoUrl
  const icon = (name: string) => (logo ? signatureIconUrl(logo, name) : "")
  const body = `${FONT} font-size:12px; color:${BODY};`
  const link = `${FONT} font-size:12px; color:${BODY}; text-decoration:none;`

  // inline-block keeps the icon on the text's line where images are made block-level.
  const iconText = (name: string, inner: string) =>
    `<span style="white-space:nowrap;">${
      logo
        ? `<img src="${escapeHtml(icon(name))}" width="13" height="13" alt="" style="display:inline-block; width:13px; height:13px; max-width:none; border:0; vertical-align:-2px; margin-right:5px;" />`
        : ""
    }${inner}</span>`

  const socials = opts.showSocials && logo ? companySocials(source) : []
  const socialIcons = socials
    .map(
      (s) =>
        `<a href="${escapeHtml(s.href)}" style="display:inline-block; margin-left:6px; text-decoration:none;"><img src="${escapeHtml(icon(s.icon))}" alt="${s.label}" width="20" height="20" style="display:inline-block; width:20px; height:20px; max-width:none; border:0;" /></a>`,
    )
    .join("")

  const phone = opts.showPhone ? source.phone?.trim() : ""
  const extraPhone = opts.extraPhone.trim()
  const site = website(source)
  const contactLine = [
    phone ? iconText("phone", `<span style="${body}">${escapeHtml(phone)}</span>`) : "",
    extraPhone ? iconText("phone", `<span style="${body}">${escapeHtml(extraPhone)}</span>`) : "",
    site
      ? iconText(
          "globe",
          `<a href="${escapeHtml(site.href)}" style="${link}">${escapeHtml(site.text)}</a>`,
        )
      : "",
  ]
    .filter(Boolean)
    .join(`<span style="${body}">&nbsp;&nbsp;&nbsp;&nbsp;</span>`)

  const email = source.email?.trim()
  const linkedin = normaliseUrl(opts.linkedinUrl)
  const address = opts.showAddress ? source.address?.trim() : ""
  const ctaText = opts.ctaText.trim()
  const ctaHref = normaliseUrl(opts.ctaUrl)
  const ctaStyle = `${FONT} font-size:12px; font-weight:700; color:${RED}; text-decoration:none;`

  const designation = source.designation?.trim()
  const titleLine = designation ? `${escapeHtml(designation)}, ${BRAND_NAME}` : BRAND_NAME
  // A rule that survives editors which drop empty elements.
  const rule = (margin: string) =>
    `<div style="border-top:1.5px solid ${RED}; margin:${margin}; font-size:1px; line-height:1px;">&nbsp;</div>`
  const row = (inner: string, margin = "0 0 5px") => `<div style="margin:${margin};">${inner}</div>`

  return [
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">`,
    `<tr>`,
    logo
      ? `<td style="padding:0 16px 0 0; vertical-align:top;"><img src="${escapeHtml(logo)}" alt="${BRAND_NAME}" width="${LOGO_WIDTH}" height="${LOGO_HEIGHT}" style="display:block; width:${LOGO_WIDTH}px; height:${LOGO_HEIGHT}px; max-width:none; border:0;" /></td>`
      : "",
    `<td style="padding:0; vertical-align:top;">`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; border-collapse:collapse;"><tr>`,
    `<td style="padding:0; vertical-align:top;">`,
    `<div style="${FONT} font-size:15px; font-weight:700; color:${INK};">${escapeHtml(source.name)}</div>`,
    `<div style="${FONT} font-size:13px; font-weight:700; color:${INK}; margin-top:1px;">${titleLine}</div>`,
    `</td>`,
    socialIcons
      ? `<td align="right" style="padding:0 0 0 12px; vertical-align:top; white-space:nowrap;">${socialIcons}</td>`
      : "",
    `</tr></table>`,
    rule("10px 0"),
    contactLine ? row(contactLine) : "",
    email
      ? row(
          iconText(
            "mail",
            `<a href="mailto:${escapeHtml(email)}" style="${link}">${escapeHtml(email)}</a>`,
          ),
        )
      : "",
    linkedin
      ? row(
          iconText(
            "linkedin",
            `<a href="${escapeHtml(linkedin)}" style="${link}">${escapeHtml(displayUrl(linkedin))}</a>`,
          ),
        )
      : "",
    address
      ? row(iconText("pin", `<span style="${body}">${escapeHtml(address)}</span>`), "0 0 2px")
      : "",
    rule("12px 0 0"),
    ctaText
      ? row(
          ctaHref
            ? `<a href="${escapeHtml(ctaHref)}" style="${ctaStyle}">${escapeHtml(ctaText)}</a>`
            : `<span style="${ctaStyle}">${escapeHtml(ctaText)}</span>`,
          "8px 0 0",
        )
      : "",
    `</td>`,
    `</tr>`,
    `</table>`,
  ]
    .filter(Boolean)
    .join("")
}

export function buildSignatureText(source: SignatureSource, opts: SignatureOptions): string {
  const phone = opts.showPhone ? source.phone?.trim() : ""
  const extraPhone = opts.extraPhone.trim()
  const site = website(source)
  const linkedin = normaliseUrl(opts.linkedinUrl)
  const ctaText = opts.ctaText.trim()
  const ctaHref = normaliseUrl(opts.ctaUrl)
  const designation = source.designation?.trim()

  return [
    source.name,
    designation ? `${designation}, ${BRAND_NAME}` : BRAND_NAME,
    [phone, extraPhone, site?.text].filter(Boolean).join(" | "),
    source.email?.trim(),
    linkedin ? `LinkedIn: ${displayUrl(linkedin)}` : "",
    opts.showAddress ? source.address?.trim() : "",
    ctaText ? (ctaHref ? `${ctaText}: ${ctaHref}` : ctaText) : "",
  ]
    .filter(Boolean)
    .join("\n")
}
