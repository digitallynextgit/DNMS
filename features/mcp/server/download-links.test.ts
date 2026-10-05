import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
process.env.AUTH_SECRET = "test-secret-for-download-links"

const { signLink, verifyLink, holdFile, heldFile } = await import("./download-links")

const payload = (over: Partial<Parameters<typeof signLink>[0]> = {}) => ({
  g: "grant-1",
  n: "nonce-1",
  e: Date.now() + 60_000,
  m: "GET" as const,
  p: "/api/work-reports?month=2026-09",
  f: "report.pptx",
  t: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ...over,
})

describe("download links", () => {
  it("round-trips a genuine link", () => {
    const token = signLink(payload())
    expect(verifyLink(token)?.g).toBe("grant-1")
  })
  it("rejects an edited payload", () => {
    const token = signLink(payload())
    const [body, sig] = token.split(".")
    const forged = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(body!, "base64url").toString()), g: "grant-2" }),
    ).toString("base64url")
    expect(verifyLink(`${forged}.${sig}`)).toBeNull()
  })
  it("rejects an expired link and junk", () => {
    expect(verifyLink(signLink(payload({ e: Date.now() - 1 })))).toBeNull()
    expect(verifyLink("nope")).toBeNull()
    expect(verifyLink("a.b.c")).toBeNull()
  })
  it("rejects a link signed with another secret", () => {
    const token = signLink(payload())
    process.env.AUTH_SECRET = "a-different-secret"
    expect(verifyLink(token)).toBeNull()
    process.env.AUTH_SECRET = "test-secret-for-download-links"
  })
  it("only hands a held file to the connection it was issued to", () => {
    holdFile("n-1", {
      bytes: new Uint8Array([1, 2, 3]),
      contentType: "text/csv",
      fileName: "a.csv",
      grantId: "grant-1",
    })
    expect(heldFile("n-1", "grant-1")?.fileName).toBe("a.csv")
    expect(heldFile("n-1", "grant-2")).toBeNull()
    expect(heldFile("missing", "grant-1")).toBeNull()
  })
})
