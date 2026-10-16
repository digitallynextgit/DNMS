import { describe, expect, it } from "vitest"

import {
  cleanTitle,
  dayLabel,
  daysOf,
  parseReportMonth,
  parseReportRange,
  periodLine,
  previousMonth,
  projectNamedIn,
  reportFilename,
  reportKind,
  shiftMonth,
  workingDayCount,
} from "./report-format"

describe("workingDayCount", () => {
  it("counts a half-day leave as half a day and a full-day leave as none", () => {
    // Diwakar, 12-16 Oct: Mon, Tue (half-day CL), Wed leave, Thu, Fri.
    expect(
      workingDayCount([
        { kind: "work", halfDayLeave: false },
        { kind: "work", halfDayLeave: true },
        { kind: "leave", halfDayLeave: false },
        { kind: "work", halfDayLeave: false },
        { kind: "idle", halfDayLeave: false },
      ]),
    ).toBe(3.5)
  })

  it("counts a 2-hour short leave day as three quarters of a day", () => {
    expect(
      workingDayCount([
        { kind: "work", halfDayLeave: true, leaveDays: 0.25 },
        { kind: "work", halfDayLeave: false },
      ]),
    ).toBe(1.75)
  })
})

describe("parseReportMonth", () => {
  it("covers the whole calendar month", () => {
    expect(parseReportMonth("2026-09")).toEqual({
      month: "2026-09",
      from: "2026-09-01",
      to: "2026-09-30",
      label: "September 2026",
      wholeMonth: true,
    })
  })
  it("knows February in a leap year", () => {
    expect(parseReportMonth("2028-02")?.to).toBe("2028-02-29")
  })
  it("rejects anything that is not YYYY-MM", () => {
    expect(parseReportMonth("2026-13")).toBeNull()
    expect(parseReportMonth("2026-9")).toBeNull()
  })
})

describe("parseReportRange", () => {
  it("labels a week, a cross-month span and a single day", () => {
    expect(parseReportRange("2026-10-05", "2026-10-11")).toEqual({
      month: "2026-10",
      from: "2026-10-05",
      to: "2026-10-11",
      label: "5–11 Oct 2026",
      wholeMonth: false,
    })
    expect(parseReportRange("2026-09-28", "2026-10-04")?.label).toBe("28 Sep – 4 Oct 2026")
    expect(parseReportRange("2026-12-28", "2027-01-03")?.label).toBe("28 Dec 2026 – 3 Jan 2027")
    expect(parseReportRange("2026-10-09", "2026-10-09")?.label).toBe("9 Oct 2026")
  })
  it("reads an exact month as that month", () => {
    expect(parseReportRange("2026-09-01", "2026-09-30")).toEqual(parseReportMonth("2026-09"))
  })
  it("rejects reversed, unreal or overlong ranges", () => {
    expect(parseReportRange("2026-10-11", "2026-10-05")).toBeNull()
    expect(parseReportRange("2026-02-30", "2026-03-02")).toBeNull()
    expect(parseReportRange("2026-01-01", "2026-06-30")).toBeNull()
  })
  it("keeps the dash out of the filename", () => {
    expect(reportFilename("5–11 Oct 2026", "Priya Sharma", "pdf")).toBe(
      "Progress-Report-5-11-Oct-2026-Priya-Sharma.pdf",
    )
  })
})

describe("reportKind and periodLine", () => {
  it("names a week, a month and anything else", () => {
    expect(reportKind(parseReportRange("2026-10-12", "2026-10-18")!)).toBe("Weekly progress report")
    expect(reportKind(parseReportMonth("2026-09")!)).toBe("Monthly progress report")
    expect(reportKind(parseReportRange("2026-10-01", "2026-10-12")!)).toBe("Progress report")
  })
  it("states the dates once, with the day count", () => {
    expect(periodLine(parseReportRange("2026-10-12", "2026-10-18")!)).toBe(
      "12–18 Oct 2026 (7 days)",
    )
    expect(periodLine(parseReportMonth("2026-09")!)).toBe("1–30 September 2026 (30 days)")
    expect(periodLine(parseReportRange("2026-10-09", "2026-10-09")!)).toBe("9 Oct 2026 (1 day)")
  })
})

describe("month arithmetic", () => {
  it("previous month is taken in IST", () => {
    // 1 Oct 00:30 IST is still 30 Sep in UTC.
    expect(previousMonth(new Date("2026-09-30T19:00:00Z"))).toBe("2026-09")
  })
  it("shifts across a year boundary", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12")
  })
  it("lists every day of the month", () => {
    expect(daysOf(parseReportMonth("2026-09")!)).toHaveLength(30)
  })
  it("labels a day", () => {
    expect(dayLabel("2026-09-01")).toEqual({ dm: "01 Sep", dow: "Tue" })
  })
})

describe("cleanTitle", () => {
  it("drops pasted list numbering and stray spaces", () => {
    expect(cleanTitle("1. 1. work on seo of the website ")).toBe("Work on seo of the website")
  })
  it("tidies spaces before punctuation and trailing separators", () => {
    expect(cleanTitle("Creating GSC , GA4 , clarity ,")).toBe("Creating GSC, GA4, clarity")
  })
})

describe("projectNamedIn", () => {
  const projects = [
    { name: "SKELMET", code: "SKL" },
    { name: "HAPPY GANGA", code: "HG" },
    { name: "DNMS", code: null },
  ]
  it("finds a project named in an ad-hoc title", () => {
    expect(projectNamedIn("skelmet - shiprocket setup", projects)).toBe("SKELMET")
    expect(projectNamedIn("happy ganga homepage changes", projects)).toBe("HAPPY GANGA")
  })
  it("finds a multi-word project written as one word", () => {
    expect(projectNamedIn("happyganga homepage changes", projects)).toBe("HAPPY GANGA")
  })
  it("matches whole words only", () => {
    expect(projectNamedIn("dnmsx migration", projects)).toBeNull()
  })
  it("ignores codes shorter than three characters", () => {
    expect(projectNamedIn("hg review", projects)).toBeNull()
  })
})

describe("reportFilename", () => {
  it("is ASCII and dash-separated", () => {
    expect(reportFilename("September 2026", "Diwakar Jha", "pptx")).toBe(
      "Progress-Report-September-2026-Diwakar-Jha.pptx",
    )
  })
})
