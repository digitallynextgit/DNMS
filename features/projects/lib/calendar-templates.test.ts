import { describe, expect, it } from "vitest"
import {
  CAMPAIGN_NONE,
  STATUS_OPTIONS,
  calendarTemplate,
  cellDate,
  dayOf,
  guessKey,
  isClosedStatus,
  isReadyStatus,
  normaliseStatus,
  rowTitle,
} from "./calendar-templates"
import { PROJECT_SERVICES } from "./project-services"

describe("calendarTemplate", () => {
  it("gives every service the spine, in order, with the campaign column once", () => {
    for (const s of PROJECT_SERVICES) {
      const t = calendarTemplate(s.code, s.calendar.tabs[0])!
      expect(t, s.code).not.toBeNull()
      expect(t.slice(0, 2).map((c) => c.key)).toEqual(["date", "day"])
      expect(t.slice(-6).map((c) => c.key)).toEqual([
        "owner",
        "internal_due",
        "status",
        "approver",
        "asset",
        "notes",
      ])
      expect(t.filter((c) => c.key === "campaign")).toHaveLength(1)
      // Keys are unique within a template.
      expect(new Set(t.map((c) => c.key)).size).toBe(t.length)
      // The spine is locked; the status list is the shared workflow.
      for (const key of ["date", "day", "campaign", "owner", "status", "approver"]) {
        expect(t.find((c) => c.key === key)?.locked, `${s.code}.${key}`).toBe(true)
      }
      expect(t.find((c) => c.key === "status")?.options).toEqual(STATUS_OPTIONS)
      expect(t.find((c) => c.key === "campaign")?.options).toEqual([CAMPAIGN_NONE])
    }
  })

  it("varies the social format list by tab", () => {
    const meta = calendarTemplate("SMO", "Meta")!.find((c) => c.key === "format")!
    const yt = calendarTemplate("SMO", "YouTube")!.find((c) => c.key === "format")!
    expect(meta.options).toContain("Reel")
    expect(yt.options).toContain("Short")
    expect(yt.options).not.toContain("Reel")
  })

  it("has no template for a custom sheet", () => {
    expect(calendarTemplate(null)).toBeNull()
    expect(calendarTemplate("NOPE")).toBeNull()
  })
})

describe("guessKey", () => {
  const t = calendarTemplate("SMO", "Meta")!
  it("matches the exact label, then the names people have typed over the months", () => {
    expect(guessKey("Date", t)).toBe("date")
    expect(guessKey("  publish DATE ", t)).toBe("date")
    expect(guessKey("Occasion / Key Date", t)).toBe("occasion")
    expect(guessKey("Theme / Campaign", t)).toBe("theme")
    expect(guessKey("Content Idea", t)).toBe("hook")
    expect(guessKey("Assigned to", t)).toBe("owner")
    expect(guessKey("Deadline", t)).toBe("internal_due")
  })
  it("knows the headers in the real calendars, typos included", () => {
    expect(guessKey("Hook/Concept", t)).toBe("hook")
    expect(guessKey("CONTENT IDEA (HOOK + CONCEPT)", t)).toBe("hook")
    expect(guessKey("Link of post", t)).toBe("live_link")
    expect(guessKey("LINK OF POST", t)).toBe("live_link")
    expect(guessKey("THEME / CAMPIAIGN", t)).toBe("theme")
    expect(guessKey("OCCASSION/ DAY", t)).toBe("occasion")
    expect(guessKey("OCCASSION / KEY DATE", t)).toBe("occasion")
    expect(guessKey("Content", t)).toBe("caption")
    expect(guessKey("DAY", t)).toBe("day")
    expect(guessKey("STATUS", t)).toBe("status")
  })
  it("only offers keys the template has, and nothing for a bare letter or an unknown header", () => {
    expect(guessKey("Target keyword", t)).toBeNull()
    expect(guessKey("C", t)).toBeNull()
    expect(guessKey("Budget approved by finance", t)).toBeNull()
    expect(guessKey("MONTH", t)).toBeNull()
    const seo = calendarTemplate("SEO")!
    expect(guessKey("Search Intent / Target Query", seo)).toBe("keyword")
    expect(guessKey("Topic", seo)).toBe("title")
  })
})

describe("statuses", () => {
  it("reads what people typed before the fixed list as the workflow's statuses", () => {
    expect(normaliseStatus("Posted")).toBe("Done")
    expect(normaliseStatus("Planned\n")).toBe("Planned")
    expect(normaliseStatus("Drafted — ready for review")).toBe("Review")
    expect(normaliseStatus("In Progress")).toBe("In progress")
    expect(normaliseStatus("Approved")).toBe("Approved")
    expect(normaliseStatus("On hold")).toBe("On hold")
    expect(normaliseStatus("")).toBeNull()
    expect(normaliseStatus(3)).toBeNull()
  })
  it("tells closed and ready rows apart", () => {
    expect(isClosedStatus("posted")).toBe(true)
    expect(isClosedStatus("Dropped")).toBe(true)
    expect(isClosedStatus("Planned")).toBe(false)
    expect(isClosedStatus(null)).toBe(false)
    expect(isReadyStatus("Scheduled")).toBe(true)
    expect(isReadyStatus("Review")).toBe(false)
  })
})

describe("dates", () => {
  it("reads the date shapes a cell can hold", () => {
    expect(cellDate("2026-12-02")).toBe("2026-12-02")
    expect(cellDate("2026-12-02\n")).toBe("2026-12-02")
    expect(cellDate("2026-12-02T00:00:00.000Z")).toBe("2026-12-02")
    expect(cellDate("02/12/2026")).toBe("2026-12-02")
    expect(cellDate("2-12-2026")).toBe("2026-12-02")
    expect(cellDate("15.10.2026")).toBe("2026-10-15")
    expect(cellDate("15-Sep-26")).toBe("2026-09-15")
    expect(cellDate("15 Sep 2026")).toBe("2026-09-15")
    expect(cellDate("1st Oct 2026")).toBe("2026-10-01")
    expect(cellDate("Sep 15, 2026")).toBe("2026-09-15")
    expect(cellDate("Oct 1 2026")).toBe("2026-10-01")
    expect(cellDate("Wednesday, 1 October 2026")).toBe("2026-10-01")
  })
  it("refuses what is not a date, including a date with no year", () => {
    expect(cellDate("")).toBeNull()
    expect(cellDate("soon")).toBeNull()
    expect(cellDate("Total posts")).toBeNull()
    expect(cellDate("15 Sep")).toBeNull()
    expect(cellDate("Oct 1")).toBeNull()
    expect(cellDate("31/02/2026")).toBeNull()
    expect(cellDate(5)).toBeNull()
  })
  it("derives the weekday", () => {
    expect(dayOf("2026-12-02")).toBe("Wed")
    expect(dayOf("2026-10-13")).toBe("Tue")
    expect(dayOf("15-Sep-26")).toBe("Tue")
    expect(dayOf("")).toBe("")
  })
})

describe("rowTitle", () => {
  it("prefers the theme, then falls back to the row number", () => {
    const byKey = new Map([
      ["theme", { id: "t" }],
      ["occasion", { id: "o" }],
    ])
    expect(rowTitle({ t: "Winter Skin", o: "Winter" }, byKey, 0)).toBe("Winter Skin")
    expect(rowTitle({ o: "Winter" }, byKey, 0)).toBe("Winter")
    expect(rowTitle({ t: "Line one\n\nline two" }, byKey, 0)).toBe("Line one line two")
    expect(rowTitle({}, byKey, 4)).toBe("Row 5")
  })
})
