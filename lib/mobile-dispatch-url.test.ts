import { describe, expect, it } from "vitest"

import { dispatchPathname, forwardableHost, forwardedProto } from "./mobile-dispatch-url"

// =============================================================================
// Both halves of the mobile dispatcher's URL construction, tested against the real URL parser
// rather than against a description of it. The dispatcher builds
// `new URL(pathname + search, originOf(req))` (app/api/mobile/v1/dnms/[...path]/route.ts), where
// `pathname` came from the catch-all segments and the origin came from the Host headers, so the
// question every test below asks is the same one: can a value that got through change the URL into
// something other than the one that was authorised, or make the parser throw?
// =============================================================================

/** A backslash, written this way so no reader of this file has to count escapes. */
const BS = String.fromCharCode(92)

describe("dispatchPathname", () => {
  it("joins plain segments onto /api/", () => {
    expect(dispatchPathname(["dashboard", "me"])).toBe("/api/dashboard/me")
    expect(dispatchPathname(["employees", "emp_1", "photo"])).toBe("/api/employees/emp_1/photo")
    // Shapes the catalogue really contains: a dotted filename, a space Next has already decoded
    // back out of %20, and an id with a hyphen.
    expect(dispatchPathname(["documents", "a-1", "Pay Slip.pdf"])).toBe(
      "/api/documents/a-1/Pay Slip.pdf",
    )
  })

  it("refuses an empty path", () => {
    expect(dispatchPathname([])).toBeNull()
  })

  // The refusals, one case each. Every one of these is a segment the WHATWG parser would read as
  // something other than one segment of text - see the comment on UNSAFE_IN_SEGMENT - so letting
  // it through means dispatching to a path that was never matched against the catalogue.
  it.each([
    ["an empty segment", ""],
    ["a bare dot", "."],
    ["a parent-directory segment", ".."],
    ["a backslash", `abc${BS}x`],
    ["a question mark", "abc?x=1"],
    ["a hash", "abc#y"],
    ["a slash", "abc/x"],
    ["a tab", "a\tb"],
    ["a newline", "a\nb"],
    ["a carriage return", "a\rb"],
  ])("refuses %s", (_label, segment) => {
    expect(dispatchPathname(["employees", segment, "photo"])).toBeNull()
    // And as the only segment, so the refusal is not an artefact of its position.
    expect(dispatchPathname([segment])).toBeNull()
  })

  it("refuses every segment the URL parser would not keep intact", () => {
    // The proof that the list above is the RIGHT list rather than a list someone liked: a segment
    // is safe exactly when the parser hands back the path it was given. Anything dispatchPathname
    // accepts has to survive that round trip.
    const samples = [
      "abc",
      "emp_1",
      "a-1",
      "a b",
      "a.pdf",
      "",
      ".",
      "..",
      `abc${BS}x`,
      "abc?x=1",
      "abc#y",
      "abc/x",
      "a\tb",
      "a\nb",
      "a\rb",
    ]
    for (const segment of samples) {
      const built = dispatchPathname(["employees", segment, "photo"])
      if (built === null) continue
      const url = new URL(built, "https://dnms.test")
      expect(decodeURIComponent(url.pathname), JSON.stringify(segment)).toBe(built)
      expect(url.search, JSON.stringify(segment)).toBe("")
      expect(url.hash, JSON.stringify(segment)).toBe("")
    }
  })

  it("shows what each refused segment would have done, so the refusals stay honest", () => {
    // If a later edit ever "simplifies" the refusal away, these are the URLs it would build.
    const at = (segment: string) => new URL(`/api/employees/${segment}/photo`, "https://dnms.test")
    // An EXTRA path segment: /abc/x, not /abc.
    expect(at(`abc${BS}x`).pathname).toBe("/api/employees/abc/x/photo")
    // The path is cut short and the remainder becomes a query the handler would read.
    expect(at("abc?x=1").pathname).toBe("/api/employees/abc")
    expect(at("abc?x=1").search).toBe("?x=1/photo")
    // Cut short again, into a fragment.
    expect(at("abc#y").pathname).toBe("/api/employees/abc")
    // Silently deleted, so the dispatched path is not the matched path.
    expect(at("a\tb").pathname).toBe("/api/employees/ab/photo")
  })
})

