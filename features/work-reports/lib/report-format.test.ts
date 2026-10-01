import { describe, expect, it } from "vitest"

import {
  cleanTitle,
  dayLabel,
  daysOf,
  parseReportMonth,
  previousMonth,
  projectNamedIn,
  reportFilename,
  shiftMonth,
} from "./report-format"

describe("parseReportMonth", () => {
  it("covers the whole calendar month", () => {
    expect(parseReportMonth("2026-09")).toEqual({
      month: "2026-09",
      from: "2026-09-01",
      to: "2026-09-30",
      label: "September 2026",
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
      "Work-Report-September-2026-Diwakar-Jha.pptx",
    )
  })
})
