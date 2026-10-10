import { describe, expect, it } from "vitest"

import { malformedJsonBody } from "./mobile-dispatch-body"

// =============================================================================
// The mobile dispatcher's body gate. Two kinds of test here, and the second one is the point:
//
//   1. THE FOUR CASES THE SURFACE ACTUALLY HAS - valid JSON, invalid JSON, no body, multipart.
//      Three of the four must pass through untouched; the live smoke proved POST bodies and
//      uploads work and this gate is not allowed to be what breaks them.
//   2. AGREEMENT WITH `Request.prototype.json()`, sample by sample, against the real WHATWG
//      implementation rather than against a description of it. That is the governing rule from
//      lib/mobile-dispatch-body.ts: the gate may never refuse a body a handler would have
//      accepted. A boolean this file wrote by hand could only ever restate the implementation;
//      asking the same bytes of a real Request is what makes the rule checkable.
// =============================================================================

/**
 * Exactly-sized bytes for a string.
 *
 * NOT `new TextEncoder().encode(s).buffer`: a typed array is a VIEW, and nothing promises its
 * byteOffset is 0 or that its length spans the whole buffer it sits on. Handing the raw `.buffer`
 * to a function that reads `byteLength` would then measure the allocation rather than the content,
 * which is the kind of test bug that makes a passing suite meaningless.
 */
function bytes(text: string): ArrayBuffer {
  const encoded = new TextEncoder().encode(text)
  const buffer = new ArrayBuffer(encoded.byteLength)
  new Uint8Array(buffer).set(encoded)
  return buffer
}

/** A real multipart body, boundary and CRLFs included - what a FormData upload looks like. */
const MULTIPART_BODY =
  '--X\r\nContent-Disposition: form-data; name="file"; filename="a.pdf"\r\n' +
  "Content-Type: application/pdf\r\n\r\n%PDF-1.4\r\n--X--\r\n"

const JSON_CT = "application/json"

describe("malformedJsonBody - the four cases the mobile surface has", () => {
  it("passes VALID JSON through, in every shape a handler is given", () => {
    // Objects are what the app sends, but `req.json()` accepts any JSON value and some handlers
    // read an array. A gate that only understood objects would 400 a legal body.
    for (const text of [
      '{"reason":"Fever","from":"2026-10-12"}',
      '{"nested":{"a":[1,2,{"b":null}]},"unicode":"à¤¹à¤¿"}',
      "[1,2,3]",
      '"a bare string"',
      "12",
      "null",
      "true",
      '﻿{"bom":"stripped by UTF-8 decode, exactly as Request.json() does"}',
    ]) {
      expect(malformedJsonBody(JSON_CT, bytes(text)), text.slice(0, 40)).toBe(false)
    }
  })

  it("refuses INVALID JSON - the measured 500", () => {
    // `not-json` is the body that answered 500 INTERNAL_ERROR over real HTTP on
    // POST /api/mobile/v1/dnms/leave/requests. The rest are the realistic phone failures: a
    // request truncated mid-flight by a dropped radio, and a hand-written body.
    for (const text of ["not-json", '{"reason":"Fev', '{"a":1},{"b":2}', "{a:1}", "   ", "{"]) {
      expect(malformedJsonBody(JSON_CT, bytes(text)), JSON.stringify(text)).toBe(true)
    }
  })

  it("passes an EMPTY body through - absent is not malformed", () => {
    // The dispatcher only assigns `body` when byteLength > 0, so `undefined` is the live case and
    // the zero-length buffer is the belt-and-braces one. A DELETE, an approve and a logout all
    // legitimately send nothing, and answering 400 to them would break every one.
    expect(malformedJsonBody(JSON_CT, undefined)).toBe(false)
    expect(malformedJsonBody(null, undefined)).toBe(false)
    expect(malformedJsonBody(JSON_CT, new ArrayBuffer(0))).toBe(false)
  })

  it("passes MULTIPART through although it is not JSON - this is what keeps uploads alive", () => {
    // The whole exemption in one assertion: these bytes are NOT JSON and must not be judged as
    // JSON, because 15 route files read them with req.formData() and the dispatcher forwards the
    // boundary intact so they can.
    expect(malformedJsonBody("multipart/form-data; boundary=X", bytes(MULTIPART_BODY))).toBe(false)
    // Case and whitespace come off the wire however the client wrote them.
    expect(malformedJsonBody("  MULTIPART/Form-Data; boundary=X", bytes(MULTIPART_BODY))).toBe(
      false,
    )
    // Any multipart subtype, because none of them is JSON either.
    expect(malformedJsonBody("multipart/mixed; boundary=X", bytes("--X--"))).toBe(false)
  })
})

