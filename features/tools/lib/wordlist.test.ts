import { describe, expect, it } from "vitest"
import { WORDLIST } from "./wordlist"

describe("WORDLIST", () => {
  it("has at least 1,000 words", () => {
    expect(WORDLIST.length).toBeGreaterThanOrEqual(1000)
  })

  it("has no repeats", () => {
    expect(new Set(WORDLIST).size).toBe(WORDLIST.length)
  })

  it("is all short, lowercase a-z words", () => {
    for (const w of WORDLIST) expect(w).toMatch(/^[a-z]{3,7}$/)
  })
})
