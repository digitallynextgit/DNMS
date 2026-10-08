import { describe, expect, it } from "vitest"
import {
  countParagraphs,
  countSentences,
  countWords,
  findHashtags,
  findLinks,
  findMentions,
  formatReadingTime,
  graphemes,
  isEmoji,
  limitTone,
  removeBlankLines,
  removeExtraSpaces,
  smsInfo,
  textStats,
  toLowerCase,
  toSentenceCase,
  toTitleCase,
  toUpperCase,
  xLength,
} from "./text-stats"

describe("graphemes", () => {
  it("counts emoji with skin tones, families and flags as one each", () => {
    expect(graphemes("👍🏽")).toHaveLength(1)
    expect(graphemes("👨‍👩‍👧")).toHaveLength(1)
    expect(graphemes("🇮🇳")).toHaveLength(1)
    expect(graphemes("1️⃣")).toHaveLength(1)
  })

  it("keeps Hindi vowel signs with their letter", () => {
    // ह + ि + ं is one character on screen, as is द + ी.
    expect(graphemes("हिंदी")).toHaveLength(2)
  })
})

describe("isEmoji", () => {
  it("knows emoji from plain symbols", () => {
    for (const e of ["😀", "❤️", "👍🏽", "🇮🇳", "1️⃣", "👨‍👩‍👧"]) expect(isEmoji(e)).toBe(true)
    for (const c of ["a", "©", "™", "#", "1", "₹", "न"]) expect(isEmoji(c)).toBe(false)
  })
})

describe("textStats", () => {
  it("is all zeros for empty text", () => {
    expect(textStats("")).toEqual({
      characters: 0,
      charactersNoSpaces: 0,
      words: 0,
      sentences: 0,
      paragraphs: 0,
      readingSeconds: 0,
      hashtags: 0,
      mentions: 0,
      emojis: 0,
      links: 0,
    })
  })

  it("counts a typical caption", () => {
    const s = textStats(
      "Diwali sale is live! 🪔 Up to 50% off.\n\nShop now: digitallynext.com/sale @dnms #diwali #sale",
    )
    expect(s.words).toBe(14)
    expect(s.sentences).toBe(3)
    expect(s.paragraphs).toBe(2)
    expect(s.hashtags).toBe(2)
    expect(s.mentions).toBe(1)
    expect(s.emojis).toBe(1)
    expect(s.links).toBe(1)
  })

  it("counts emoji and Hindi the way they look", () => {
    const s = textStats("नमस्ते 👋🏽")
    expect(s.characters).toBe(5) // न म स्ते + space + 👋🏽
    expect(s.charactersNoSpaces).toBe(4)
    expect(s.words).toBe(1)
    expect(s.emojis).toBe(1)
  })

  it("gives at least a second of reading time", () => {
    expect(textStats("Hi").readingSeconds).toBe(1)
    expect(textStats("word ".repeat(400)).readingSeconds).toBe(120)
  })
})

describe("counting helpers", () => {
  it("only counts tokens with letters or digits as words", () => {
    expect(countWords("Hello — world 🔥 2026")).toBe(3)
    expect(countWords("   ")).toBe(0)
  })

  it("splits sentences on . ! ? the danda and line breaks", () => {
    expect(countSentences("One. Two! Three? Four")).toBe(4)
    expect(countSentences("यह अच्छा है। बहुत अच्छा।")).toBe(2)
    expect(countSentences("Price is 3.5 lakh")).toBe(1)
    expect(countSentences('She said "Go." Then she left.')).toBe(2)
    expect(countSentences("Line one\nLine two")).toBe(2)
  })

  it("counts lines with something on them as paragraphs", () => {
    expect(countParagraphs("a\n\n\nb\n  \nc")).toBe(3)
    expect(countParagraphs("")).toBe(0)
  })

  it("finds hashtags but not numbers or link anchors", () => {
    expect(findHashtags("#Diwali #दिवाली #1 seller site.com/#top a#b")).toEqual([
      "#Diwali",
      "#दिवाली",
    ])
  })

  it("finds mentions but not email addresses", () => {
    expect(findMentions("Thanks @digitally.next and @dn_ms. Mail hi@dn.com")).toEqual([
      "@digitally.next",
      "@dn_ms",
    ])
  })

  it("finds links with or without https, without trailing punctuation", () => {
    const text = "See https://x.com/a. Or bit.ly/3AbCd, (www.dn.in) and digitallynext.com!"
    expect(findLinks(text).map((l) => text.slice(l.start, l.end))).toEqual([
      "https://x.com/a",
      "bit.ly/3AbCd",
      "www.dn.in",
      "digitallynext.com",
    ])
  })

  it("does not take words or emails for links", () => {
    expect(findLinks("e.g. the company Node.js hi@dn.com example.company")).toEqual([])
  })

  it("formats reading time", () => {
    expect(formatReadingTime(0)).toBe("0 sec")
    expect(formatReadingTime(45)).toBe("45 sec")
    expect(formatReadingTime(150)).toBe("3 min")
  })
})

