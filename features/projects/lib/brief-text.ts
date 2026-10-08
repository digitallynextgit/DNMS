/**
 * Strip markdown from the model's brief: it shows in a <pre> / plain textarea, and models drift back
 * to markdown however firmly told not to. Dashes become hyphens (they look like a minus).
 */
export function tidyBrief(raw: string): string {
  return (
    raw
      // Headings: keep the words, drop the hashes.
      .replace(/^[ \t]*#{1,6}[ \t]+/gm, "")
      // Bold/italic markers.
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1$2")
      .replace(/[\u2014\u2013]/g, "-")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  )
}
