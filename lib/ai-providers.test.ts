import { describe, expect, it } from "vitest"

import {
  PROVIDERS,
  buildCandidates,
  configuredProviders,
  modelsFor,
  providerOrder,
  readKeys,
} from "./ai-providers"

const mistral = PROVIDERS.find((p) => p.id === "mistral")!
const groq = PROVIDERS.find((p) => p.id === "groq")!

describe("readKeys", () => {
  it("reads a single key", () => {
    expect(readKeys(mistral, { MISTRAL_API_KEY: "abc" })).toEqual(["abc"])
  })

  it("reads a comma-separated list", () => {
    expect(readKeys(groq, { GROQ_API_KEYS: "a,b,c" })).toEqual(["a", "b", "c"])
  })

  it("survives however the clipboard shaped it", () => {
    // Trailing commas, newlines and stray spaces are what a pasted list of
    // keys actually looks like.
    expect(readKeys(groq, { GROQ_API_KEYS: " a , b,\n c,,  " })).toEqual(["a", "b", "c"])
  })

  it("merges the singular and plural spellings", () => {
    expect(readKeys(groq, { GROQ_API_KEY: "one", GROQ_API_KEYS: "two,three" })).toEqual([
      "one",
      "two",
      "three",
    ])
  })

  it("does not try the same key twice", () => {
    expect(readKeys(groq, { GROQ_API_KEY: "dup", GROQ_API_KEYS: "dup,other" })).toEqual([
      "dup",
      "other",
    ])
  })

  it("is empty when nothing is configured", () => {
    expect(readKeys(groq, {})).toEqual([])
    expect(readKeys(groq, { GROQ_API_KEYS: "   " })).toEqual([])
  })
})

describe("modelsFor", () => {
  it("falls back to the built-in list, best first", () => {
    const list = modelsFor(mistral, "smart", {})
    expect(list[0]).toBe("mistral-medium-latest")
    expect(list.length).toBeGreaterThan(1)
  })

  it("lets env replace the list, so a retired model is not a deploy", () => {
    expect(modelsFor(groq, "smart", { AI_MODELS_GROQ_SMART: "x-1, x-2" })).toEqual(["x-1", "x-2"])
  })

  it("ignores an override that is only whitespace", () => {
    expect(modelsFor(groq, "fast", { AI_MODELS_GROQ_FAST: "  " })).toEqual([...groq.models.fast])
  })

  it("keeps the tiers apart", () => {
    const env = { AI_MODELS_MISTRAL_SMART: "only-smart" }
    expect(modelsFor(mistral, "smart", env)).toEqual(["only-smart"])
    expect(modelsFor(mistral, "fast", env)).toEqual([...mistral.models.fast])
  })
})

describe("providerOrder", () => {
  it("defaults to declaration order", () => {
    expect(providerOrder({}).map((p) => p.id)).toEqual(PROVIDERS.map((p) => p.id))
  })

  it("puts the named providers first, in the order given", () => {
    const ids = providerOrder({ AI_PROVIDER_ORDER: "groq,openrouter" }).map((p) => p.id)
    expect(ids.slice(0, 2)).toEqual(["groq", "openrouter"])
  })

  it("keeps every provider, even the ones left out", () => {
    const ids = providerOrder({ AI_PROVIDER_ORDER: "groq" }).map((p) => p.id)
    expect([...ids].sort()).toEqual([...PROVIDERS.map((p) => p.id)].sort())
  })

  it("ignores a typo rather than taking AI down with it", () => {
    const ids = providerOrder({ AI_PROVIDER_ORDER: "gorq, groq" }).map((p) => p.id)
    expect(ids[0]).toBe("groq")
    expect(ids).toHaveLength(PROVIDERS.length)
  })
})

describe("buildCandidates", () => {
  it("skips providers with no key", () => {
    const out = buildCandidates("smart", { GROQ_API_KEY: "g" })
    expect(new Set(out.map((c) => c.provider))).toEqual(new Set(["groq"]))
  })

  it("exhausts a provider before moving to the next", () => {
    const out = buildCandidates("smart", {
      AI_PROVIDER_ORDER: "openrouter,groq",
      OPENROUTER_API_KEY: "o",
      GROQ_API_KEY: "g",
    })
    const first = out.findIndex((c) => c.provider === "groq")
    const lastRouter = out.map((c) => c.provider).lastIndexOf("openrouter")
    expect(lastRouter).toBeLessThan(first)
  })

  it("gives every key a turn at a model before giving up on that model", () => {
    // The point of two keys: a 429 is per key, so the same model is worth
    // asking again with the other one.
    const out = buildCandidates("smart", {
      AI_PROVIDER_ORDER: "groq",
      GROQ_API_KEYS: "k1,k2",
      AI_MODELS_GROQ_SMART: "big,small",
    })
    expect(out.slice(0, 4).map((c) => `${c.model}/${c.key}`)).toEqual([
      "big/k1",
      "big/k2",
      "small/k1",
      "small/k2",
    ])
  })

  it("orders models best first", () => {
    const out = buildCandidates("smart", { MISTRAL_API_KEY: "m" })
    expect(out[0]!.model).toBe("mistral-medium-latest")
  })

  it("labels a candidate by key POSITION, never by key", () => {
    const out = buildCandidates("smart", {
      AI_PROVIDER_ORDER: "groq",
      GROQ_API_KEYS: "sk-secret-one,sk-secret-two",
      AI_MODELS_GROQ_SMART: "m",
    })
    expect(out.map((c) => c.id)).toEqual(["groq#1:m", "groq#2:m"])
    // The id is what gets logged and benched, so it must never carry the key.
    for (const c of out) expect(c.id).not.toContain("secret")
  })

  it("is empty when nothing is configured at all", () => {
    expect(buildCandidates("fast", {})).toEqual([])
  })

  it("carries the provider's extra headers through", () => {
    const out = buildCandidates("smart", { OPENROUTER_API_KEY: "o" })
    expect(out[0]!.headers).toMatchObject({ "X-Title": "DNMS" })
  })
})

describe("configuredProviders", () => {
  it("counts keys without revealing them", () => {
    const out = configuredProviders({
      GROQ_API_KEYS: "sk-secret-one,sk-secret-two",
      MISTRAL_API_KEY: "sk-secret-three",
    })
    expect(out).toEqual(
      expect.arrayContaining([
        { id: "groq", keys: 2 },
        { id: "mistral", keys: 1 },
      ]),
    )
    // A count, never the material - this shape is safe to log.
    expect(JSON.stringify(out)).not.toContain("secret")
  })

  it("leaves out providers with nothing set", () => {
    expect(configuredProviders({}).length).toBe(0)
  })
})
