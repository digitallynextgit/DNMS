import { describe, expect, it } from "vitest"

import { daysFrom, fnfDueDate, fnfStatus, fnfStatusLabel, indiaToday } from "./fnf"

describe("fnfDueDate", () => {
  it("is two months after the last working day, as in HR's sheet", () => {
    expect(fnfDueDate("2025-12-11")).toBe("2026-02-11")
    expect(fnfDueDate("2026-01-16")).toBe("2026-03-16")
    expect(fnfDueDate("2026-09-15")).toBe("2026-11-15")
  })
  it("ends on the month's last day when the day doesn't exist", () => {
    expect(fnfDueDate("2025-12-31")).toBe("2026-02-28")
    expect(fnfDueDate("2027-12-30")).toBe("2028-02-29")
    expect(fnfDueDate("2026-08-31")).toBe("2026-10-31")
  })
  it("crosses the year", () => {
    expect(fnfDueDate("2026-11-05")).toBe("2027-01-05")
  })
})

describe("fnfStatus", () => {
  const due = "2026-04-23"
  it("counts released ones as on time or late", () => {
    expect(fnfStatus({ dueDate: due, releasedOn: "2026-04-20" }, "2026-10-22")).toEqual({
      state: "RELEASED",
      days: 0,
    })
    expect(fnfStatus({ dueDate: "2026-03-16", releasedOn: "2026-04-30" }, "2026-10-22")).toEqual({
      state: "RELEASED_LATE",
      days: 45,
    })
  })
  it("flags unreleased ones as overdue, due soon or pending", () => {
    expect(fnfStatus({ dueDate: due, releasedOn: null }, "2026-10-22").state).toBe("OVERDUE")
    expect(fnfStatus({ dueDate: due, releasedOn: null }, "2026-04-16")).toEqual({
      state: "DUE_SOON",
      days: 7,
    })
    expect(fnfStatus({ dueDate: due, releasedOn: null }, "2026-04-15")).toEqual({
      state: "PENDING",
      days: 8,
    })
    expect(fnfStatus({ dueDate: due, releasedOn: null }, due)).toEqual({
      state: "DUE_SOON",
      days: 0,
    })
  })
  it("reads in plain words", () => {
    expect(fnfStatusLabel({ state: "OVERDUE", days: 1 })).toBe("Overdue by 1 day")
    expect(fnfStatusLabel({ state: "RELEASED_LATE", days: 45 })).toBe("Released 45 days late")
    expect(fnfStatusLabel({ state: "DUE_SOON", days: 0 })).toBe("Due today")
  })
})

describe("dates", () => {
  it("counts whole days", () => {
    expect(daysFrom("2026-02-28", "2026-03-01")).toBe(1)
    expect(daysFrom("2026-03-01", "2026-02-28")).toBe(-1)
  })
  it("takes today in India, not UTC", () => {
    // 20:00 UTC on 21 Oct is 01:30 on 22 Oct in India.
    expect(indiaToday(new Date("2026-10-21T20:00:00Z"))).toBe("2026-10-22")
  })
})
