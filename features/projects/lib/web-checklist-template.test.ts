import { describe, expect, it } from "vitest"
import {
  WEB_CHECKLIST_ITEMS,
  WEB_CHECKLIST_KEYS,
  WEB_CHECKLIST_STATUSES,
  WEB_CHECKLIST_STATUS_LABELS,
  WEB_CHECKLIST_TOTAL,
  isWebChecklistStatus,
} from "./web-checklist-template"
import { webChecklistItemPatchSchema } from "../schemas/web-checklist.schema"

describe("web checklist template", () => {
  it("has unique item keys and names", () => {
    expect(WEB_CHECKLIST_KEYS.size).toBe(WEB_CHECKLIST_TOTAL)
    expect(new Set(WEB_CHECKLIST_ITEMS.map((i) => i.text)).size).toBe(WEB_CHECKLIST_TOTAL)
  })

  it("labels every status", () => {
    for (const s of WEB_CHECKLIST_STATUSES) expect(WEB_CHECKLIST_STATUS_LABELS[s]).toBeTruthy()
    expect(isWebChecklistStatus("DONE")).toBe(true)
    expect(isWebChecklistStatus("done")).toBe(false)
  })
})

describe("webChecklistItemPatchSchema", () => {
  it("accepts a status, a note or both", () => {
    expect(webChecklistItemPatchSchema.parse({ status: "NOT_APPLICABLE" })).toEqual({
      status: "NOT_APPLICABLE",
    })
    expect(webChecklistItemPatchSchema.parse({ note: null })).toEqual({ note: null })
  })

  it("rejects an empty patch and unknown statuses", () => {
    expect(() => webChecklistItemPatchSchema.parse({})).toThrow()
    expect(() => webChecklistItemPatchSchema.parse({ status: "WAITING_ON_CLIENT" })).toThrow()
    expect(() => webChecklistItemPatchSchema.parse({ note: "x".repeat(2001) })).toThrow()
  })
})
