// crypto.getRandomValues with rejection sampling, so every character or word is equally likely.

/** Fills the array with random 32-bit numbers and returns it. Swappable in tests. */
export type RandomFill = (array: Uint32Array) => Uint32Array

const cryptoFill: RandomFill = (array) => crypto.getRandomValues(array)

const RANGE = 2 ** 32

export function randomInt(max: number, fill: RandomFill = cryptoFill): number {
  if (!Number.isInteger(max) || max < 1 || max > RANGE) throw new RangeError("max out of range")
  // The top `RANGE % max` values would make the low results slightly more
  // likely than the rest, so a draw up there is thrown away and redone.
  const limit = RANGE - (RANGE % max)
  const buf = new Uint32Array(1)
  for (;;) {
    const v = fill(buf)[0] ?? 0
    if (v < limit) return v % max
  }
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)))

function shuffle<T>(items: T[], fill: RandomFill): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(i + 1, fill)
    const a = items[i] as T
    items[i] = items[j] as T
    items[j] = a
  }
}

export const CHARSETS = {
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lower: "abcdefghijklmnopqrstuvwxyz",
  numbers: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.?/~",
} as const
export type CharsetKey = keyof typeof CHARSETS
const CHARSET_KEYS: CharsetKey[] = ["upper", "lower", "numbers", "symbols"]

/** Easy to misread: capital I, small L, one, capital O, zero. */
export const LOOK_ALIKES = "Il1O0"

export const MIN_LENGTH = 8
export const MAX_LENGTH = 64

export interface PasswordOptions {
  length: number
  upper: boolean
  lower: boolean
  numbers: boolean
  symbols: boolean
  avoidLookAlikes: boolean
}

export const PASSWORD_DEFAULTS: PasswordOptions = {
  length: 16,
  upper: true,
  lower: true,
  numbers: true,
  symbols: true,
  avoidLookAlikes: false,
}

export function activeSets(o: PasswordOptions): string[] {
  return CHARSET_KEYS.filter((k) => o[k]).map((k) =>
    o.avoidLookAlikes
      ? [...CHARSETS[k]].filter((c) => !LOOK_ALIKES.includes(c)).join("")
      : CHARSETS[k],
  )
}

/** One pick per chosen set, the rest from all sets, then shuffled so those picks have no fixed place. */
export function generatePassword(o: PasswordOptions, fill: RandomFill = cryptoFill): string {
  const sets = activeSets(o)
  if (!sets.length) throw new Error("Choose at least one kind of character")
  const length = clamp(o.length, MIN_LENGTH, MAX_LENGTH)
  const pool = sets.join("")
  const chars = sets.map((s) => s[randomInt(s.length, fill)] as string)
  while (chars.length < length) chars.push(pool[randomInt(pool.length, fill)] as string)
  shuffle(chars, fill)
  return chars.join("")
}

/** Bits of randomness: length x log2(how many characters it could use). */
export function passwordBits(o: PasswordOptions): number {
  const pool = activeSets(o).join("").length
  return pool ? clamp(o.length, MIN_LENGTH, MAX_LENGTH) * Math.log2(pool) : 0
}

export const SEPARATORS = {
  hyphen: { char: "-", label: "Hyphen ( - )" },
  dot: { char: ".", label: "Dot ( . )" },
  underscore: { char: "_", label: "Underscore ( _ )" },
  space: { char: " ", label: "Space" },
  none: { char: "", label: "None" },
} as const
export type SeparatorKey = keyof typeof SEPARATORS

export const MIN_WORDS = 3
export const MAX_WORDS = 10

export interface PassphraseOptions {
  words: number
  separator: SeparatorKey
  capitalise: boolean
  /** One random digit on the end of one random word. */
  addNumber: boolean
}

export const PASSPHRASE_DEFAULTS: PassphraseOptions = {
  words: 6,
  separator: "hyphen",
  capitalise: true,
  addNumber: true,
}

/** e.g. "Maple-River-Stone4-Kite-Bread-Honey" */
export function generatePassphrase(
  o: PassphraseOptions,
  list: readonly string[],
  fill: RandomFill = cryptoFill,
): string {
  if (!list.length) throw new Error("The word list is empty")
  const n = clamp(o.words, MIN_WORDS, MAX_WORDS)
  const words = Array.from({ length: n }, () => list[randomInt(list.length, fill)] as string)
  const shaped = o.capitalise ? words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)) : words
  if (o.addNumber) {
    const i = randomInt(n, fill)
    shaped[i] = `${shaped[i]}${randomInt(10, fill)}`
  }
  return shaped.join(SEPARATORS[o.separator].char)
}

/**
 * Each word adds log2(list size); the digit adds log2(10) + log2(words). Capitals add nothing -
 * every word gets one.
 */
export function passphraseBits(o: PassphraseOptions, listSize: number): number {
  const n = clamp(o.words, MIN_WORDS, MAX_WORDS)
  if (listSize < 2) return 0
  return n * Math.log2(listSize) + (o.addNumber ? Math.log2(10 * n) : 0)
}

export type Strength = "weak" | "fair" | "strong" | "very-strong"

/** Under 40 bits weak, under 60 fair, under 80 strong, 80+ very strong. */
export function strengthOf(bits: number): Strength {
  if (bits < 40) return "weak"
  if (bits < 60) return "fair"
  if (bits < 80) return "strong"
  return "very-strong"
}
