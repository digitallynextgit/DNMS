import { describe, expect, it } from "vitest"
import { QR_MARGIN, buildQr, colourProblem, qrFileName, qrToSvg, type QrStyle } from "./qr"

const style: QrStyle = { dark: "#000000", light: "#ffffff", imageScale: 0.22, imagePlate: true }

describe("buildQr", () => {
  it("needs some text", () => {
    expect(buildQr("   ", false)).toEqual({ ok: false, reason: "empty" })
  })

  it("builds a square module grid", () => {
    const r = buildQr("https://www.digitallynext.com", false)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.matrix.size).toBeGreaterThanOrEqual(21)
    // The top-left finder pattern is always dark at its corner.
    expect(r.matrix.dark(0, 0)).toBe(true)
  })

  it("uses a denser, more robust code when an image covers the middle", () => {
    const plain = buildQr("https://www.digitallynext.com/contact", false)
    const withImage = buildQr("https://www.digitallynext.com/contact", true)
    if (!plain.ok || !withImage.ok) throw new Error("expected both to build")
    expect(withImage.matrix.size).toBeGreaterThanOrEqual(plain.matrix.size)
  })

  it("says when the text is too long for one code", () => {
    expect(buildQr("x".repeat(5000), true)).toEqual({ ok: false, reason: "too-long" })
  })
})

describe("qrToSvg", () => {
  it("includes the quiet zone and the centre image when given", () => {
    const r = buildQr("hello", true)
    if (!r.ok) throw new Error("expected to build")
    const total = r.matrix.size + QR_MARGIN * 2
    const svg = qrToSvg(r.matrix, style, { src: "data:image/png;base64,AAAA", aspect: 2 })
    expect(svg).toContain(`viewBox="0 0 ${total} ${total}"`)
    expect(svg).toContain('href="data:image/png;base64,AAAA"')
    expect(svg).toContain("<rect x=") // the plate behind the image
  })

  it("leaves the plate out when switched off", () => {
    const r = buildQr("hello", true)
    if (!r.ok) throw new Error("expected to build")
    const svg = qrToSvg(r.matrix, { ...style, imagePlate: false }, { src: "data:x", aspect: 1 })
    expect(svg).not.toContain("<rect x=")
  })
})

describe("qrFileName", () => {
  it("names a link after its site and path", () => {
    expect(qrFileName("https://www.digitallynext.com/", "png")).toBe("qr-digitallynext-com.png")
    expect(qrFileName("https://digitallynext.com/careers", "svg")).toBe(
      "qr-digitallynext-com-careers.svg",
    )
  })

  it("falls back to plain text, then to a default", () => {
    expect(qrFileName("Hello World!", "png")).toBe("qr-hello-world.png")
    expect(qrFileName("नमस्ते", "png")).toBe("qr-code.png")
  })
})

describe("colourProblem", () => {
  it("accepts dark on light", () => {
    expect(colourProblem("#000000", "#ffffff")).toBeNull()
    expect(colourProblem("#1e3a8a", "#ffffff")).toBeNull()
  })

  it("flags inverted and low-contrast colours", () => {
    expect(colourProblem("#ffffff", "#000000")).toBe("inverted")
    expect(colourProblem("#777777", "#999999")).toBe("low-contrast")
  })
})
