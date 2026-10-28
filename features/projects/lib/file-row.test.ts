import { describe, expect, it } from "vitest"

import { driveOpenUrl, withAuthUser } from "./file-row"

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

  it("opens as the work account, so a personal Gmail default does not 'need access'", () => {
    expect(
      driveOpenUrl(
        { ...base, mimeType: "application/msword", fileName: "Brief.doc" },
        "mridul@digitallynext.com",
      ),
    ).toBe(
      "https://docs.google.com/document/d/abc123/edit?rtpof=true&sd=true&authuser=mridul%40digitallynext.com",
    )
    // No query string yet: the hint starts one.
    expect(
      driveOpenUrl(
        { ...base, webViewLink: null, mimeType: "application/zip", fileName: "a.zip" },
        "mridul@digitallynext.com",
      ),
    ).toBe("https://drive.google.com/file/d/abc123/view?authuser=mridul%40digitallynext.com")
  })
})

describe("withAuthUser", () => {
  const url = "https://docs.google.com/document/d/x/edit"

  it("adds the account, encoding the address", () => {
    expect(withAuthUser(url, "a.b@dn.com")).toBe(`${url}?authuser=a.b%40dn.com`)
    expect(withAuthUser(`${url}?rtpof=true`, "a@dn.com")).toBe(`${url}?rtpof=true&authuser=a%40dn.com`)
  })

  it("leaves the link alone when there is no usable address", () => {
    expect(withAuthUser(url, null)).toBe(url)
    expect(withAuthUser(url, "")).toBe(url)
    expect(withAuthUser(url, "not-an-email")).toBe(url)
    // Never doubled up.
    expect(withAuthUser(`${url}?authuser=x%40dn.com`, "y@dn.com")).toBe(`${url}?authuser=x%40dn.com`)
  })
})
