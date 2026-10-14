import { describe, expect, it } from "vitest"

import {
  backupDue,
  backupKey,
  istParts,
  needsBackup,
  nextBackupAt,
  planFromLimit,
  storageWarnings,
} from "./drive-plan"

const GB = 1024 ** 3

describe("planFromLimit", () => {
  it("names the free plan and the Google One sizes", () => {
    expect(planFromLimit(16106127360).label).toBe("Free · 15 GB")
    expect(planFromLimit(100 * GB).label).toBe("Google One · 100 GB")
    expect(planFromLimit(2048 * GB).label).toBe("Google One · 2 TB")
    expect(planFromLimit(null).tier).toBe("unlimited")
    expect(planFromLimit(30 * GB).tier).toBe("custom")
  })
})

describe("storageWarnings", () => {
  it("suggests the upgrade once a free account passes 10 GB", () => {
    const w = storageWarnings({ limit: 15 * GB, usage: 11 * GB, usageInDriveTrash: 0 })
    expect(w.map((x) => x.level)).toEqual(["warn"])
    expect(w[0]!.message).toContain("100 GB")
  })

  it("goes critical near full and stays quiet when there is room", () => {
    expect(
      storageWarnings({ limit: 100 * GB, usage: 96 * GB, usageInDriveTrash: 0 })[0]!.level,
    ).toBe("critical")
    expect(storageWarnings({ limit: 15 * GB, usage: 2 * GB, usageInDriveTrash: 0 })).toEqual([])
  })

  it("points at a big trash", () => {
    const w = storageWarnings({ limit: 100 * GB, usage: 5 * GB, usageInDriveTrash: 2 * GB })
    expect(w).toHaveLength(1)
    expect(w[0]!.level).toBe("info")
  })
})

describe("backup clock (IST)", () => {
  // 20:30 UTC = 02:00 IST the next day.
  const twoAmIst = new Date("2026-10-12T20:30:00Z")

  it("reads the IST date and hour", () => {
    expect(istParts(twoAmIst)).toEqual({ date: "2026-10-13", hour: 2 })
    expect(istParts(new Date("2026-10-12T20:29:00Z"))).toEqual({ date: "2026-10-13", hour: 1 })
  })

  it("runs once per IST day from 2 AM", () => {
    expect(backupDue(new Date("2026-10-12T20:00:00Z"), "2026-10-12")).toBe(false) // 01:30 IST
    expect(backupDue(twoAmIst, "2026-10-12")).toBe(true)
    expect(backupDue(twoAmIst, "2026-10-13")).toBe(false)
  })

  it("names the next run", () => {
    expect(nextBackupAt(new Date("2026-10-12T10:00:00Z"), "2026-10-12").toISOString()).toBe(
      "2026-10-12T20:30:00.000Z",
    )
    expect(nextBackupAt(new Date("2026-10-12T19:00:00Z"), "2026-10-12").toISOString()).toBe(
      "2026-10-12T20:30:00.000Z",
    )
  })
})

describe("backupKey", () => {
  it("keeps the extension and is readable", () => {
    expect(
      backupKey({
        tenantSlug: "digitallynext",
        projectId: "p1",
        driveFileId: "abc",
        name: "Q3 Plan (final).PDF",
      }),
    ).toBe("drive-backup/digitallynext/p1/abc-q3-plan-final.pdf")
  })

  it("uses the export extension for Google files", () => {
    expect(
      backupKey({
        tenantSlug: "demo",
        projectId: null,
        driveFileId: "x",
        name: "Brief",
        ext: ".docx",
      }),
    ).toBe("drive-backup/demo/unfiled/x-brief.docx")
  })
})

describe("needsBackup", () => {
  it("copies new files and files changed since the last copy", () => {
    expect(needsBackup("2026-10-12T10:00:00Z", null)).toBe(true)
    const prev = { sourceModifiedAt: new Date("2026-10-12T10:00:00Z") }
    expect(needsBackup("2026-10-12T10:00:00Z", prev)).toBe(false)
    expect(needsBackup("2026-10-12T11:00:00Z", prev)).toBe(true)
  })
})
