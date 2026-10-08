// Last-mile fixes on outgoing campaign HTML. Pasted designer HTML doesn't get the editor's
// responsive images, so it's enforced here, where every body passes.

/** `border:0` stops Outlook/old Yahoo drawing a blue border round linked images. */
const RESPONSIVE_STYLE = "max-width:100%;height:auto;display:block;border:0;"

const IMG_TAG = /<img\b[^>]*>/gi
const STYLE_ATTR = /style\s*=\s*(["'])([\s\S]*?)\1/i
/** A width in PIXELS pins the image open; a percentage is already fluid. */
const FIXED_WIDTH_ATTR = /\swidth\s*=\s*(["']?)(\d+)\1(?=[\s/>])/i
const FIXED_HEIGHT_ATTR = /\sheight\s*=\s*(["']?)(\d+)\1(?=[\s/>])/i

/**
 * Make every image scale to the reader's screen. Tags that already set max-width are left alone;
 * a fixed height goes with a fixed width so the aspect ratio holds.
 */
export function makeImagesResponsive(html: string): string {
  return html.replace(IMG_TAG, (tag) => {
    if (/max-width\s*:/i.test(tag)) return tag

    let out = tag
    // A pixel width attribute beats max-width in several clients.
    if (FIXED_WIDTH_ATTR.test(out)) {
      out = out.replace(FIXED_WIDTH_ATTR, "").replace(FIXED_HEIGHT_ATTR, "")
    }

    const style = out.match(STYLE_ATTR)
    if (style) {
      const existing = style[2] ?? ""
      const merged = `${existing.trim().replace(/;+$/, "")};${RESPONSIVE_STYLE}`.replace(/^;/, "")
      return out.replace(STYLE_ATTR, `style="${merged}"`)
    }
    return out.replace(/<img\b/i, `<img style="${RESPONSIVE_STYLE}"`)
  })
}