describe("xLength", () => {
  it("counts plain text one per character", () => {
    expect(xLength("Hello world")).toBe(11)
  })

  it("counts every link as 23", () => {
    expect(xLength("Read https://www.digitallynext.com/blog/a-very-long-post-name")).toBe(5 + 23)
    expect(xLength("x bit.ly/a")).toBe(2 + 23)
  })

  it("counts emoji as 2 and Hindi per code point", () => {
    expect(xLength("🔥")).toBe(2)
    expect(xLength("👨‍👩‍👧")).toBe(2)
    expect(xLength("नमस्ते")).toBe(6)
  })

  it("counts Chinese and Japanese as 2", () => {
    expect(xLength("日本")).toBe(4)
  })
})

describe("smsInfo", () => {
  it("is empty for no text", () => {
    expect(smsInfo("")).toMatchObject({ parts: 0, units: 0, encoding: "gsm", left: 160 })
  })

  it("fits 160 plain characters in one SMS", () => {
    expect(smsInfo("a".repeat(160))).toMatchObject({ encoding: "gsm", parts: 1, left: 0 })
    expect(smsInfo("a".repeat(161))).toMatchObject({ parts: 2, perPart: 153, left: 145 })
  })

  it("counts {, [, € and friends as two", () => {
    expect(smsInfo("{€}").units).toBe(6)
  })

  it("drops to 70 per SMS for Hindi, emoji, ₹ or curly quotes", () => {
    expect(smsInfo("नमस्ते")).toMatchObject({ encoding: "unicode", single: 70, parts: 1 })
    expect(smsInfo("Pay ₹500")).toMatchObject({ encoding: "unicode", unusual: ["₹"] })
    expect(smsInfo("It’s here")).toMatchObject({ encoding: "unicode", unusual: ["’"] })
    expect(smsInfo("a".repeat(71) + "😀").parts).toBe(2)
    expect(smsInfo("😀").units).toBe(2)
  })
})

describe("limitTone", () => {
  it("goes green, amber near the limit, red over it", () => {
    expect(limitTone(100, 280)).toBe("ok")
    expect(limitTone(252, 280)).toBe("near")
    expect(limitTone(280, 280)).toBe("near")
    expect(limitTone(281, 280)).toBe("over")
  })

  it("never turns a guide red", () => {
    expect(limitTone(79, 80, true)).toBe("ok")
    expect(limitTone(200, 80, true)).toBe("near")
  })
})

describe("case changes", () => {
  it("never changes the case of a link", () => {
    expect(toUpperCase("go to bit.ly/3AbCd now")).toBe("GO TO bit.ly/3AbCd NOW")
    expect(toLowerCase("GO TO https://x.com/AbC NOW")).toBe("go to https://x.com/AbC now")
  })

  it("title-cases main words and leaves small words, tags and acronyms alone", () => {
    expect(toTitleCase("the best seo tips for a small business")).toBe(
      "The Best Seo Tips for a Small Business",
    )
    expect(toTitleCase("how SEO and YouTube help #smallbiz grow")).toBe(
      "How SEO and YouTube Help #smallbiz Grow",
    )
    expect(toTitleCase("what are you looking for")).toBe("What Are You Looking For")
  })

  it("title-cases ALL-CAPS text in full, and shouted runs of capitals", () => {
    expect(toTitleCase("BIG DIWALI SALE")).toBe("Big Diwali Sale")
    expect(toTitleCase("BIG DIWALI SALE on SEO plans")).toBe("Big Diwali Sale on SEO Plans")
  })

  it("sentence-cases each sentence and line, and fixes a lone i", () => {
    expect(toSentenceCase("DIWALI SALE IS LIVE. i think it's great! new line\nnext one")).toBe(
      "Diwali sale is live. I think it's great! New line\nNext one",
    )
    expect(toSentenceCase("our SEO plan for YouTube. it works")).toBe(
      "Our SEO plan for YouTube. It works",
    )
  })
})

describe("tidying", () => {
  it("removes extra spaces and keeps at most one blank line", () => {
    expect(removeExtraSpaces("  Hello   there \n\n\n\nBye\t\tnow  ")).toBe("Hello there\n\nBye now")
  })

  it("removes blank lines", () => {
    expect(removeBlankLines("a\n\n  \nb\r\n\r\nc")).toBe("a\nb\nc")
  })
})
