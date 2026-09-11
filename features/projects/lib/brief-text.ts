/**
 * Make the model's prose match where it is actually shown.
 *
 * The brief is rendered in a <pre> and pasted into a plain textarea, so every
 * # and ** arrives as literal punctuation rather than a heading. A prompt can
 * ASK for plain text; this is what guarantees it - models drift back to
 * markdown on a long answer however firmly they were told not to.
 *
 * Em and en dashes go to a hyphen for the same reason they do everywhere else
 * in this codebase: they are indistinguishable from a minus in most UI fonts.
 */
export function tidyBrief(raw: string): string {
  return (
    raw
      // Headings: keep the words, drop the hashes.
      .replace(/^[ \t]*#{1,6}[ \t]+/gm, "")
      // Bold/italic markers, which read as stray asterisks in a <pre>.
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1$2")
      // Dashes.
      .replace(/[\u2014\u2013]/g, "-")
      // A heading followed by three blank lines is the other markdown tell.
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  )
}
