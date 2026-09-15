import { describe, expect, it } from "vitest"

import {
  canActOnItem,
  canComplete,
  checklistProgress,
  isServingNotice,
  itemDueDate,
  resolveAssignee,
  type ChecklistItemState,
} from "./checklist-rules"

// Helper so each test names only what it cares about.
function item(over: Partial<ChecklistItemState> = {}): ChecklistItemState {
  return {
    id: over.id ?? "i1",
    text: over.text ?? "An item",
    itemKind: over.itemKind ?? "TASK",
    isRequired: over.isRequired ?? true,
    isDone: over.isDone ?? false,
  }
}

describe("itemDueDate", () => {
  const joining = new Date("2026-09-14T00:00:00.000Z")

  it("adds a positive offset (week four of onboarding)", () => {
    expect(itemDueDate(joining, 28)?.toISOString().slice(0, 10)).toBe("2026-10-12")
  })

  it("subtracts a negative offset (handover before the last working day)", () => {
    expect(itemDueDate(joining, -7)?.toISOString().slice(0, 10)).toBe("2026-09-07")
  })

  it("treats offset 0 as the anchor day itself", () => {
    expect(itemDueDate(joining, 0)?.toISOString().slice(0, 10)).toBe("2026-09-14")
  })

  it("returns null with no anchor - an employee with no joining date", () => {
    expect(itemDueDate(null, 7)).toBeNull()
    expect(itemDueDate(undefined, 7)).toBeNull()
  })

  it("returns null with no offset rather than inventing a date", () => {
    expect(itemDueDate(joining, null)).toBeNull()
  })

  it("returns null for an unparseable anchor instead of Invalid Date", () => {
    expect(itemDueDate("not-a-date", 1)).toBeNull()
  })

  it("accepts a date-only string", () => {
    expect(itemDueDate("2026-09-14", 1)?.toISOString().slice(0, 10)).toBe("2026-09-15")
  })

  it("does not drift across a month boundary", () => {
    expect(itemDueDate("2026-01-31", 1)?.toISOString().slice(0, 10)).toBe("2026-02-01")
  })
})

describe("canComplete - the relieving gate", () => {
  it("blocks while a required clearance is unsigned, and names it", () => {
    const result = canComplete([
      item({ id: "a", itemKind: "CLEARANCE", text: "Finance", isDone: false }),
      item({ id: "b", itemKind: "CLEARANCE", text: "IT / Admin", isDone: true }),
    ])
    expect(result.ok).toBe(false)
    expect(result.blocking).toEqual([{ id: "a", text: "Finance" }])
  })

  it("passes once every required clearance is signed", () => {
    const result = canComplete([
      item({ itemKind: "CLEARANCE", isDone: true }),
      item({ id: "b", itemKind: "CLEARANCE", isDone: true }),
    ])
    expect(result.ok).toBe(true)
    expect(result.blocking).toEqual([])
  })

  it("does NOT block on an unfinished TASK, even a required one", () => {
    // Deliberate: an unticked "team farewell email" is untidy; issuing a
    // relieving letter without Finance signing is a different kind of problem.
    const result = canComplete([
      item({ itemKind: "TASK", isRequired: true, isDone: false }),
      item({ id: "b", itemKind: "CLEARANCE", isRequired: true, isDone: true }),
    ])
    expect(result.ok).toBe(true)
  })

  it("does not block on an OPTIONAL unsigned clearance", () => {
    const result = canComplete([item({ itemKind: "CLEARANCE", isRequired: false, isDone: false })])
    expect(result.ok).toBe(true)
  })

  it("passes an empty checklist rather than deadlocking", () => {
    expect(canComplete([]).ok).toBe(true)
  })

  it("reports every blocker, not just the first", () => {
    const result = canComplete([
      item({ id: "a", itemKind: "CLEARANCE", text: "Finance" }),
      item({ id: "b", itemKind: "CLEARANCE", text: "IT / Admin" }),
      item({ id: "c", itemKind: "CLEARANCE", text: "Manager" }),
    ])
    expect(result.blocking.map((b) => b.text)).toEqual(["Finance", "IT / Admin", "Manager"])
  })
})

