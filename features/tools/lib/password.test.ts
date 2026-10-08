import { describe, expect, it } from "vitest"
import {
  CHARSETS,
  LOOK_ALIKES,
  PASSPHRASE_DEFAULTS,
  PASSWORD_DEFAULTS,
  generatePassphrase,
  generatePassword,
  passphraseBits,
  passwordBits,
  randomInt,
  strengthOf,
  type RandomFill,
} from "./password"
import { WORDLIST } from "./wordlist"

/** A fake random source that hands out the given numbers in order. */
function sequence(values: number[]): RandomFill {
  let i = 0
  return (array) => {
    for (let k = 0; k < array.length; k++) array[k] = values[i++ % values.length] ?? 0
    return array
  }
}

const has = (text: string, set: string) => [...text].some((c) => set.includes(c))

describe("randomInt", () => {
  it("throws away draws that would cause modulo bias", () => {
    // 2^32 % 3 === 1, so 0xFFFFFFFF is the one value that must be redrawn.
    expect(randomInt(3, sequence([0xffffffff, 7]))).toBe(1)
    expect(randomInt(3, sequence([0xfffffffe]))).toBe(0xfffffffe % 3)
  })

  it("never needs to redraw for powers of two", () => {
    expect(randomInt(16, sequence([0xffffffff]))).toBe(15)
    expect(randomInt(1, sequence([12345]))).toBe(0)
  })

  it("is roughly even with the real random source", () => {
    const counts = new Array(6).fill(0)
    for (let i = 0; i < 60_000; i++) counts[randomInt(6)]++
    for (const c of counts) expect(Math.abs(c - 10_000)).toBeLessThan(600)
  })
})

describe("generatePassword", () => {
  it("has the right length and one of every chosen kind, every time", () => {
    for (let i = 0; i < 300; i++) {
      const p = generatePassword({ ...PASSWORD_DEFAULTS, length: 8 })
      expect(p).toHaveLength(8)
      expect(has(p, CHARSETS.upper)).toBe(true)
      expect(has(p, CHARSETS.lower)).toBe(true)
      expect(has(p, CHARSETS.numbers)).toBe(true)
      expect(has(p, CHARSETS.symbols)).toBe(true)
    }
  })

  it("uses only the chosen kinds", () => {
    const p = generatePassword({
      ...PASSWORD_DEFAULTS,
      length: 64,
      upper: false,
      lower: false,
      symbols: false,
    })
    expect(p).toMatch(/^\d{64}$/)
  })

  it("can leave out look-alike characters", () => {
    for (let i = 0; i < 100; i++) {
      const p = generatePassword({ ...PASSWORD_DEFAULTS, length: 64, avoidLookAlikes: true })
      expect(has(p, LOOK_ALIKES)).toBe(false)
    }
  })

  it("keeps the length between 8 and 64", () => {
    expect(generatePassword({ ...PASSWORD_DEFAULTS, length: 2 })).toHaveLength(8)
    expect(generatePassword({ ...PASSWORD_DEFAULTS, length: 500 })).toHaveLength(64)
  })

  it("needs at least one kind of character", () => {
    expect(() =>
      generatePassword({
        ...PASSWORD_DEFAULTS,
        upper: false,
        lower: false,
        numbers: false,
        symbols: false,
      }),
    ).toThrow()
  })
})

describe("generatePassphrase", () => {
  it("joins the right number of words with the separator", () => {
    const p = generatePassphrase(
      { words: 5, separator: "dot", capitalise: false, addNumber: false },
      WORDLIST,
    )
    const words = p.split(".")
    expect(words).toHaveLength(5)
    for (const w of words) expect(WORDLIST).toContain(w)
  })

  it("capitalises and adds exactly one digit when asked", () => {
    for (let i = 0; i < 50; i++) {
      const p = generatePassphrase(PASSPHRASE_DEFAULTS, WORDLIST)
      const words = p.split("-")
      expect(words).toHaveLength(PASSPHRASE_DEFAULTS.words)
      for (const w of words) expect(w).toMatch(/^[A-Z][a-z]+\d?$/)
      expect(p.replace(/\D/g, "")).toHaveLength(1)
    }
  })
})

describe("strength", () => {
  it("counts bits from the options", () => {
    expect(
      passwordBits({
        ...PASSWORD_DEFAULTS,
        length: 10,
        upper: false,
        numbers: false,
        symbols: false,
      }),
    ).toBeCloseTo(10 * Math.log2(26), 6)
    expect(
      passphraseBits({ words: 4, separator: "space", capitalise: true, addNumber: false }, 2048),
    ).toBe(44)
    expect(
      passphraseBits({ words: 4, separator: "space", capitalise: true, addNumber: true }, 2048),
    ).toBeCloseTo(44 + Math.log2(40), 6)
  })

  it("puts the defaults in sensible bands", () => {
    expect(strengthOf(passwordBits(PASSWORD_DEFAULTS))).toBe("very-strong")
    expect(strengthOf(passphraseBits(PASSPHRASE_DEFAULTS, WORDLIST.length))).toBe("strong")
    expect(
      strengthOf(
        passwordBits({
          ...PASSWORD_DEFAULTS,
          length: 8,
          upper: false,
          numbers: false,
          symbols: false,
        }),
      ),
    ).toBe("weak")
    expect(strengthOf(59.9)).toBe("fair")
  })
})
