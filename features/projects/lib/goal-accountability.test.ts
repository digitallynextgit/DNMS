import { describe, expect, it } from "vitest"

import { goalVerdict, mainGoalVerdict, type VerdictGoal } from "./goal-accountability"
import type { GoalPlanItem, GoalPlanTeam } from "./goal-plan"
import type { GoalTaskLink } from "./goal-derivation"

const today = new Date("2026-10-20T00:00:00.000Z")

const goal = (p: Partial<VerdictGoal> = {}): VerdictGoal => ({
  id: "web",
  title: "Website",
  status: "IN_PROGRESS",
  ownerName: "Diwakar",
  metricLabel: "Orders",
  targetValue: 1200,
  actualValue: 500,
  paceValue: 774,
  periodStart: "2026-10-01",
  periodEnd: "2026-10-31",
  createdAt: "2026-10-01T05:00:00.000Z",
  actualSource: "MANUAL",
  lastResultOn: "2026-10-18",
  tasks: [],
  ...p,
})

const item = (p: Partial<GoalPlanItem> = {}): GoalPlanItem => ({
  id: "d1",
  type: "Banner",
  title: "Diwali banners",
  quantity: 8,
  made: 3,
  status: "IN_PROGRESS",
  dueOn: "2026-10-30",
  employeeName: "Riya",
  overdue: false,
  ...p,
})

const team = (items: GoalPlanItem[], p: Partial<GoalPlanTeam> = {}): GoalPlanTeam => ({
  teamId: "t1",
  teamName: "DESIGN",
  managerName: "Meera",
  planned: items.reduce((s, i) => s + i.quantity, 0),
  made: items.reduce((s, i) => s + i.made, 0),
  overdue: items.filter((i) => i.overdue).length,
  unclaimed: items.filter((i) => !i.employeeName).length,
  items,
  ...p,
})

const task = (p: Partial<GoalTaskLink> = {}): GoalTaskLink => ({
  id: "t1",
  title: "Write sale copy",
  status: "TODO",
  dueDate: "2026-10-25",
  overdue: false,
  assigneeName: "Aman",
  producesOutput: false,
  outputs: 0,
  estimatedHours: null,
  outputSkipped: false,
  waitingOn: null,
  ...p,
})

const v = (g: VerdictGoal, plan: GoalPlanTeam[] | undefined = [team([item()])]) =>
  goalVerdict({ goal: g, plan, amName: "Komal", today })

