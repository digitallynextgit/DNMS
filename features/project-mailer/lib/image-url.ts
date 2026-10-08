// Email <img src> must be absolute and public (the recipient's client resolves it). The host is
// set at upload and rewritten again at send time, so old or moved hosts still work.

export const MAILER_IMAGE_PATH = "/api/public/mailer-image/"

/** Strip a trailing slash so joins never produce "//api/…". */
export function normalizeBase(base: string): string {
  return base.trim().replace(/\/+$/, "")
}

export function mailerImageUrl(base: string, assetId: string): string {
  return `${normalizeBase(base)}${MAILER_IMAGE_PATH}${assetId}`
}

/** Point every campaign image at `base`, absolute or relative. With no base, html is left as is. */
export function absolutizeMailerImages(html: string, base: string): string {
  const clean = normalizeBase(base)
  if (!clean) return html
  return html.replace(
    /(?:https?:\/\/[^\s"'<>]*?)?\/api\/public\/mailer-image\//gi,
    `${clean}${MAILER_IMAGE_PATH}`,
  )
}
