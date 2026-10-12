import { describe, expect, it } from "vitest"

import { buildCandidates, orderProviders, splitModels, type ProviderRow } from "./ai-providers"

function provider(over: Partial<ProviderRow> & Pick<ProviderRow, "id" | "kind">): ProviderRow {
  return {
    label: over.kind,
    baseUrl: null,
    fastModels: "fast-1",
    smartModels: "smart-1, smart-2",
    isDefault: false,
    isActive: true,
    position: 0,
    keys: [{ id: `${over.id}-k1`, secret: "s1", isActive: true, position: 0 }],
    ...over,
  }
}

describe("splitModels", () => {
  it("trims, drops blanks and duplicates, keeps order", () => {
    expect(splitModels(" a, b ,,a, c ")).toEqual(["a", "b", "c"])
    expect(splitModels("")).toEqual([])
  })
})

describe("orderProviders", () => {
  it("puts the default first, then by position", () => {
    const rows = [
      { id: "a", isDefault: false, position: 0 },
      { id: "b", isDefault: true, position: 2 },
      { id: "c", isDefault: false, position: 1 },
    ]
    expect(orderProviders(rows).map((r) => r.id)).toEqual(["b", "a", "c"])
  })
})

describe("buildCandidates", () => {
  it("tries the default provider's keys first, then the next provider", () => {
    const rows = [
      provider({ id: "m", kind: "mistral", position: 0 }),
      provider({
        id: "g",
        kind: "gemini",
        isDefault: true,
        position: 1,
        keys: [
          { id: "g-k2", secret: "s2", isActive: true, position: 1 },
          { id: "g-k1", secret: "s1", isActive: true, position: 0 },
        ],
      }),
    ]
    const ids = buildCandidates(rows, "fast").map((c) => `${c.providerId}/${c.keyId}`)
    expect(ids).toEqual(["g/g-k1", "g/g-k2", "m/m-k1"])
  })

  it("gives every key a turn at each backup model", () => {
    const rows = [
      provider({
        id: "g",
        kind: "gemini",
        keys: [
          { id: "k1", secret: "s1", isActive: true, position: 0 },
          { id: "k2", secret: "s2", isActive: true, position: 1 },
        ],
      }),
    ]
    expect(buildCandidates(rows, "smart").map((c) => `${c.model}/${c.keyId}`)).toEqual([
      "smart-1/k1",
      "smart-1/k2",
      "smart-2/k1",
      "smart-2/k2",
    ])
  })

  it("skips switched-off providers and keys, unknown kinds and URL-less custom providers", () => {
    const rows = [
      provider({ id: "off", kind: "mistral", isActive: false }),
      provider({
        id: "g",
        kind: "gemini",
        keys: [{ id: "dead", secret: "s", isActive: false, position: 0 }],
      }),
      provider({ id: "x", kind: "nonsense" }),
      provider({ id: "c", kind: "custom", baseUrl: null }),
      provider({
        id: "c2",
        kind: "custom",
        baseUrl: "https://llm.example.com/v1/chat/completions",
      }),
    ]
    const out = buildCandidates(rows, "fast")
    expect(out.map((c) => c.providerId)).toEqual(["c2"])
    expect(out[0]!.url).toBe("https://llm.example.com/v1/chat/completions")
  })

  it("uses Cloudflare's per-account URL from the row, and skips it without one", () => {
    const url =
      "https://api.cloudflare.com/client/v4/accounts/0123456789abcdef0123456789abcdef/ai/v1/chat/completions"
    const out = buildCandidates(
      [
        provider({ id: "cf", kind: "cloudflare", baseUrl: url }),
        provider({ id: "cf-missing", kind: "cloudflare", baseUrl: null }),
      ],
      "fast",
    )
    expect(out.map((c) => [c.providerId, c.url])).toEqual([["cf", url]])
  })

  it("sends Claude through its SDK and names keys by position, never by value", () => {
    const [c] = buildCandidates([provider({ id: "a", kind: "anthropic" })], "fast")
    expect(c!.transport).toBe("anthropic")
    expect(c!.url).toBeNull()
    expect(c!.id).toBe("anthropic#1:fast-1")
  })
})
