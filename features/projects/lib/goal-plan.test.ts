import { describe, expect, it } from "vitest"

import { groupGoalPlans, madeOf, type GoalPlanRow } from "./goal-plan"

const d = (s: string) => new Date(`${s}T00:00:00.000Z`)
let n = 0
const row = (p: Partial<GoalPlanRow>): GoalPlanRow => ({
  id: `d${++n}`,
  goalId: "g1",
  teamId: "t-design",
  teamName: "DESIGN",
  type: "Banner",
  title: "Diwali banners",
  quantity: 1,
  deliveredQuantity: 0,
  status: "PLANNED",
  dueOn: d("2026-10-16"),
  employeeId: null,
  employeeName: null,
  ...p,
})

describe("madeOf", () => {
  it("counts the whole quantity once delivered or accepted", () => {
    expect(madeOf({ status: "DELIVERED", quantity: 8, deliveredQuantity: 3 })).toBe(8)
    expect(madeOf({ status: "ACCEPTED", quantity: 2, deliveredQuantity: 0 })).toBe(2)
  })
  it("counts the logged part while open, capped at the quantity", () => {
    expect(madeOf({ status: "IN_PROGRESS", quantity: 8, deliveredQuantity: 3 })).toBe(3)
    expect(madeOf({ status: "IN_PROGRESS", quantity: 2, deliveredQuantity: 5 })).toBe(2)
  })
})

describe("groupGoalPlans", () => {
  const today = d("2026-10-20")

  it("groups by goal and team, in the fixed team order", () => {
    const plans = groupGoalPlans(
      [
        row({ teamId: "t-video", teamName: "VIDEO", quantity: 4 }),
        row({ quantity: 8, deliveredQuantity: 3, status: "IN_PROGRESS", employeeId: "e1" }),
        row({ teamId: "t-web", teamName: "WEB", quantity: 3, status: "DELIVERED" }),
        row({ goalId: "g2", quantity: 6 }),
      ],
      today,
    )
    expect(Object.keys(plans).sort()).toEqual(["g1", "g2"])
    expect(plans.g1!.map((t) => t.teamName)).toEqual(["WEB", "DESIGN", "VIDEO"])
    const design = plans.g1!.find((t) => t.teamName === "DESIGN")!
    expect(design).toMatchObject({ planned: 8, made: 3, overdue: 1, unclaimed: 0 })
  })

  it("flags late and unclaimed owed work, and leaves discarded out", () => {
    const plans = groupGoalPlans(
      [
        row({ dueOn: d("2026-10-30") }),
        row({ dueOn: d("2026-10-19"), status: "STUCK" }),
        row({ dueOn: d("2026-10-01"), status: "DELIVERED", employeeId: "e1" }),
        row({ status: "DISCARDED", quantity: 50 }),
      ],
      today,
    )
    const t = plans.g1![0]!
    expect(t).toMatchObject({ planned: 3, made: 1, overdue: 1, unclaimed: 2 })
    expect(t.items.map((i) => i.dueOn)).toEqual(["2026-10-01", "2026-10-19", "2026-10-30"])
    expect(t.items.find((i) => i.dueOn === "2026-10-19")!.overdue).toBe(true)
  })

  it("puts work with no team last", () => {
    const plans = groupGoalPlans([row({ teamId: null, teamName: null }), row({})], today)
    expect(plans.g1!.map((t) => t.teamName)).toEqual(["DESIGN", "No team"])
  })
})
