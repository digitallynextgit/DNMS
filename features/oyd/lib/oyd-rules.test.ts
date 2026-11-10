import { describe, expect, it } from "vitest"
import {
  canRemoveFlag,
  canReviewFlag,
  canSeeFlag,
  confirmsAtOnce,
  countsTowardsLevel,
  isOydHrRoles,
  levelFor,
  ordinal,
  type OydFlagFacts,
  type OydViewer,
} from "./oyd-rules"

const viewer = (over: Partial<OydViewer> = {}): OydViewer => ({
  id: "me",
  isHr: false,
  managedIds: [],
  ...over,
})
const flag = (over: Partial<OydFlagFacts> = {}): OydFlagFacts => ({
  employeeId: "emp",
  raisedById: "teammate",
  status: "PENDING",
  removedAt: null,
  ...over,
})

describe("isOydHrRoles", () => {
  it("counts HR and admins, not plain employees", () => {
    expect(isOydHrRoles(["hr_employee"])).toBe(true)
    expect(isOydHrRoles(["hr_manager"])).toBe(true)
    expect(isOydHrRoles(["admin"])).toBe(true)
    expect(isOydHrRoles(["admin_"])).toBe(true)
    expect(isOydHrRoles(["employee"])).toBe(false)
  })
})

describe("canSeeFlag", () => {
  it("lets HR and the Reporting Manager see every status", () => {
    expect(canSeeFlag(flag(), viewer({ isHr: true }))).toBe(true)
    expect(canSeeFlag(flag({ status: "REJECTED" }), viewer({ managedIds: ["emp"] }))).toBe(true)
  })
  it("lets the raiser see their own flag", () => {
    expect(canSeeFlag(flag({ raisedById: "me" }), viewer())).toBe(true)
  })
  it("shows the employee only confirmed flags, removed ones included", () => {
    const me = viewer({ id: "emp" })
    expect(canSeeFlag(flag({ status: "PENDING" }), me)).toBe(false)
    expect(canSeeFlag(flag({ status: "REJECTED" }), me)).toBe(false)
    expect(canSeeFlag(flag({ status: "CONFIRMED" }), me)).toBe(true)
    expect(canSeeFlag(flag({ status: "CONFIRMED", removedAt: new Date() }), me)).toBe(true)
  })
  it("hides flags from unrelated colleagues", () => {
    expect(canSeeFlag(flag({ status: "CONFIRMED" }), viewer())).toBe(false)
  })
  it("never matches a null raiser to the viewer", () => {
    expect(canSeeFlag(flag({ raisedById: null }), viewer())).toBe(false)
  })
})

describe("canReviewFlag", () => {
  it("is HR or the Reporting Manager, on pending flags only", () => {
    expect(canReviewFlag(flag(), viewer({ isHr: true }))).toBe(true)
    expect(canReviewFlag(flag(), viewer({ managedIds: ["emp"] }))).toBe(true)
    expect(canReviewFlag(flag(), viewer())).toBe(false)
    expect(canReviewFlag(flag({ status: "CONFIRMED" }), viewer({ isHr: true }))).toBe(false)
    expect(canReviewFlag(flag({ removedAt: new Date() }), viewer({ isHr: true }))).toBe(false)
  })
  it("never lets someone review a flag on themselves", () => {
    expect(canReviewFlag(flag({ employeeId: "me" }), viewer({ isHr: true }))).toBe(false)
  })
})

describe("canRemoveFlag", () => {
  it("is the raiser, HR or an admin", () => {
    expect(canRemoveFlag(flag({ raisedById: "me" }), viewer())).toBe(true)
    expect(canRemoveFlag(flag({ status: "CONFIRMED" }), viewer({ isHr: true }))).toBe(true)
    expect(canRemoveFlag(flag({ status: "CONFIRMED" }), viewer({ managedIds: ["emp"] }))).toBe(
      false,
    )
  })
  it("refuses removed, rejected and own flags", () => {
    expect(canRemoveFlag(flag({ removedAt: new Date() }), viewer({ isHr: true }))).toBe(false)
    expect(canRemoveFlag(flag({ status: "REJECTED" }), viewer({ isHr: true }))).toBe(false)
    expect(canRemoveFlag(flag({ employeeId: "me" }), viewer({ isHr: true }))).toBe(false)
  })
})

describe("confirmsAtOnce", () => {
  it("is true for HR and the Reporting Manager, false for a teammate", () => {
    expect(confirmsAtOnce(viewer({ isHr: true }), "emp")).toBe(true)
    expect(confirmsAtOnce(viewer({ managedIds: ["emp"] }), "emp")).toBe(true)
    expect(confirmsAtOnce(viewer(), "emp")).toBe(false)
  })
})

describe("countsTowardsLevel and levelFor", () => {
  it("counts only confirmed, unremoved flags", () => {
    expect(countsTowardsLevel({ status: "CONFIRMED", removedAt: null })).toBe(true)
    expect(countsTowardsLevel({ status: "CONFIRMED", removedAt: "2026-11-10" })).toBe(false)
    expect(countsTowardsLevel({ status: "PENDING", removedAt: null })).toBe(false)
  })
  it("maps counts to the four steps and caps at the last", () => {
    expect(levelFor(0)).toBeNull()
    expect(levelFor(1)?.label).toBe("Flag 1")
    expect(levelFor(3)?.action).toContain("PIP")
    expect(levelFor(4)?.label).toBe("Flag 4")
    expect(levelFor(7)?.label).toBe("Flag 4")
  })
})

describe("ordinal", () => {
  it("handles teens and the usual endings", () => {
    expect(
      ["1", "2", "3", "4", "11", "12", "13", "21", "22"].map((n) => ordinal(Number(n))),
    ).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd"])
  })
})
