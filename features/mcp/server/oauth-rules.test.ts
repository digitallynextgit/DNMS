import { createHash } from "node:crypto"
import { describe, expect, it, vi } from "vitest"

// The modules under test are server-only; the guard package throws outside a
// react-server build, which is irrelevant to these pure functions.
vi.mock("server-only", () => ({}))

const { pkceMatches, isValidChallenge, generateToken, sha256Hex } = await import("./tokens")
const { isAllowedRedirect, redirectMatches, isLoopbackRedirect, verifiedClientName } =
  await import("./redirects")

const challengeFor = (verifier: string) => createHash("sha256").update(verifier).digest("base64url")

describe("PKCE (S256)", () => {
  const verifier = "a".repeat(43) + "-._~XYZ"
  it("accepts the matching verifier", () => {
    expect(pkceMatches(verifier, challengeFor(verifier))).toBe(true)
  })
  it("rejects a different verifier", () => {
    expect(pkceMatches("b".repeat(50), challengeFor(verifier))).toBe(false)
  })
  it("rejects verifiers outside RFC 7636 length/charset", () => {
    const short = "x".repeat(42)
    expect(pkceMatches(short, challengeFor(short))).toBe(false)
    const bad = "x".repeat(43) + "!"
    expect(pkceMatches(bad, challengeFor(bad))).toBe(false)
  })
  it("validates challenge shape", () => {
    expect(isValidChallenge(challengeFor(verifier))).toBe(true)
    expect(isValidChallenge("plain-text-challenge")).toBe(false)
  })
})

describe("tokens", () => {
  it("are prefixed, random and hashed deterministically", () => {
    const a = generateToken("dnms_at_")
    const b = generateToken("dnms_at_")
    expect(a.startsWith("dnms_at_")).toBe(true)
    expect(a).not.toBe(b)
    expect(sha256Hex(a)).toBe(sha256Hex(a))
    expect(sha256Hex(a)).toHaveLength(64)
  })
})

describe("redirect allowlist", () => {
  it("allows Claude and ChatGPT callbacks", () => {
    expect(isAllowedRedirect("https://claude.ai/api/mcp/auth_callback")).toBe(true)
    expect(isAllowedRedirect("https://chatgpt.com/connector_platform_oauth_redirect")).toBe(true)
    expect(isAllowedRedirect("https://chatgpt.com/connector/oauth/abc123")).toBe(true)
  })
  it("allows loopback on any port (Claude Code, CLI agents)", () => {
    expect(isAllowedRedirect("http://localhost:3118/callback")).toBe(true)
    expect(isAllowedRedirect("http://127.0.0.1:50000/callback")).toBe(true)
  })
  it("refuses everything else", () => {
    expect(isAllowedRedirect("https://evil.example.com/cb")).toBe(false)
    expect(isAllowedRedirect("https://claude.ai.evil.com/cb")).toBe(false)
    expect(isAllowedRedirect("http://claude.ai/api/mcp/auth_callback")).toBe(false)
    expect(isAllowedRedirect("https://claude.ai/cb#frag")).toBe(false)
    expect(isAllowedRedirect("not a url")).toBe(false)
  })
})

describe("redirect matching", () => {
  it("requires an exact match for web callbacks", () => {
    const registered = ["https://claude.ai/api/mcp/auth_callback"]
    expect(redirectMatches(registered, "https://claude.ai/api/mcp/auth_callback")).toBe(true)
    expect(redirectMatches(registered, "https://claude.ai/api/mcp/other")).toBe(false)
  })
  it("ignores only the port for loopback", () => {
    const registered = ["http://localhost/callback", "http://127.0.0.1/callback"]
    expect(redirectMatches(registered, "http://localhost:3118/callback")).toBe(true)
    expect(redirectMatches(registered, "http://127.0.0.1:9999/callback")).toBe(true)
    expect(redirectMatches(registered, "http://localhost:3118/other")).toBe(false)
  })
  it("labels loopback and verified clients", () => {
    expect(isLoopbackRedirect("http://localhost:1/cb")).toBe(true)
    expect(verifiedClientName("https://claude.ai/api/mcp/auth_callback")).toBe("Claude")
    expect(verifiedClientName("https://chatgpt.com/x")).toBe("ChatGPT")
    expect(verifiedClientName("https://example.com/x")).toBeNull()
  })
})
