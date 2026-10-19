import { describe, expect, it } from "vitest"

import { freeName, nameKey } from "./file-names"

const taken = (...names: string[]) => new Set(names.map(nameKey))

describe("nameKey", () => {
  it("ignores case and outer spaces", () => {
    expect(nameKey("  Brochure.PDF ")).toBe(nameKey("brochure.pdf"))
  })
})

describe("freeName", () => {
  it("numbers the name before its extension", () => {
    expect(freeName("Brochure.pdf", taken("Brochure.pdf"))).toBe("Brochure (1).pdf")
  })

  it("skips numbers already used and continues from a numbered name", () => {
    expect(freeName("Plan.xlsx", taken("Plan.xlsx", "Plan (1).xlsx"))).toBe("Plan (2).xlsx")
    expect(freeName("Plan (4).xlsx", taken("Plan (4).xlsx"))).toBe("Plan (5).xlsx")
  })

  it("keeps a space before the extension out of the new name", () => {
    expect(freeName("hotels .ai", taken("hotels .ai"))).toBe("hotels (1).ai")
  })

  it("treats the whole name as the base for folders, links and dotfiles", () => {
    expect(freeName("Release v1.2", taken("Release v1.2"), false)).toBe("Release v1.2 (1)")
    expect(freeName("Untitled doc", taken("Untitled doc"))).toBe("Untitled doc (1)")
    expect(freeName(".env", taken(".env"))).toBe(".env (1)")
  })
})
