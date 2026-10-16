import { describe, expect, it } from "vitest"

import { partDayLeaveCredit } from "./payroll"

describe("partDayLeaveCredit", () => {
  it("pays a full day for a paid 2-hour short leave when they came in", () => {
    expect(partDayLeaveCredit({ leaveDays: 0.25, paid: true, cameIn: true })).toEqual({
      payable: 1,
      lop: 0,
      paidLeave: 0.25,
    })
  })

  it("pays a full day for a paid half day even though attendance shows a half day", () => {
    expect(partDayLeaveCredit({ leaveDays: 0.5, paid: true, cameIn: true })).toEqual({
      payable: 1,
      lop: 0,
      paidLeave: 0.5,
    })
  })

  it("docks only the unpaid fraction (a probationer's short leave without pay)", () => {
    expect(partDayLeaveCredit({ leaveDays: 0.25, paid: false, cameIn: true })).toEqual({
      payable: 0.75,
      lop: 0.25,
      paidLeave: 0,
    })
  })

  it("loses the rest of the day when they never came in", () => {
    expect(partDayLeaveCredit({ leaveDays: 0.5, paid: true, cameIn: false })).toEqual({
      payable: 0.5,
      lop: 0.5,
      paidLeave: 0.5,
    })
    expect(partDayLeaveCredit({ leaveDays: 0.5, paid: false, cameIn: false })).toEqual({
      payable: 0,
      lop: 1,
      paidLeave: 0,
    })
  })
})
