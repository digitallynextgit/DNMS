import { describe, expect, it } from "vitest"

import { tidyBrief } from "./brief-text"

// The brief is shown in a <pre> and pasted into a plain textarea, so anything
// markdown-shaped arrives as literal punctuation. A prompt can ask for plain
// text; these are the cases that prove it, whatever the model does.

describe("tidyBrief", () => {
  it("drops heading hashes but keeps the heading", () => {
    expect(tidyBrief("# Brand Brief: Hard2Soft")).toBe("Brand Brief: Hard2Soft")
    expect(tidyBrief("## 1. Brand snapshot")).toBe("1. Brand snapshot")
    expect(tidyBrief("###### Deep")).toBe("Deep")
  })

  it("leaves a hash that is not a heading alone", () => {
    // A product code or a hex colour is not markdown.
    expect(tidyBrief("Model #1500L")).toBe("Model #1500L")
    expect(tidyBrief("Primary colour #1B4F91")).toBe("Primary colour #1B4F91")
  })

  it("turns em and en dashes into a hyphen", () => {
    expect(tidyBrief("six states - Tamil Nadu, Gujarat")).toBe("six states - Tamil Nadu, Gujarat")
    expect(tidyBrief("₹15,000–₹40,000")).toBe("₹15,000-₹40,000")
  })

  it("unwraps bold and italic markers", () => {
    expect(tidyBrief("**Positioning statement**: For homeowners")).toBe(
      "Positioning statement: For homeowners",
    )
    expect(tidyBrief("that is *really* important")).toBe("that is really important")
  })

  it("keeps hyphen bullets, which are wanted", () => {
    const list = "- No electricity\n- No salt"
    expect(tidyBrief(list)).toBe(list)
  })

  it("does not eat a lone asterisk or a maths expression", () => {
    expect(tidyBrief("2 * 3 = 6")).toBe("2 * 3 = 6")
  })

  it("collapses the blank-line gaps markdown leaves behind", () => {
    expect(tidyBrief("One\n\n\n\nTwo")).toBe("One\n\nTwo")
  })

  it("trims the whole thing", () => {
    expect(tidyBrief("\n\n  Brief  \n\n")).toBe("Brief")
  })

  it("handles a realistic passage end to end", () => {
    const raw = [
      "# Brand Brief: Hard2Soft",
      "",
      "## 1. Brand snapshot",
      "**Hard2Soft** is a D2C brand - sold across six states – for borewell homes.",
      "",
      "",
      "## 2. Products",
      "- 1500L model - ₹3,599",
    ].join("\n")
    expect(tidyBrief(raw)).toBe(
      [
        "Brand Brief: Hard2Soft",
        "",
        "1. Brand snapshot",
        "Hard2Soft is a D2C brand - sold across six states - for borewell homes.",
        "",
        "2. Products",
        "- 1500L model - ₹3,599",
      ].join("\n"),
    )
  })

  it("is a no-op on text that was already plain", () => {
    const plain =
      "1. Brand snapshot\nHard2Soft sells a water conditioner.\n\n2. Products\n- One model"
    expect(tidyBrief(plain)).toBe(plain)
  })
})
