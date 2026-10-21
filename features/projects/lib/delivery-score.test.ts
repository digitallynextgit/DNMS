import { describe, expect, it } from "vitest"

import {
  addTally,
  deliverableTally,
  deliveryScore,
  goalAchievement,
  taskTally,
  type OnTimeCount,
} from "./delivery-score"

const d = (s: string) => new Date(`${s}T00:00:00.000Z`)
const today = d("2026-10-20")

describe("goalAchievement", () => {
  it("compares with what should be reached by now, capped at 1", () => {
    expect(goalAchievement(500, 1200, 800)).toBeCloseTo(0.625)
    expect(goalAchievement(900, 1200, 800)).toBe(1)
  })
  it("uses the target when there is no pace", () => {
    expect(goalAchievement(600, 1200, null)).toBe(0.5)
  })
  it("has nothing to say without a target or before anything is expected", () => {
    expect(goalAchievement(5, null, null)).toBeNull()
    expect(goalAchievement(5, 100, 0)).toBeNull()
  })
})

describe("deliveryScore", () => {
  it("weighs goals 40, deliverables 35, tasks 25", () => {
    const s = deliveryScore({
      goalAchievements: [1, 0.5],
      deliverables: { onTime: 3, due: 4 },
      tasks: { onTime: 1, due: 2 },
    })
    // 0.75*.4 + 0.75*.35 + 0.5*.25 = 0.6875
    expect(s.score).toBe(69)
    expect(s.goals).toEqual({ score: 75, count: 2 })
    expect(s.deliverables).toEqual({ score: 75, onTime: 3, due: 4 })
    expect(s.basedOn).toBe(8)
  })
  it("rescales when a part has no data", () => {
    const s = deliveryScore({
      goalAchievements: [],
      deliverables: { onTime: 1, due: 1 },
      tasks: { onTime: 0, due: 1 },
    })
    // (1*.35 + 0*.25) / .6
    expect(s.score).toBe(58)
    expect(s.goals.score).toBeNull()
  })
  it("is null with nothing at all", () => {
    expect(
      deliveryScore({
        goalAchievements: [],
        deliverables: { onTime: 0, due: 0 },
        tasks: { onTime: 0, due: 0 },
      }).score,
    ).toBeNull()
  })
})

describe("tallies", () => {
  it("counts a deliverable made by its due day as on time", () => {
    expect(
      deliverableTally(
        { status: "DELIVERED", dueOn: d("2026-10-16"), completedOn: d("2026-10-16") },
        today,
      ),
    ).toBe("on_time")
    expect(
      deliverableTally(
        { status: "ACCEPTED", dueOn: d("2026-10-16"), completedOn: d("2026-10-17") },
        today,
      ),
    ).toBe("late")
  })
  it("counts owed work late only once its day has passed", () => {
    expect(
      deliverableTally({ status: "PLANNED", dueOn: d("2026-10-19"), completedOn: null }, today),
    ).toBe("late")
    expect(
      deliverableTally({ status: "PLANNED", dueOn: d("2026-10-20"), completedOn: null }, today),
    ).toBeNull()
    expect(
      deliverableTally({ status: "DISCARDED", dueOn: d("2026-10-01"), completedOn: null }, today),
    ).toBeNull()
  })
  it("gives a task all of its due day", () => {
    expect(
      taskTally(
        { status: "DONE", dueDate: d("2026-10-16"), completedAt: new Date("2026-10-16T22:00:00Z") },
        today,
      ),
    ).toBe("on_time")
    expect(
      taskTally(
        { status: "DONE", dueDate: d("2026-10-16"), completedAt: new Date("2026-10-17T01:00:00Z") },
        today,
      ),
    ).toBe("late")
  })
  it("leaves held and discarded tasks out", () => {
    expect(
      taskTally({ status: "ON_HOLD", dueDate: d("2026-10-01"), completedAt: null }, today),
    ).toBeNull()
    expect(
      taskTally({ status: "DISCARDED", dueDate: d("2026-10-01"), completedAt: null }, today),
    ).toBeNull()
    expect(taskTally({ status: "TODO", dueDate: d("2026-10-01"), completedAt: null }, today)).toBe(
      "late",
    )
  })
  it("adds up", () => {
    const c: OnTimeCount = { onTime: 0, due: 0 }
    addTally(c, "on_time")
    addTally(c, "late")
    addTally(c, null)
    expect(c).toEqual({ onTime: 1, due: 2 })
  })
})