describe("checklistProgress", () => {
  it("never rounds up to 100 when something is outstanding", () => {
    const items = Array.from({ length: 24 }, (_, n) => item({ id: `i${n}`, isDone: n < 23 }))
    expect(checklistProgress(items).percent).toBe(95)
  })

  it("reports 100 only when everything is done", () => {
    const items = [item({ isDone: true }), item({ id: "b", isDone: true })]
    expect(checklistProgress(items).percent).toBe(100)
  })

  it("counts clearances separately", () => {
    const p = checklistProgress([
      item({ id: "a", itemKind: "CLEARANCE", isDone: true }),
      item({ id: "b", itemKind: "CLEARANCE", isDone: false }),
      item({ id: "c", itemKind: "TASK", isDone: true }),
    ])
    expect(p).toMatchObject({ total: 3, done: 2, clearancesTotal: 2, clearancesDone: 1 })
  })

  it("handles an empty checklist without dividing by zero", () => {
    expect(checklistProgress([]).percent).toBe(0)
  })
})

describe("resolveAssignee", () => {
  const ctx = {
    employeeId: "emp-1",
    managerId: "mgr-1",
    departmentHeadId: "head-1",
    clearanceDepartmentHeadId: "fin-head",
  }

  it("routes EMPLOYEE items to the employee", () => {
    expect(resolveAssignee("EMPLOYEE", ctx)).toBe("emp-1")
  })

  it("routes MANAGER items to the reporting manager", () => {
    expect(resolveAssignee("MANAGER", ctx)).toBe("mgr-1")
  })

  it("falls back to the department head when there is no manager", () => {
    expect(resolveAssignee("MANAGER", { ...ctx, managerId: null })).toBe("head-1")
  })

  it("returns null when neither a manager nor a department head exists", () => {
    expect(
      resolveAssignee("MANAGER", { employeeId: "emp-1", managerId: null, departmentHeadId: null }),
    ).toBeNull()
  })

  it("routes DEPARTMENT_HEAD items to that department's head", () => {
    expect(resolveAssignee("DEPARTMENT_HEAD", ctx)).toBe("fin-head")
  })

  it("returns null for a department with no head set", () => {
    expect(
      resolveAssignee("DEPARTMENT_HEAD", { ...ctx, clearanceDepartmentHeadId: null }),
    ).toBeNull()
  })

  it("leaves HR unresolved - it is a pool, not a person", () => {
    expect(resolveAssignee("HR", ctx)).toBeNull()
  })
})

describe("canActOnItem", () => {
  it("lets the named assignee sign their own clearance", () => {
    expect(canActOnItem({ itemKind: "CLEARANCE", assigneeId: "fin-head" }, "fin-head", false)).toBe(
      true,
    )
  })

  it("refuses a clearance assigned to somebody else", () => {
    expect(canActOnItem({ itemKind: "CLEARANCE", assigneeId: "fin-head" }, "someone", false)).toBe(
      false,
    )
  })

  it("allows an HR override so an exit cannot deadlock on an absent head", () => {
    expect(canActOnItem({ itemKind: "CLEARANCE", assigneeId: "fin-head" }, "hr-1", true)).toBe(true)
  })

  it("lets any HR-scoped user action an unassigned pool task", () => {
    expect(canActOnItem({ itemKind: "TASK", assigneeId: null }, "hr-1", true)).toBe(true)
  })

  it("refuses an unassigned task to somebody with no scope", () => {
    expect(canActOnItem({ itemKind: "TASK", assigneeId: null }, "emp-9", false)).toBe(false)
  })
})

describe("isServingNotice", () => {
  const now = new Date("2026-09-14T10:00:00.000Z")

  it("is true for an accepted resignation whose last day is ahead", () => {
    expect(isServingNotice("APPROVED", "2026-09-30", now)).toBe(true)
  })

  it("is true ON the last working day - it is still a working day", () => {
    expect(isServingNotice("APPROVED", "2026-09-14", now)).toBe(true)
  })

  it("is false once the last working day has passed", () => {
    expect(isServingNotice("APPROVED", "2026-09-13", now)).toBe(false)
  })

  it("is false while the resignation is still pending", () => {
    expect(isServingNotice("PENDING", "2026-09-30", now)).toBe(false)
  })

  it("is false when the resignation was rejected or withdrawn", () => {
    expect(isServingNotice("REJECTED", "2026-09-30", now)).toBe(false)
    expect(isServingNotice("CANCELLED", "2026-09-30", now)).toBe(false)
  })

  it("is false with no resignation and no last working day", () => {
    expect(isServingNotice(null, null, now)).toBe(false)
    expect(isServingNotice("APPROVED", null, now)).toBe(false)
  })
})
