import type { HelpGuide, HelpLang, L10n } from "../types"

export function tr(text: L10n, lang: HelpLang): string {
  return text[lang]
}

/** Everything a search should look at, in BOTH languages - people search in either. */
function haystack(guide: HelpGuide): string {
  const parts: string[] = [
    guide.title.en,
    guide.title.hi,
    guide.summary.en,
    guide.summary.hi,
    ...(guide.keywords ?? []),
  ]
  for (const s of guide.sections) {
    parts.push(s.title.en, s.title.hi)
    for (const step of s.steps ?? []) parts.push(step.text.en, step.text.hi)
    for (const f of s.faq ?? []) parts.push(f.q.en, f.q.hi)
  }
  return parts.join(" ").toLowerCase()
}

const HAYSTACKS = new WeakMap<HelpGuide, string>()

/** Every word of the query must appear somewhere in the guide. */
export function guideMatches(guide: HelpGuide, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  let text = HAYSTACKS.get(guide)
  if (text === undefined) {
    text = haystack(guide)
    HAYSTACKS.set(guide, text)
  }
  return words.every((w) => text.includes(w))
}
