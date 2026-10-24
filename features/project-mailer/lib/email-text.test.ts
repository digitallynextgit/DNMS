import { describe, expect, it } from "vitest"
import { htmlToText } from "./email-text"

describe("htmlToText", () => {
  it("keeps the words, the alt text and the link addresses, and drops the rest", () => {
    const html = `<html><head><style>p{}</style></head><body>
      <div style="display:none;max-height:0">preheader &zwnj;&nbsp;</div>
      <table><tr><td><a href="https://h2s.co.in/p?x=1&amp;y=2"><img src="a.jpg" alt="Big Diwali offer: &#8377;1,000 off" /></a></td></tr>
      <tr><td><p>Hi <b>Priya</b>,<br/>Free delivery &amp; COD.</p>
      <a href="mailto:x@y.z">Write to us</a> &middot; <a href="https://h2s.co.in/">h2s.co.in</a></td></tr></table>
    </body></html>`
    expect(htmlToText(html)).toBe(
      [
        "Big Diwali offer: ₹1,000 off (https://h2s.co.in/p?x=1&y=2)",
        "",
        "Hi Priya,",
        "Free delivery & COD.",
        "",
        "Write to us · h2s.co.in (https://h2s.co.in/)",
      ].join("\n"),
    )
  })
  it("survives an empty or text-only body", () => {
    expect(htmlToText("")).toBe("")
    expect(htmlToText("Just words")).toBe("Just words")
  })
})
