import { describe, expect, it } from "vitest"
import {
  DEFAULT_SIGNATURE_OPTIONS,
  GMAIL_SIGNATURE_LIMIT,
  buildSignatureHtml,
  buildSignatureText,
  displayUrl,
  escapeHtml,
  isPlausiblePhone,
  isPublicImageUrl,
  normaliseUrl,
  signatureIconUrl,
  type SignatureSource,
} from "./signature"

const SOURCE: SignatureSource = {
  name: "Riya Sharma",
  designation: "Account Manager",
  email: "riya@digitallynext.com",
  phone: "+91 98765 43210",
  website: "www.digitallynext.com",
  address: "268 Business India Complex, Uday Park, New Delhi 110 049, India",
  logoUrl: "https://dnms.digitallynext.com/brand-mark-104.png",
  socials: [
    { label: "LinkedIn", url: "https://www.linkedin.com/company/digitallynext" },
    { label: "Instagram", url: "https://www.instagram.com/digitallynext" },
  ],
}

const imageSrcs = (html: string) => [...html.matchAll(/<img[^>]*src="([^"]*)"/g)].map((m) => m[1])

describe("normaliseUrl", () => {
  it("adds https:// to a bare link", () => {
    expect(normaliseUrl("linkedin.com/in/riya")).toBe("https://linkedin.com/in/riya")
    expect(normaliseUrl(" https://cal.com/riya ")).toBe("https://cal.com/riya")
  })

  it("refuses anything that isn't a web link", () => {
    expect(normaliseUrl("")).toBeNull()
    expect(normaliseUrl("javascript:alert(1)")).toBeNull()
    expect(normaliseUrl("data:image/png;base64,AAAA")).toBeNull()
    expect(normaliseUrl("mailto:riya@x.com")).toBeNull()
    expect(normaliseUrl("not a link")).toBeNull()
    expect(normaliseUrl("localhost")).toBeNull()
  })

  it("shortens a link for display", () => {
    expect(displayUrl("https://www.linkedin.com/in/riya/")).toBe("linkedin.com/in/riya")
  })
})

describe("isPublicImageUrl", () => {
  it("only trusts absolute https links on a real host", () => {
    expect(isPublicImageUrl("https://dnms.digitallynext.com/brand-mark-104.png")).toBe(true)
    expect(isPublicImageUrl("http://dnms.digitallynext.com/brand-mark-104.png")).toBe(false)
    expect(isPublicImageUrl("https://localhost:3000/brand-mark-104.png")).toBe(false)
    expect(isPublicImageUrl("https://192.168.1.4/brand-mark-104.png")).toBe(false)
    expect(isPublicImageUrl("/brand-mark-104.png")).toBe(false)
    expect(isPublicImageUrl("data:image/png;base64,AAAA")).toBe(false)
    expect(isPublicImageUrl(null)).toBe(false)
  })

  it("finds the hosted icons next to the logo", () => {
    expect(signatureIconUrl("https://dnms.digitallynext.com/brand-mark-104.png", "phone")).toBe(
      "https://dnms.digitallynext.com/email-icons/phone.png",
    )
  })
})

describe("isPlausiblePhone", () => {
  it("accepts the usual ways of writing a number", () => {
    expect(isPlausiblePhone("+91 98765 43210")).toBe(true)
    expect(isPlausiblePhone("011-4567 8900 ext 21")).toBe(true)
    expect(isPlausiblePhone("(011) 4567-8900")).toBe(true)
  })

  it("flags things that aren't numbers", () => {
    expect(isPlausiblePhone("call me")).toBe(false)
    expect(isPlausiblePhone("12")).toBe(false)
  })
})

