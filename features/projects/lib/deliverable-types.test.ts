import { describe, expect, it } from "vitest"

import { GENERIC_TYPES, cleanType, expectsOutput, suggestTypes, typeKey } from "./deliverable-types"

describe("cleanType", () => {
  it("trims and collapses runs of whitespace", () => {
    expect(cleanType("  Product   page ")).toBe("Product page")
    expect(cleanType("Reel\t\nshort")).toBe("Reel short")
  })

  it("leaves an already clean value alone", () => {
    expect(cleanType("Reel")).toBe("Reel")
  })

  it("keeps the typed casing - a team's own spelling is the right spelling", () => {
    expect(cleanType("reel")).toBe("reel")
  })

  it("returns empty for whitespace only, so the caller can refuse it", () => {
    expect(cleanType("   ")).toBe("")
  })
})

describe("typeKey", () => {
  it("groups the same word whatever the casing or spacing", () => {
    expect(typeKey("Reel")).toBe("reel")
    expect(typeKey(" REEL ")).toBe("reel")
    expect(typeKey("Product  Page")).toBe(typeKey("product page"))
  })
})

describe("suggestTypes", () => {
  it("leads with the video team's own vocabulary", () => {
    expect(suggestTypes("Video Team")[0]).toBe("Video")
  })

  it("recognises a team by any word in its name", () => {
    expect(suggestTypes("WEB")).toContain("Page")
    expect(suggestTypes("Content & SEO")).toContain("Blog")
  })

  it("falls back to the generic tail for an unrecognised or missing team", () => {
    expect(suggestTypes("Sundries")).toEqual([...GENERIC_TYPES])
    expect(suggestTypes(null)).toEqual([...GENERIC_TYPES])
    expect(suggestTypes()).toEqual([...GENERIC_TYPES])
  })

  it("never offers the same type twice", () => {
    const list = suggestTypes("MAP - performance marketing")
    expect(new Set(list).size).toBe(list.length)
    expect(list).toContain("Report")
  })
})

describe("expectsOutput", () => {
  it("is false for work with no team - adhoc produces nothing to point at", () => {
    expect(expectsOutput(null)).toBe(false)
    expect(expectsOutput(undefined)).toBe(false)
    expect(expectsOutput("")).toBe(false)
  })

  it("is true for any named team, recognised or not", () => {
    expect(expectsOutput("WEB")).toBe(true)
    expect(expectsOutput("Sundries")).toBe(true)
  })
})