describe("goalVerdict", () => {
  it("has nothing to say about a goal without a number", () => {
    expect(v(goal({ targetValue: null }))).toBeNull()
  })

  it("waits for a period that hasn't started", () => {
    expect(v(goal({ periodStart: "2026-11-01", periodEnd: "2026-11-30" }))?.kind).toBe(
      "NOT_STARTED",
    )
  })

  it("calls a reached number achieved", () => {
    expect(v(goal({ actualValue: 1200 }))?.kind).toBe("ACHIEVED")
    expect(v(goal({ status: "DONE" }))?.kind).toBe("ACHIEVED")
  })

  it("blames the owner and the AM when nothing is planned and it is behind", () => {
    const out = v(goal(), [])!
    expect(out.kind).toBe("NO_PLAN")
    expect(out.responsible.map((r) => r.who)).toEqual(["Diwakar", "Komal"])
  })

  it("lets a part on pace go without a plan", () => {
    expect(v(goal({ actualValue: 800 }), [])?.kind).toBe("ON_TRACK")
  })

  it("flags results not entered for 8 days", () => {
    const out = v(goal({ actualValue: 800, lastResultOn: "2026-10-11" }))!
    expect(out.kind).toBe("NOT_REPORTED")
    expect(out.summary).toMatch(/9 days/)
    expect(v(goal({ actualValue: 800, lastResultOn: "2026-10-13" }))?.kind).toBe("ON_TRACK")
  })

  it("doesn't ask Meta-fed parts to report", () => {
    expect(
      v(goal({ actualSource: "META_PURCHASES", lastResultOn: null, actualValue: 800 }))?.kind,
    ).toBe("ON_TRACK")
  })

  it("judges a closed month as of its last day", () => {
    const closed = goal({
      periodStart: "2026-09-01",
      periodEnd: "2026-09-30",
      lastResultOn: "2026-09-28",
      paceValue: 1200,
      actualValue: 1250,
    })
    expect(v(closed)?.kind).toBe("ACHIEVED")
    expect(v({ ...closed, actualValue: 900 })?.kind).not.toBe("NOT_REPORTED")
  })

  it("puts it on the client when work waits on them", () => {
    const out = v(goal({ tasks: [task({ waitingOn: { id: "r1", title: "Product photos" } })] }))!
    expect(out.kind).toBe("BLOCKED_BY_CLIENT")
    expect(out.responsible[0]).toEqual({
      who: "The client",
      why: "hasn't provided: Product photos",
    })
    expect(out.items[0]).toMatchObject({ kind: "requirement", id: "r1" })
  })

  it("names the person on late work, and the team manager for unclaimed work", () => {
    const out = v(goal(), [
      team([
        item({ overdue: true }),
        item({ id: "d2", title: "Stories", overdue: true, employeeName: null }),
        item({ id: "d3", status: "STUCK" }),
      ]),
    ])!
    expect(out.kind).toBe("OUTPUT_BEHIND")
    expect(out.responsible).toEqual([
      { who: "Riya", why: "2 late on DESIGN work" },
      { who: "Meera", why: "1 DESIGN work nobody has claimed" },
    ])
    expect(out.items.map((i) => i.id)).toEqual(["d1", "d2", "d3"])
  })

  it("counts late linked tasks too", () => {
    const out = v(goal({ tasks: [task({ overdue: true })] }))!
    expect(out.kind).toBe("OUTPUT_BEHIND")
    expect(out.responsible[0]?.who).toBe("Aman")
  })

  it("calls on-time work with a short number an outcome problem", () => {
    const out = v(goal())!
    expect(out.kind).toBe("OUTCOME_SHORT")
    expect(out.summary).toMatch(/274 orders behind pace/)
  })

  it("lets the AM answer for an ownerless part", () => {
    expect(v(goal({ ownerName: null }), [])!.responsible[0]?.who).toBe("Komal (no owner set)")
  })
})

describe("mainGoalVerdict", () => {
  const main = (children: VerdictGoal[], p: Partial<VerdictGoal> = {}) => ({
    ...goal({ id: "main", title: "Monthly orders", targetValue: 3000, actualValue: 1400, ...p }),
    children,
  })

  it("leads with the worst part and lists the troubled ones", () => {
    const out = mainGoalVerdict(
      main([
        goal(),
        goal({ id: "off", title: "Offline", ownerName: null }),
        goal({ id: "pm", title: "Paid", actualValue: 900 }),
      ]),
      { web: [team([item()])], pm: [team([item()])] },
      "Komal",
      today,
    )!
    expect(out.kind).toBe("NO_PLAN")
    expect(out.summary).toBe(
      "2 of 3 parts need attention: Website (results short), Offline (no plan).",
    )
    expect(out.parts?.map((p) => p.verdict.kind)).toEqual(["OUTCOME_SHORT", "NO_PLAN", "ON_TRACK"])
  })

  it("is achieved when the total is reached", () => {
    expect(mainGoalVerdict(main([goal()], { actualValue: 3000 }), {}, "Komal", today)?.kind).toBe(
      "ACHIEVED",
    )
  })

  it("judges a numbered goal with no parts on its own", () => {
    const behind = main([], { paceValue: 1900 })
    expect(mainGoalVerdict(behind, { main: [] }, "Komal", today)?.kind).toBe("NO_PLAN")
  })
})