describe("buildSignatureHtml", () => {
  const html = buildSignatureHtml(SOURCE, DEFAULT_SIGNATURE_OPTIONS)

  it("has the company design: name, designation + company, contact rows", () => {
    expect(html).toContain("Riya Sharma")
    expect(html).toContain("Account Manager, Digitally Next")
    expect(html).toContain("+91 98765 43210")
    expect(html).toContain('href="mailto:riya@digitallynext.com"')
    expect(html).toContain('href="https://www.digitallynext.com/"')
    expect(html).toContain("Uday Park")
    expect(html).toContain("#e5231b")
  })

  it("is email-safe: a table, inline styles, no <style> or flexbox", () => {
    expect(html.startsWith("<table")).toBe(true)
    expect(html).not.toMatch(/<style|class=|display:\s*flex/i)
  })

  it("only uses absolute https images, each with a size", () => {
    const srcs = imageSrcs(html)
    expect(srcs.length).toBeGreaterThan(0)
    for (const src of srcs) expect(src).toMatch(/^https:\/\/dnms\.digitallynext\.com\//)
    expect(html).not.toContain("data:")
    for (const img of html.match(/<img[^>]*>/g) ?? []) {
      expect(img).toMatch(/width="\d+"/)
      expect(img).toMatch(/height="\d+"/)
    }
  })

  it("shows company socials in the email's order, and can hide them", () => {
    expect(html.indexOf("instagram.png")).toBeLessThan(html.indexOf("linkedin.png"))
    expect(html).not.toContain("youtube.png") // not configured
    const hidden = buildSignatureHtml(SOURCE, { ...DEFAULT_SIGNATURE_OPTIONS, showSocials: false })
    expect(hidden).not.toContain("linkedin.com/company")
  })

  it("applies this copy's changes", () => {
    const custom = buildSignatureHtml(SOURCE, {
      ...DEFAULT_SIGNATURE_OPTIONS,
      showPhone: false,
      showAddress: false,
      extraPhone: "011 4567 8900",
      linkedinUrl: "linkedin.com/in/riya-sharma",
      ctaText: "Book a call",
      ctaUrl: "cal.com/riya",
    })
    expect(custom).not.toContain("98765")
    expect(custom).not.toContain("Uday Park")
    expect(custom).toContain("011 4567 8900")
    expect(custom).toContain('href="https://linkedin.com/in/riya-sharma"')
    expect(custom).toContain(">linkedin.com/in/riya-sharma<")
    expect(custom).toContain('href="https://cal.com/riya"')
    expect(custom).toContain(">Book a call<")
  })

  it("drops an unsafe link instead of using it", () => {
    const custom = buildSignatureHtml(SOURCE, {
      ...DEFAULT_SIGNATURE_OPTIONS,
      linkedinUrl: "javascript:alert(1)",
      ctaText: "Book a call",
      ctaUrl: "javascript:alert(1)",
    })
    expect(custom).not.toContain("javascript:")
    expect(custom).toContain(">Book a call<") // the line stays, without a link
  })

  it("escapes what people type", () => {
    const custom = buildSignatureHtml(
      { ...SOURCE, name: 'Riya <b>"R"</b>' },
      { ...DEFAULT_SIGNATURE_OPTIONS, ctaText: "<script>alert(1)</script>" },
    )
    expect(custom).not.toContain("<script>")
    expect(custom).not.toContain("<b>")
    expect(custom).toContain(escapeHtml('Riya <b>"R"</b>'))
  })

  it("works without a designation, phone or logo", () => {
    const bare = buildSignatureHtml(
      { ...SOURCE, designation: null, phone: null, logoUrl: null },
      DEFAULT_SIGNATURE_OPTIONS,
    )
    expect(bare).toContain(">Digitally Next<")
    expect(bare).not.toContain("<img")
  })

  it("fits in a Gmail signature", () => {
    const longest = buildSignatureHtml(
      {
        ...SOURCE,
        socials: [...SOURCE.socials, { label: "YouTube", url: "https://youtube.com/@dn" }],
      },
      {
        ...DEFAULT_SIGNATURE_OPTIONS,
        extraPhone: "011 4567 8900",
        linkedinUrl: "linkedin.com/in/riya-sharma",
        ctaText: "Book a call with me",
        ctaUrl: "cal.com/riya",
      },
    )
    expect(longest.length).toBeLessThan(GMAIL_SIGNATURE_LIMIT)
  })
})

describe("buildSignatureText", () => {
  it("is the same signature as plain lines", () => {
    const text = buildSignatureText(SOURCE, {
      ...DEFAULT_SIGNATURE_OPTIONS,
      linkedinUrl: "linkedin.com/in/riya",
      ctaText: "Book a call",
      ctaUrl: "cal.com/riya",
    })
    expect(text.split("\n")).toEqual([
      "Riya Sharma",
      "Account Manager, Digitally Next",
      "+91 98765 43210 | www.digitallynext.com",
      "riya@digitallynext.com",
      "LinkedIn: linkedin.com/in/riya",
      "268 Business India Complex, Uday Park, New Delhi 110 049, India",
      "Book a call: https://cal.com/riya",
    ])
  })
})
