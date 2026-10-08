let graphemeSegmenter: Intl.Segmenter | null | undefined

function getSegmenter(): Intl.Segmenter | null {
  if (graphemeSegmenter === undefined) {
    graphemeSegmenter =
      typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
        ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
        : null
  }
  return graphemeSegmenter
}

/** "👍🏽", "🇮🇳" and "स्ते" are one each. Falls back to code points without Intl.Segmenter. */
export function graphemes(text: string): string[] {
  const seg = getSegmenter()
  return seg ? Array.from(seg.segment(text), (s) => s.segment) : Array.from(text)
}

/** Emoji drawn as pictures - not © or ™, which need a variation selector to become emoji. */
const EMOJI_RE = /\p{Emoji_Presentation}|\p{Extended_Pictographic}️|⃣/u
export function isEmoji(grapheme: string): boolean {
  return EMOJI_RE.test(grapheme)
}

const HAS_WORD_CHAR = /[\p{L}\p{N}]/u

/** Words: runs between spaces that have a letter or digit (so "—" and "🔥" alone don't count). */
export function countWords(text: string): number {
  let n = 0
  for (const token of text.split(/\s+/)) if (HAS_WORD_CHAR.test(token)) n++
  return n
}

/** Splits after . ! ? … or the Hindi danda (।), and at line breaks. An estimate ("e.g." splits). */
export function countSentences(text: string): number {
  return text.split(/(?<=[.!?…।॥]["'”’)\]]*)\s+|\n+/u).filter((s) => HAS_WORD_CHAR.test(s)).length
}

/** Paragraphs: lines with something on them (as Word counts them). */
export function countParagraphs(text: string): number {
  return text.split(/\r?\n/).filter((line) => line.replace(/⠀/g, "").trim()).length
}

const HASHTAG_RE = /(?<![\p{L}\p{M}\p{N}_&/#＃])[#＃]([\p{L}\p{M}\p{N}_]+)/gu

/** Hashtags: #diwali, #दिवाली - but not "#1" or a link's #section. */
export function findHashtags(text: string): string[] {
  const tags: string[] = []
  for (const m of text.matchAll(HASHTAG_RE)) {
    const body = m[1] ?? ""
    if (!/^\d+$/.test(body)) tags.push(`#${body}`)
  }
  return tags
}

const MENTION_RE = /(?<![\p{L}\p{N}_.@])@([A-Za-z0-9_](?:[A-Za-z0-9_.]*[A-Za-z0-9_])?)/gu

/** Mentions: @handle - but not the @ in an email address. */
export function findMentions(text: string): string[] {
  return Array.from(text.matchAll(MENTION_RE), (m) => `@${m[1] ?? ""}`)
}

const TLDS =
  "com|in|net|org|co|io|ai|app|dev|me|info|biz|xyz|ly|gl|gle|to|tv|us|uk|site|online|store|shop|tech|link|page|gg|edu|gov|news|blog|live"
const LINK_RE = new RegExp(
  String.raw`(?:https?:\/\/|www\.)[^\s<>"'“”‘’]+` +
    "|" +
    String.raw`(?<![\p{L}\p{N}@._\-\/])[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.(?:${TLDS})(?![\p{L}\p{N}\-])(?:\/[^\s<>"'“”‘’]*)?`,
  "giu",
)

export interface TextSpan {
  start: number
  end: number
}

/** With or without https:// ("bit.ly/3AbCd"), minus a trailing full stop or bracket. */
export function findLinks(text: string): TextSpan[] {
  const spans: TextSpan[] = []
  for (const m of text.matchAll(LINK_RE)) {
    const start = m.index ?? 0
    const trimmed = m[0].replace(/[.,!?;:)\]}'"”’]+$/u, "")
    if (trimmed) spans.push({ start, end: start + trimmed.length })
  }
  return spans
}

export const WORDS_PER_MINUTE = 200

export interface TextStats {
  /** What people see as characters (emoji and Hindi conjuncts count once). */
  characters: number
  charactersNoSpaces: number
  words: number
  sentences: number
  paragraphs: number
  readingSeconds: number
  hashtags: number
  mentions: number
  emojis: number
  links: number
}

export function textStats(text: string): TextStats {
  const chars = graphemes(text)
  let spaces = 0
  let emojis = 0
  for (const g of chars) {
    if (/^\s+$/u.test(g)) spaces++
    else if (isEmoji(g)) emojis++
  }
  const words = countWords(text)
  return {
    characters: chars.length,
    charactersNoSpaces: chars.length - spaces,
    words,
    sentences: countSentences(text),
    paragraphs: countParagraphs(text),
    readingSeconds: words ? Math.max(1, Math.round((words / WORDS_PER_MINUTE) * 60)) : 0,
    hashtags: findHashtags(text).length,
    mentions: findMentions(text).length,
    emojis,
    links: findLinks(text).length,
  }
}

export function formatReadingTime(seconds: number): string {
  if (seconds < 60) return `${seconds} sec`
  return `${Math.round(seconds / 60)} min`
}

/** Instagram's cap on hashtags per post or reel. */
export const INSTAGRAM_MAX_HASHTAGS = 5
/** What X counts every link as, however long or short. */
export const X_LINK_LENGTH = 23

/** Code points X counts as one; everything else (Chinese, Japanese...) counts as two. */
function xLight(cp: number): boolean {
  return (
    cp <= 0x10ff ||
    (cp >= 0x2000 && cp <= 0x200d) ||
    (cp >= 0x2010 && cp <= 0x201f) ||
    (cp >= 0x2032 && cp <= 0x2037)
  )
}

function xWeight(text: string): number {
  let w = 0
  for (const g of graphemes(text)) {
    if (isEmoji(g)) {
      w += 2
      continue
    }
    for (const ch of g) w += xLight(ch.codePointAt(0) ?? 0) ? 1 : 2
  }
  return w
}

/** X's count (280 limit): links are 23, emoji 2, Latin and Indian scripts 1 per code point. */
export function xLength(text: string): number {
  const t = text.normalize("NFC")
  let total = 0
  let pos = 0
  for (const link of findLinks(t)) {
    total += xWeight(t.slice(pos, link.start)) + X_LINK_LENGTH
    pos = link.end
  }
  return total + xWeight(t.slice(pos))
}

/** The plain GSM alphabet SMS uses when it can: 160 per message. */
const GSM_BASIC = new Set(
  Array.from(
    "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà",
  ),
)
/** GSM characters that take two places each. */
const GSM_EXTENDED = new Set(Array.from("^{}\\[~]|€"))

export interface SmsInfo {
  /** "gsm" = plain English (160 per SMS); "unicode" = has Hindi, emoji, ₹, curly quotes... (70). */
  encoding: "gsm" | "unicode"
  units: number
  parts: number
  single: number
  /** Room in each part once a message is split (a little goes on joining them). */
  perPart: number
  left: number
  /** A few of the characters that forced the 70-per-SMS mode. */
  unusual: string[]
}

export function smsInfo(text: string): SmsInfo {
  let gsmUnits = 0
  let unicode = false
  const unusual = new Set<string>()
  for (const g of graphemes(text)) {
    let plain = true
    for (const ch of g) {
      if (GSM_BASIC.has(ch)) gsmUnits += 1
      else if (GSM_EXTENDED.has(ch)) gsmUnits += 2
      else plain = false
    }
    if (plain) continue
    unicode = true
    if (unusual.size < 5) unusual.add(/^\s+$/u.test(g) ? "special space" : g)
  }
  // Unicode SMS count UTF-16 units: most characters 1, emoji 2.
  const units = unicode ? text.length : gsmUnits
  const single = unicode ? 70 : 160
  const perPart = unicode ? 67 : 153
  const parts = units === 0 ? 0 : units <= single ? 1 : Math.ceil(units / perPart)
  const left = parts <= 1 ? single - units : parts * perPart - units
  return {
    encoding: unicode ? "unicode" : "gsm",
    units,
    parts,
    single,
    perPart,
    left,
    unusual: Array.from(unusual),
  }
}

export type LimitTone = "ok" | "near" | "over"

export const NEAR_SHARE = 0.9

/** Amber from 90%, red when over. A `guide` (not a hard limit) only ever turns amber. */
export function limitTone(count: number, limit: number, guide = false): LimitTone {
  if (count > limit) return guide ? "near" : "over"
  if (!guide && count >= limit * NEAR_SHARE) return "near"
  return "ok"
}

/** Tokens and the spaces between them, in order: ["Hello", " ", "world"]. */
function tokens(text: string): string[] {
  return text.split(/(\s+)/)
}

const isSpace = (t: string) => /^\s+$/.test(t)
const hasLink = (t: string) => findLinks(t).length > 0
/** Hashtags and @mentions keep their own capitals in Title / Sentence case. */
const isTagOrMention = (t: string) => /^[("'“‘]*[#＃@]/u.test(t)
const lettersOf = (t: string) => t.replace(/[^\p{L}]/gu, "")
function isCapsWord(t: string): boolean {
  const l = lettersOf(t)
  return l.length >= 2 && /\p{Lu}/u.test(l) && !/\p{Ll}/u.test(l)
}
function isMixedCase(t: string): boolean {
  const l = lettersOf(t)
  return /\p{Ll}/u.test(l) && /\p{Lu}/u.test(l.slice(1))
}
function neighbourWord(parts: string[], i: number, step: 1 | -1): string {
  for (let j = i + step; j >= 0 && j < parts.length; j += step) {
    const t = parts[j] ?? ""
    if (/\p{L}/u.test(t)) return t
  }
  return ""
}
/** Brand-style words (YouTube) and a lone all-caps word (SEO) keep their capitals; "BIG SALE" doesn't. */
function keepsCapitals(parts: string[], i: number, t: string): boolean {
  if (isMixedCase(t)) return true
  return (
    isCapsWord(t) &&
    !isCapsWord(neighbourWord(parts, i, -1)) &&
    !isCapsWord(neighbourWord(parts, i, 1))
  )
}
const endsSentence = (t: string) => /[.!?…।॥]["'”’)\]]*$/u.test(t)

function capitalise(t: string): string {
  return t.replace(/\p{L}/u, (c) => c.toUpperCase())
}

/** Links are never changed - changing a short link's case breaks it. */
export function toUpperCase(text: string): string {
  return tokens(text)
    .map((t) => (isSpace(t) || hasLink(t) ? t : t.toUpperCase()))
    .join("")
}

export function toLowerCase(text: string): string {
  return tokens(text)
    .map((t) => (isSpace(t) || hasLink(t) ? t : t.toLowerCase()))
    .join("")
}

const SMALL_WORDS = new Set(
  "a an and as at but by for from in into nor of off on or per so the to up via vs yet".split(" "),
)

type CaseMode = "title" | "sentence"

function changeCase(text: string, mode: CaseMode): string {
  const parts = tokens(text)
  // ALL-CAPS text is converted in full; otherwise words like SEO or YouTube keep their capitals.
  const keepInnerCaps = /\p{Ll}/u.test(text)
  let startOfSentence = true
  const out: string[] = []
  for (let i = 0; i < parts.length; i++) {
    const t = parts[i] ?? ""
    if (!t) continue
    if (isSpace(t)) {
      out.push(t)
      if (t.includes("\n")) startOfSentence = true
      continue
    }
    const wordy = /\p{L}/u.test(t)
    let next = t
    if (hasLink(t) || isTagOrMention(t) || (keepInnerCaps && keepsCapitals(parts, i, t))) {
      next = t
    } else if (mode === "sentence") {
      next = t.toLowerCase()
      if (startOfSentence || /^[("'“‘]*i(?:['’][a-z]+)?[.,!?;:)"'”’]*$/u.test(next))
        next = capitalise(next)
    } else {
      next = t.toLowerCase()
      const bare = next.replace(/[^\p{L}]/gu, "")
      const lastInLine = isLastWordInLine(parts, i)
      if (startOfSentence || lastInLine || !SMALL_WORDS.has(bare)) next = capitalise(next)
    }
    out.push(next)
    if (wordy) startOfSentence = false
    if (endsSentence(t) || (mode === "title" && /:$/.test(t))) startOfSentence = true
  }
  return out.join("")
}

function isLastWordInLine(parts: string[], i: number): boolean {
  for (let j = i + 1; j < parts.length; j++) {
    const t = parts[j] ?? ""
    if (isSpace(t)) {
      if (t.includes("\n")) return true
    } else if (/\p{L}/u.test(t)) {
      return false
    }
  }
  return true
}

/** Small words (of, the...) stay lower-case mid-title; links, tags and SEO-style words are left alone. */
export function toTitleCase(text: string): string {
  return changeCase(text, "title")
}

/** Sentence case: a capital at the start of each sentence and line, and for "I". */
export function toSentenceCase(text: string): string {
  return changeCase(text, "sentence")
}

/** Single spaces, no spaces at line ends, and at most one blank line in a row. */
export function removeExtraSpaces(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export function removeBlankLines(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((line) => line.trim())
    .join("\n")
}