describe("forwardableHost", () => {
  it.each([
    "dnms.digitallynext.com",
    "localhost",
    "localhost:3000",
    "127.0.0.1:8080",
    "[::1]",
    "[::1]:3000",
    "xn--bcher-kva.test",
    "ok.test:65535",
  ])("accepts %s", (host) => {
    expect(forwardableHost(host)).toBe(host)
  })

  it("trims, because a header value can arrive padded", () => {
    expect(forwardableHost("  dnms.digitallynext.com  ")).toBe("dnms.digitallynext.com")
  })

  it.each([
    ["nothing at all", null],
    ["an absent header", undefined],
    ["an empty value", ""],
    ["whitespace", "   "],
    // THE FINDING. `new URL("/api/x", "http://]bad[")` throws, and the dispatcher's call to it
    // sits outside the try block that wraps the handler, so this was an unhandled 500.
    ["a malformed host", "]bad["],
    ["an unterminated bracket", "["],
    ["an empty bracket pair", "[]"],
    ["a malformed IPv6 literal", "[:::]"],
    // Also throws: the parser reads a trailing all-numeric label as a broken IPv4 address.
    ["a five-octet address", "1.2.3.4.5"],
    ["a numeric last label", "foo.123"],
    // Also throws: a port the parser will not accept.
    ["a port above the range", "ok.test:65536"],
    ["a five-digit port out of range", "ok.test:99999"],
    ["a trailing colon", "ok.test:"],
    ["two ports", "ok.test:3000:4000"],
    ["no host at all", ":3000"],
    // These do NOT throw. They parse into an origin that is not what the header said, which is
    // the quieter and worse half of the finding.
    ["embedded credentials", "user:pw@evil.test"],
    ["a path", "ok.test/evil"],
    ["a query", "ok.test?x=1"],
    ["a fragment", "ok.test#y"],
    ["a percent escape", "ok%2etest"],
    ["a backslash", `evil.test${BS}x`],
    ["a multi-hop header value", "a, b"],
    ["an internal space", "a b"],
    ["an over-long name", `${"x".repeat(300)}.test`],
  ])("refuses %s", (_label, host) => {
    expect(forwardableHost(host)).toBeNull()
  })

  it("never returns a host that would make new URL throw", () => {
    // The property the dispatcher actually leans on. While this holds, originOf() cannot throw on
    // a forged Host header under either scheme.
    const candidates = [
      "dnms.digitallynext.com",
      "localhost:3000",
      "[::1]:3000",
      "1.2.3.4",
      "1.2.3.4.5",
      "0x7f.1",
      "]bad[",
      "[:::]",
      "a, b",
      "ok.test:99999",
      "ok.test:0",
      "user:pw@evil.test",
      "UPPER.Test",
      "a..b",
      "a.",
      ".a",
      "-a.b",
      "a_b.test",
    ]
    for (const candidate of candidates) {
      const host = forwardableHost(candidate)
      if (host === null) continue
      for (const proto of ["http", "https"] as const) {
        expect(
          () => new URL("/api/dashboard/me", `${proto}://${host}`),
          `${proto}://${host}`,
        ).not.toThrow()
      }
    }
  })
})

describe("forwardedProto", () => {
  it.each([
    ["http", "http"],
    ["https", "https"],
    ["HTTPS", "https"],
    ["  https  ", "https"],
    // Each hop appends its own, so the client-facing one is first.
    ["https,http", "https"],
    ["https, http", "https"],
  ])("reads %s as %s", (raw, expected) => {
    expect(forwardedProto(raw)).toBe(expected)
  })

  it.each([
    ["nothing", null],
    ["an absent header", undefined],
    ["an empty value", ""],
    // Parses perfectly well and hands a handler a javascript: base - the reason this is an
    // allow-list and not a pass-through.
    ["javascript", "javascript"],
    ["ws", "ws"],
    ["file", "file"],
    // Throws instead, which withErrorHandler would now catch - but refusing is still better.
    ["a scheme with a space", "foo bar"],
    ["a scheme with a colon", "https:"],
  ])("refuses %s", (_label, raw) => {
    expect(forwardedProto(raw)).toBeNull()
  })
})
