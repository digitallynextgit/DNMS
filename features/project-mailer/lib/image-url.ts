// =============================================================================
// Campaign image URLs
// =============================================================================
// An <img src> in an email is resolved by the RECIPIENT'S mail client, which has
// no origin of its own and no access to our network. It must therefore be an
// absolute, publicly reachable URL.
//
// A first campaign went out with "http://localhost:3000/api/public/mailer-image/…"
// baked into the body, because the upload route read NEXTAUTH_URL (the dev value)
// instead of the configured APP_URL. Every recipient got a broken image.
//
// So the host is resolved in TWO places on purpose:
//   • at upload time, so the editor and preview show a working image, and
//   • again at SEND time, which rewrites whatever host is stored.
//
// The second pass is what makes this durable: bodies saved before the fix, and
// bodies saved on somebody's laptop, are corrected on the way out, and moving
// DNMS to a new domain does not break every template ever written.
// =============================================================================

export const MAILER_IMAGE_PATH = "/api/public/mailer-image/"

/** Strip a trailing slash so joins never produce "//api/…". */
export function normalizeBase(base: string): string {
  return base.trim().replace(/\/+$/, "")
}

export function mailerImageUrl(base: string, assetId: string): string {
  return `${normalizeBase(base)}${MAILER_IMAGE_PATH}${assetId}`
}

/**
 * Point every campaign image at `base`, whatever host is currently written.
 *
 * Matches an optional scheme+host in front of the known path, so it repairs
 * absolute URLs (localhost, an old domain) and resolves bare relative ones. With
 * no base configured it returns the html untouched - rewriting to "" would turn
 * working absolute URLs into broken relative ones, which is worse than leaving
 * them alone.
 */
export function absolutizeMailerImages(html: string, base: string): string {
  const clean = normalizeBase(base)
  if (!clean) return html
  return html.replace(
    /(?:https?:\/\/[^\s"'<>]*?)?\/api\/public\/mailer-image\//gi,
    `${clean}${MAILER_IMAGE_PATH}`,
  )
}
