/**
 * Last-mile fixes applied to campaign HTML on its way out.
 *
 * These exist because a body is not always something our editor produced: people
 * paste finished HTML from a designer, and that markup arrives exactly as
 * written. The editor inserts responsive images already - pasted markup does not,
 * and a bare <img> renders at its natural width (1200px here) inside a phone-width
 * inbox, which is how a campaign went out that had to be scrolled sideways to read.
 *
 * So the rule is enforced where every body passes through, not where we happen to
 * control the input.
 */

/**
 * What makes an image behave inside an email column on any screen.
 *
 * `border:0` is not decoration: Outlook and older Yahoo draw a blue link border
 * around any image wrapped in an <a>, which is exactly what a clickable banner is.
 */
const RESPONSIVE_STYLE = "max-width:100%;height:auto;display:block;border:0;"

const IMG_TAG = /<img\b[^>]*>/gi
const STYLE_ATTR = /style\s*=\s*(["'])([\s\S]*?)\1/i
/** A width in PIXELS pins the image open; a percentage is already fluid. */
const FIXED_WIDTH_ATTR = /\swidth\s*=\s*(["']?)(\d+)\1(?=[\s/>])/i
const FIXED_HEIGHT_ATTR = /\sheight\s*=\s*(["']?)(\d+)\1(?=[\s/>])/i

/**
 * Make every image in the body scale down to the reader's screen.
 *
 * Leaves a tag alone if it already sets max-width - a designer who wrote their
 * own constraint meant it, and overriding it would be us breaking their layout
 * rather than fixing it.
 *
 * A hard `height` attribute is dropped alongside a hard `width`: keeping it while
 * the width becomes fluid is what squashes an image out of its aspect ratio.
 */
export function makeImagesResponsive(html: string): string {
  return html.replace(IMG_TAG, (tag) => {
    if (/max-width\s*:/i.test(tag)) return tag

    let out = tag
    // A pixel width attribute beats max-width in several clients, so it has to go.
    // The style below is what sizes the image from here on.
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
