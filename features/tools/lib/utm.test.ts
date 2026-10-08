import { describe, expect, it } from "vitest"
import {
  RECENT_MAX,
  addRecent,
  buildUtmLink,
  cleanUtmValue,
  cleanUtmValues,
  emptyUtm,
  missingUtm,
  parseRecent,
  parseWebsiteUrl,
  removeRecent,
  sourceMediumHint,
  splitUtmLink,
  type UtmValues,
} from "./utm"

function url(input: string): URL {
  const r = parseWebsiteUrl(input)
  if (!r.ok) throw new Error(`expected ${input} to parse`)
  return r.url
}

const values: UtmValues = {
  ...emptyUtm(),
  utm_source: "facebook",
  utm_medium: "paid_social",
  utm_campaign: "diwali-sale",
}

describe("parseWebsiteUrl", () => {
  it("adds https:// when it's missing", () => {
    const r = parseWebsiteUrl("  digitallynext.com/offer ")
    expect(r.ok && r.url.href).toBe("https://digitallynext.com/offer")
    expect(r.ok && r.addedScheme).toBe(true)
  })

  it("keeps an existing http(s) scheme", () => {
    const r = parseWebsiteUrl("http://example.com")
    expect(r.ok && r.url.protocol).toBe("http:")
    expect(r.ok && r.addedScheme).toBe(false)
  })

  it("handles a host with a port", () => {
    expect(parseWebsiteUrl("example.com:8080/x").ok).toBe(true)
  })

  it("rejects empty, spaced and non-web input", () => {
    expect(parseWebsiteUrl("   ")).toEqual({ ok: false, reason: "empty" })
    expect(parseWebsiteUrl("example.com/my page")).toEqual({ ok: false, reason: "spaces" })
    expect(parseWebsiteUrl("hello")).toEqual({ ok: false, reason: "invalid" })
    expect(parseWebsiteUrl("ftp://example.com")).toEqual({ ok: false, reason: "invalid" })
    expect(parseWebsiteUrl("https://example.c")).toEqual({ ok: false, reason: "invalid" })
  })
})

describe("cleanUtmValue", () => {
  it("lowercases, trims and turns spaces into hyphens", () => {
    expect(cleanUtmValue("  Diwali Sale  2026 ", true)).toBe("diwali-sale-2026")
    expect(cleanUtmValue("Spring Sale - Week 1", true)).toBe("spring-sale-week-1")
  })

  it("only trims when clean-up is off", () => {
    expect(cleanUtmValue("  Diwali Sale ", false)).toBe("Diwali Sale")
  })

  it("cleans every field at once", () => {
    const out = cleanUtmValues({ ...emptyUtm(), utm_source: "Facebook " }, true)
    expect(out.utm_source).toBe("facebook")
    expect(out.utm_term).toBe("")
  })
})

describe("missingUtm", () => {
  it("lists the required tags still empty", () => {
    expect(missingUtm(emptyUtm())).toEqual(["utm_source", "utm_medium", "utm_campaign"])
    expect(missingUtm(values)).toEqual([])
  })
})

describe("buildUtmLink", () => {
  it("adds the tags in a fixed order and skips empty ones", () => {
    const { link, replaced } = buildUtmLink(url("digitallynext.com/offer"), values)
    expect(link).toBe(
      "https://digitallynext.com/offer?utm_source=facebook&utm_medium=paid_social&utm_campaign=diwali-sale",
    )
    expect(replaced).toEqual([])
  })

  it("keeps the page's own query and #hash", () => {
    const { link } = buildUtmLink(url("https://shop.in/p?id=7&colour=red%20blue#reviews"), values)
    expect(link).toBe(
      "https://shop.in/p?id=7&colour=red%20blue&utm_source=facebook&utm_medium=paid_social&utm_campaign=diwali-sale#reviews",
    )
  })

  it("replaces utm tags that were already on the link", () => {
    const { link, replaced } = buildUtmLink(
      url("https://shop.in/?utm_source=old&ref=x&UTM_Medium=old&utm_id=5"),
      values,
    )
    expect(link).toBe(
      "https://shop.in/?ref=x&utm_source=facebook&utm_medium=paid_social&utm_campaign=diwali-sale",
    )
    expect(replaced).toEqual(["utm_source", "utm_medium", "utm_id"])
  })

  it("encodes values that need it", () => {
    const { link } = buildUtmLink(url("example.com"), {
      ...values,
      utm_campaign: "Big Sale & More",
      utm_term: "seo agency",
    })
    expect(link).toContain("utm_campaign=Big%20Sale%20%26%20More")
    expect(link).toContain("utm_term=seo%20agency")
    expect(new URL(link).searchParams.get("utm_campaign")).toBe("Big Sale & More")
  })
})

describe("splitUtmLink", () => {
  it("takes a campaign link apart again", () => {
    const r = splitUtmLink(
      "https://shop.in/p?id=7&utm_source=facebook&utm_campaign=big%20sale&utm_id=2#top",
    )
    expect(r?.base).toBe("https://shop.in/p?id=7#top")
    expect(r?.values.utm_source).toBe("facebook")
    expect(r?.values.utm_campaign).toBe("big sale")
    expect(r?.values.utm_medium).toBe("")
  })

  it("returns null for something that isn't a link", () => {
    expect(splitUtmLink("not a link")).toBeNull()
  })
})

describe("sourceMediumHint", () => {
  it("spots source and medium the wrong way round", () => {
    expect(sourceMediumHint("cpc", "google")).toBe("swapped")
    expect(sourceMediumHint("email", "newsletter")).toBe("swapped")
  })

  it("spots a site in Medium or a traffic type in Source", () => {
    expect(sourceMediumHint("instagram", "facebook")).toBe("medium-is-source")
    expect(sourceMediumHint("email", "email")).toBe("source-is-medium")
  })

  it("stays quiet for normal pairs", () => {
    expect(sourceMediumHint("google", "cpc")).toBeNull()
    expect(sourceMediumHint("newsletter", "email")).toBeNull()
    expect(sourceMediumHint("partner-site", "referral")).toBeNull()
    expect(sourceMediumHint("", "")).toBeNull()
  })
})

describe("recent links", () => {
  it("adds to the top without duplicates and caps the list", () => {
    let list = addRecent([], "a", 1)
    list = addRecent(list, "b", 2)
    list = addRecent(list, "a", 3)
    expect(list.map((r) => r.link)).toEqual(["a", "b"])
    for (let i = 0; i < 20; i++) list = addRecent(list, `x${i}`, i)
    expect(list).toHaveLength(RECENT_MAX)
    expect(list[0]?.link).toBe("x19")
  })

  it("removes one link", () => {
    const list = addRecent(addRecent([], "a", 1), "b", 2)
    expect(removeRecent(list, "a").map((r) => r.link)).toEqual(["b"])
  })

  it("survives bad stored data", () => {
    expect(parseRecent(null)).toEqual([])
    expect(parseRecent("{oops")).toEqual([])
    expect(parseRecent('{"link":"a"}')).toEqual([])
    expect(parseRecent('[{"link":"a","at":1},{"link":2},null]')).toEqual([{ link: "a", at: 1 }])
  })
})
