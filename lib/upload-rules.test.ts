import { describe, expect, it } from "vitest"

import { isVideoUpload, isAllowedDocument } from "./upload-rules"

/**
 * These two predicates decide WHERE an upload is stored and whether it is taken
 * at all, so a wrong answer is not cosmetic:
 *
 *   - a video read as a document goes to Backblaze and is rejected by its 20 MB
 *     cap, which is the bug this whole change exists to fix;
 *   - a document read as a video is published to anyone with the link.
 *
 * The empty-MIME cases are the ones worth pinning. `file.type` comes from the
 * BROWSER and is blank often enough that the original check -
 * `if (file.type && !ALLOWED.includes(file.type)) reject` - skipped the
 * allowlist entirely for a type-less file.
 */

const f = (name: string, type = "") => ({ name, type })

describe("isVideoUpload", () => {
  it("accepts the video MIME types the server stores in Drive", () => {
    expect(isVideoUpload(f("clip.mp4", "video/mp4"))).toBe(true)
    expect(isVideoUpload(f("clip.mov", "video/quicktime"))).toBe(true)
    expect(isVideoUpload(f("clip.webm", "video/webm"))).toBe(true)
  })

  it("falls back to the extension when the browser sends no MIME type", () => {
    expect(isVideoUpload(f("reel.mp4"))).toBe(true)
    expect(isVideoUpload(f("reel.MOV"))).toBe(true)
    expect(isVideoUpload(f("reel.mkv"))).toBe(true)
  })

  it("does not treat documents or images as video", () => {
    expect(isVideoUpload(f("brief.pdf", "application/pdf"))).toBe(false)
    expect(isVideoUpload(f("poster.png", "image/png"))).toBe(false)
    expect(isVideoUpload(f("notes.txt"))).toBe(false)
  })

  it("is not fooled by a video word in the name", () => {
    expect(isVideoUpload(f("video-brief.pdf", "application/pdf"))).toBe(false)
    expect(isVideoUpload(f("mp4-guidelines.docx"))).toBe(false)
  })
})

describe("isAllowedDocument", () => {
  it("accepts the documents and images Backblaze takes", () => {
    expect(isAllowedDocument(f("brief.pdf", "application/pdf"))).toBe(true)
    expect(isAllowedDocument(f("poster.png", "image/png"))).toBe(true)
    expect(isAllowedDocument(f("shot.jpg", "image/jpeg"))).toBe(true)
  })

  it("rejects an executable even when the browser sends NO MIME type", () => {
    // The regression this function exists for: a blank type must fall back to
    // the extension, not waive the rule.
    expect(isAllowedDocument(f("payload.exe"))).toBe(false)
    expect(isAllowedDocument(f("script.sh"))).toBe(false)
    expect(isAllowedDocument(f("noextension"))).toBe(false)
  })

  it("accepts a known extension when the MIME type is missing", () => {
    expect(isAllowedDocument(f("brief.pdf"))).toBe(true)
    expect(isAllowedDocument(f("POSTER.PNG"))).toBe(true)
  })

  it("rejects video, which belongs on the Drive path instead", () => {
    expect(isAllowedDocument(f("clip.mp4", "video/mp4"))).toBe(false)
    expect(isAllowedDocument(f("clip.mp4"))).toBe(false)
  })

  it("trusts a MIME type the browser did send, over the extension", () => {
    // A .pdf relabelled as an executable type must not slip through on its name.
    expect(isAllowedDocument(f("invoice.pdf", "application/x-msdownload"))).toBe(false)
  })
})
