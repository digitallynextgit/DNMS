import { describe, expect, it } from "vitest"
import {
  fileNameFromDisposition,
  findSignedUrl,
  flattenRows,
  guardCsvCell,
  looksLikePresignedStorageUrl,
  paginationOf,
  pickRows,
  safeFileName,
  signedUrlExpiry,
  withExtension,
} from "./download-utils"

describe("file names", () => {
  it("strips path, quote and control characters", () => {
    expect(safeFileName('../../etc/"passwd"\n')).toBe("etc passwd")
    expect(safeFileName("  ")).toBe("download")
    expect(safeFileName("Work report Sep 2026.pptx")).toBe("Work report Sep 2026.pptx")
  })
  it("reads Content-Disposition in both forms", () => {
    expect(fileNameFromDisposition('attachment; filename="report.pdf"')).toBe("report.pdf")
    expect(
      fileNameFromDisposition("attachment; filename*=UTF-8''Riya%20%E2%80%93%20Sep.docx"),
    ).toBe("Riya – Sep.docx")
    expect(fileNameFromDisposition(null)).toBeNull()
  })
  it("adds a matching extension only when missing", () => {
    expect(withExtension("attendance", "text/csv; charset=utf-8")).toBe("attendance.csv")
    expect(withExtension("deck.pptx", "application/pdf")).toBe("deck.pptx")
    expect(withExtension("x", "application/x-unknown")).toBe("x")
  })
})

describe("signed links in JSON", () => {
  it("finds the link and a name next to it", () => {
    expect(
      findSignedUrl({
        success: true,
        data: { fileName: "Policy.pdf", signedUrl: "https://b2.example/f?X-Amz-Signature=1" },
      }),
    ).toEqual({ url: "https://b2.example/f?X-Amz-Signature=1", name: "Policy.pdf" })
    expect(findSignedUrl({ data: { url: "https://x.test/a" } })?.url).toBe("https://x.test/a")
  })
  it("ignores lists and non-links", () => {
    expect(findSignedUrl({ data: [{ url: "https://x.test/a" }] })).toBeNull()
    expect(findSignedUrl({ data: { url: "/relative" } })).toBeNull()
  })
  it("reads presigned expiry", () => {
    const url =
      "https://s3.example/f?X-Amz-Date=20261005T101500Z&X-Amz-Expires=900&X-Amz-Signature=abc"
    expect(signedUrlExpiry(url)?.toISOString()).toBe("2026-10-05T10:30:00.000Z")
    expect(looksLikePresignedStorageUrl(url)).toBe(true)
    expect(looksLikePresignedStorageUrl("https://drive.google.com/uc?id=1")).toBe(false)
    expect(signedUrlExpiry("https://drive.google.com/uc?id=1")).toBeNull()
  })
})

describe("tables", () => {
  it("picks rows from the usual envelopes", () => {
    expect(pickRows({ success: true, data: [{ a: 1 }] })?.path).toBe("data")
    expect(pickRows({ success: true, data: { data: [{ a: 1 }], pagination: {} } })?.path).toBe(
      "data.data",
    )
    expect(pickRows({ success: true, data: { rows: [{ a: 1 }], meta: {} } })?.path).toBe(
      "data.rows",
    )
    expect(
      pickRows({ success: true, data: { stats: {}, groups: { list: [{ a: 1 }, { a: 2 }] } } })
        ?.path,
    ).toBe("data.groups.list")
    expect(pickRows({ success: true, data: { count: 3 } })).toBeNull()
  })
  it("finds pagination", () => {
    expect(paginationOf({ data: { pagination: { totalPages: 4, total: 37 } } })).toEqual({
      totalPages: 4,
      total: 37,
    })
    expect(paginationOf({ data: { meta: { total: 9 } } })).toEqual({ totalPages: null, total: 9 })
    expect(paginationOf({ data: [] })).toEqual({ totalPages: null, total: null })
  })
  it("flattens nested records into stable columns", () => {
    const { columns, rows } = flattenRows([
      { id: "1", name: "Pen", item: { name: "Stationery" }, tags: ["a", "b"] },
      { id: "2", name: "Mug", extra: true },
    ])
    expect(columns).toEqual(["id", "name", "item.name", "tags", "extra"])
    expect(rows).toEqual([
      ["1", "Pen", "Stationery", "a; b", null],
      ["2", "Mug", null, null, true],
    ])
  })
  it("guards CSV cells against formula injection but keeps phone numbers", () => {
    expect(guardCsvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)")
    expect(guardCsvCell("@SUM(A1)")).toBe("'@SUM(A1)")
    expect(guardCsvCell("+91 98765 43210")).toBe("+91 98765 43210")
    expect(guardCsvCell("-12.5")).toBe("-12.5")
    expect(guardCsvCell("-cmd")).toBe("'-cmd")
    expect(guardCsvCell(42)).toBe(42)
  })
})