describe("malformedJsonBody - the edges of the exemption", () => {
  it("judges a body whose content-type is NOT multipart, including urlencoded", () => {
    // Deliberate, and the reason is in NON_JSON_BODY: no handler under app/api reads a urlencoded
    // body, the app sends only JSON or multipart, and `curl -d` picks urlencoded by default -
    // which is how the 500 was found. If DNMS ever gains a form-post handler this is the line
    // that has to change, so it is asserted rather than left to be discovered.
    expect(malformedJsonBody("application/x-www-form-urlencoded", bytes("a=1&b=2"))).toBe(true)
    expect(malformedJsonBody("text/plain", bytes("hello"))).toBe(true)
    expect(malformedJsonBody(null, bytes("not-json"))).toBe(true)
    expect(malformedJsonBody(undefined, bytes("not-json"))).toBe(true)
    // ...but a body that IS JSON is fine whatever the content-type claims: the gate asks whether
    // req.json() will survive, not whether the caller labelled itself correctly.
    expect(malformedJsonBody("text/plain", bytes('{"a":1}'))).toBe(false)
  })

  it("is not fooled by a content-type that merely MENTIONS multipart", () => {
    // Anchored at the start of the value, so a type whose name happens to contain the word does
    // not buy the exemption. Nothing sends these; the assertion is what keeps the regex anchored.
    expect(malformedJsonBody("application/multipart-ish", bytes("not-json"))).toBe(true)
    expect(malformedJsonBody("text/plain; also=multipart/form-data", bytes("not-json"))).toBe(true)
  })

  it("survives bytes that are not valid UTF-8 at all", () => {
    // A lone 0xFF is not a character; a truncated multi-byte tail is a real symptom of a request
    // cut off mid-flight. Both must be a refusal rather than a throw out of this function.
    expect(malformedJsonBody(JSON_CT, new Uint8Array([0xff]).buffer)).toBe(true)
    const truncatedTail = new Uint8Array([0x7b, 0x22, 0x61, 0x22, 0x3a, 0x31, 0x7d, 0xe2, 0x82])
    expect(malformedJsonBody(JSON_CT, truncatedTail.buffer)).toBe(true)
    // And the lenient decode is deliberate: one stray byte INSIDE a string is a body `req.json()`
    // parses happily today, so refusing it would be a new 400 on a request that used to work.
    const strayByteInString = new Uint8Array([0x7b, 0x22, 0x61, 0x22, 0x3a, 0x22, 0xff, 0x22, 0x7d])
    expect(malformedJsonBody(JSON_CT, strayByteInString.buffer)).toBe(false)
  })
})

describe("malformedJsonBody never refuses a body a handler would have accepted", () => {
  // THE RULE, checked against the implementation the handlers actually use. `req.json()` inside a
  // route is this exact call on this exact class, so "would the handler have accepted it?" is a
  // question with a real answer rather than an opinion. Any sample where the two disagree is
  // either a false 400 (the gate is stricter than the handler - a regression) or a missed 500 (the
  // gate is looser - the bug is still there); the assertion names which way it went.
  const samples: ReadonlyArray<readonly [string, string]> = [
    ['{"a":1}', JSON_CT],
    ['﻿{"a":1}', JSON_CT],
    ["[1,2]", JSON_CT],
    ['"hi"', JSON_CT],
    ["12", JSON_CT],
    ["null", JSON_CT],
    ["not-json", JSON_CT],
    ['{"a":', JSON_CT],
    ["{a:1}", JSON_CT],
    ["   ", JSON_CT],
    ["a=1&b=2", "application/x-www-form-urlencoded"],
    ["hello", "text/plain"],
    ["not-json", ""],
  ]

  it.each(samples)("agrees with Request.json() on %j", async (text, contentType) => {
    const body = bytes(text)

    let handlerWouldAccept: boolean
    try {
      const headers = contentType ? { "content-type": contentType } : undefined
      await new Request("https://dnms.test/api/x", { method: "POST", body, headers }).json()
      handlerWouldAccept = true
    } catch {
      handlerWouldAccept = false
    }

    expect(
      malformedJsonBody(contentType, body),
      handlerWouldAccept
        ? "FALSE 400: the gate refuses a body req.json() parses"
        : "MISSED: the gate forwards a body req.json() throws on",
    ).toBe(!handlerWouldAccept)
  })

  it("and the multipart exemption is the one place they are allowed to disagree", async () => {
    const body = bytes(MULTIPART_BODY)
    const req = new Request("https://dnms.test/api/x", {
      method: "POST",
      body,
      headers: { "content-type": "multipart/form-data; boundary=X" },
    })

    // req.json() would throw on these bytes...
    await expect(req.json()).rejects.toThrow()
    // ...and the gate forwards them anyway, because the handler is going to call formData(), not
    // json(). This is the asymmetry the exemption buys and the only one in the file.
    expect(malformedJsonBody("multipart/form-data; boundary=X", body)).toBe(false)
  })
})
