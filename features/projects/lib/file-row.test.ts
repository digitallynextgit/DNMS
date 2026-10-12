import { describe, expect, it } from "vitest"

import { driveOpenUrl } from "./file-row"

const base = { driveFileId: "abc123", webViewLink: "https://drive.google.com/file/d/abc123/view" }

describe("driveOpenUrl", () => {
  it("opens Office files in Google's editors, editing the same file", () => {
    expect(
      driveOpenUrl({
        ...base,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        fileName: "Pricing.xlsx",
      }),
    ).toBe("https://docs.google.com/spreadsheets/d/abc123/edit?rtpof=true&sd=true")
    expect(driveOpenUrl({ ...base, mimeType: "application/msword", fileName: "Brief.doc" })).toBe(
      "https://docs.google.com/document/d/abc123/edit?rtpof=true&sd=true",
    )
    // Unknown MIME type: the extension decides.
    expect(
      driveOpenUrl({ ...base, mimeType: "application/octet-stream", fileName: "Pitch.PPTX" }),
    ).toBe("https://docs.google.com/presentation/d/abc123/edit?rtpof=true&sd=true")
  })

  it("uses Drive's viewer for everything else", () => {
    expect(driveOpenUrl({ ...base, mimeType: "video/mp4", fileName: "Reel.mp4" })).toBe(
      base.webViewLink,
    )
    expect(
      driveOpenUrl({ ...base, webViewLink: null, mimeType: "application/zip", fileName: "a.zip" }),
    ).toBe("https://drive.google.com/file/d/abc123/view")
  })
})
