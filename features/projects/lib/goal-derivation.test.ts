import { describe, expect, it } from "vitest"

import {
  derivedStatus,
  isSlipping,
  summariseGoalRows,
  tallyTarget,
  targetTypeKeys,
  type GoalNode,
  type GoalOutput,
  type GoalOutputMap,
  type GoalRowLite,
  type GoalStatusValue,
} from "./goal-derivation"

// =============================================================================
// The goal maths, pinned.
//
// Every number on the Goals tab and the Progress page comes out of
// summariseGoalRows, and every one of them is an assertion somebody will make
// to a client ("we're 40% of the way through September's reels"). These cases
// are the ones where the arithmetic could plausibly go the other way: weighting
// against averaging, discarded work leaving the denominator but not the output
// tally, targets outranking tasks, and the two thresholds behind "slipping".
// =============================================================================

/** The task-status column's type, so the row factory can build real rows. */
type TaskStatus = GoalRowLite["tasks"][number]["status"]

const D = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`)

/** Fixed "now" for every case, so no test can pass or fail by the calendar. */
const TODAY = D("2026-03-01")

let seq = 0
const uid = (p: string) => `${p}${++seq}`

type TaskSpec =
  | string
  | {
      status: string
      producesOutput?: boolean
      outputSkippedAt?: Date | null
      outputs?: number
      estimatedHours?: number | null
      dueDate?: Date | null
    }

interface TargetSpec {
  type: string
  quantity: number
  /** yyyy-MM-dd, inclusive. */
  from?: string
  to?: string
}

interface RowSpec {
  id?: string
  parentId?: string | null
  status?: GoalStatusValue
  isActive?: boolean
  tasks?: TaskSpec[]
  targets?: TargetSpec[]
  tags?: string[]
  createdAt?: Date
  targetDate?: Date | null
}

/**
 * One goal row in the shape the query returns.
 *
 * Defaults are the boring case - an active, not-started goal created on 1
 * January with no work, no targets and no date - so each test states only the
 * one thing it is about.
 */
function row(spec: RowSpec = {}): GoalRowLite {
  return {
    id: spec.id ?? uid("g"),
    parentId: spec.parentId ?? null,
    title: spec.id ?? "Goal",
    description: null,
    status: spec.status ?? "NOT_STARTED",
    statusReason: null,
    targetDate: spec.targetDate ?? null,
    tags: spec.tags ?? [],
    sortOrder: 0,
    isActive: spec.isActive ?? true,
    createdAt: spec.createdAt ?? D("2026-01-01"),
    createdBy: null,
    owner: null,
    targets: (spec.targets ?? []).map((t) => ({
      id: uid("tg"),
      deliverableType: t.type,
      quantity: t.quantity,
      periodStart: t.from ? D(t.from) : null,
      periodEnd: t.to ? D(t.to) : null,
    })),
    tasks: (spec.tasks ?? []).map((raw, i) => {
      const t = typeof raw === "string" ? { status: raw } : raw
      return {
        id: uid("t"),
        title: `Task ${i + 1}`,
        // The derivation reads task status as plain text (it only ever compares
        // against "DONE" and the dropped set), but the ROW carries Prisma's
        // enum. Asserted rather than widened so a test can still write "TODO".
        status: t.status as TaskStatus,
        dueDate: t.dueDate ?? null,
        producesOutput: t.producesOutput ?? false,
        outputSkippedAt: t.outputSkippedAt ?? null,
        estimatedHours: t.estimatedHours ?? null,
        assignee: null,
        _count: { deliverables: t.outputs ?? 0 },
      }
    }),
  }
}

/** `n` tasks all in the same state - for the rounding cases. */
const many = (n: number, status: string): TaskSpec[] => Array.from({ length: n }, () => status)

const output = (type: string, quantity: number, on = "2026-02-15"): GoalOutput => ({
  typeKey: type.toLowerCase(),
  quantity,
  completedOn: D(on),
})

const outputsFor = (byGoal: Record<string, GoalOutput[]>): GoalOutputMap =>
  new Map(Object.entries(byGoal))

/** Depth-first lookup by id, so a test can assert on a sub-goal. */
function find(goals: GoalNode[], id: string): GoalNode {
  const hit = findOrNull(goals, id)
  if (!hit) throw new Error(`No goal "${id}" in the tree`)
  return hit
}
function findOrNull(goals: GoalNode[], id: string): GoalNode | null {
  for (const g of goals) {
    if (g.id === id) return g
    const hit = findOrNull(g.children, id)
    if (hit) return hit
  }
  return null
}

const summarise = (rows: GoalRowLite[], outputs?: GoalOutputMap) =>
  summariseGoalRows(rows, TODAY, outputs)

// ─────────────────────────────────────────────────────────────────────────────

describe("weighting", () => {
  it("weights a sub-goal by the work under it, not by one tick", () => {
    const s = summarise([
      row({ id: "P" }),
      row({ id: "A", parentId: "P", tasks: ["DONE", "DONE", "TODO"] }),
      row({ id: "B", parentId: "P", tasks: ["TODO"] }),
    ])

    const a = find(s.goals, "A")
    expect(a.weight).toBe(3)
    expect(a.doneWeight).toBeCloseTo(2)
    expect(a.progress).toBe(67)

    const b = find(s.goals, "B")
    expect(b.weight).toBe(1)
    expect(b.doneWeight).toBe(0)
    expect(b.progress).toBe(0)

    const p = find(s.goals, "P")
    expect(p.countableChildren).toBe(4)
    expect(p.progress).toBe(50)
    expect(p.status).toBe("IN_PROGRESS")
  })

  it("counts a parent's own tasks alongside its sub-goals' work", () => {
    const s = summarise([
      row({ id: "P", tasks: ["DONE"] }),
      row({ id: "A", parentId: "P", tasks: ["TODO", "TODO"] }),
    ])

    const p = find(s.goals, "P")
    expect(p.countableChildren).toBe(3)
    expect(p.doneWeight).toBeCloseTo(1)
    expect(p.progress).toBe(33)
  })

  it("drops a discarded sub-goal out of the denominator entirely", () => {
    const s = summarise([
      row({ id: "P" }),
      row({ id: "A", parentId: "P", status: "DISCARDED", tasks: ["TODO"] }),
      row({ id: "B", parentId: "P", tasks: ["DONE"] }),
    ])

    const p = find(s.goals, "P")
    expect(p.countableChildren).toBe(1)
    expect(p.progress).toBe(100)
    expect(p.status).toBe("DONE")
  })

  it("gives a manual leaf a weight of one, as it always had", () => {
    const s = summarise([
      row({ id: "P" }),
      row({ id: "A", parentId: "P", status: "DONE" }),
      row({ id: "B", parentId: "P", status: "NOT_STARTED" }),
    ])

    const a = find(s.goals, "A")
    expect(a.weight).toBe(1)
    expect(a.doneWeight).toBe(1)
    expect(find(s.goals, "P").progress).toBe(50)
  })

  it("reserves 100 for finished: 249 of 250 shows 99", () => {
    const s = summarise([row({ id: "P", tasks: [...many(249, "DONE"), "TODO"] })])
    const p = find(s.goals, "P")
    expect(p.progress).toBe(99)
    expect(p.status).toBe("IN_PROGRESS")
  })

  it("reports 0 rather than dividing by zero when every task was dropped", () => {
    const s = summarise([row({ id: "P", tasks: ["DISCARDED", "CANCELLED"] })])
    const p = find(s.goals, "P")
    expect(p.countableChildren).toBe(0)
    expect(p.progressIsDerived).toBe(true)
    expect(p.progress).toBe(0)
    // Nothing countable left to derive from, so the stored flag stands.
    expect(p.status).toBe("NOT_STARTED")
  })
})

describe("targets", () => {
  it("measures a goal by its output when it has a target", () => {
    const s = summarise(
      [row({ id: "P", targets: [{ type: "reel", quantity: 10 }] })],
      outputsFor({ P: [output("reel", 4)] }),
    )
    const p = find(s.goals, "P")
    expect(p.outcomeProgress).toBe(40)
    expect(p.progress).toBe(40)
    expect(p.taskProgress).toBeNull()
    expect(p.status).toBe("IN_PROGRESS")
  })

  it("caps over-delivery at 100 and calls the goal done", () => {
    const s = summarise(
      [row({ id: "P", targets: [{ type: "reel", quantity: 10 }] })],
      outputsFor({ P: [output("reel", 12)] }),
    )
    const p = find(s.goals, "P")
    expect(p.targets[0]!.made).toBe(12)
    expect(p.targets[0]!.met).toBe(true)
    expect(p.progress).toBe(100)
    expect(p.status).toBe("DONE")
  })

  it("counts only what landed inside the target's period", () => {
    const s = summarise(
      [
        row({
          id: "P",
          targets: [{ type: "reel", quantity: 10, from: "2026-02-01", to: "2026-02-28" }],
        }),
      ],
      outputsFor({ P: [output("reel", 5, "2026-02-10"), output("reel", 5, "2026-03-01")] }),
    )
    expect(find(s.goals, "P").targets[0]!.made).toBe(5)
  })

  it("matches the type case-insensitively and ignores every other type", () => {
    const s = summarise(
      [row({ id: "P", targets: [{ type: "Reel", quantity: 2 }] })],
      outputsFor({ P: [output("reel", 1), output("video", 5)] }),
    )
    expect(find(s.goals, "P").targets[0]!.made).toBe(1)
  })

  it("lets the target outrank finished tasks", () => {
    const s = summarise(
      [row({ id: "P", tasks: ["DONE", "DONE"], targets: [{ type: "reel", quantity: 5 }] })],
      outputsFor({}),
    )
    const p = find(s.goals, "P")
    expect(p.progress).toBe(0)
    expect(p.taskProgress).toBe(100)
    expect(p.status).toBe("IN_PROGRESS")
  })

  it("tallies a parent's target over its whole subtree, discarded branches included", () => {
    const s = summarise(
      [
        row({ id: "P", targets: [{ type: "reel", quantity: 10 }] }),
        row({ id: "A", parentId: "P" }),
        row({ id: "B", parentId: "P", status: "DISCARDED" }),
      ],
      outputsFor({ A: [output("reel", 6)], B: [output("reel", 4)] }),
    )
    const target = find(s.goals, "P").targets[0]!
    expect(target.made).toBe(10)
    expect(target.met).toBe(true)
  })

  it("reaches a parent through the sub-goal's weight, not a second tally", () => {
    const s = summarise(
      [
        row({ id: "P" }),
        row({ id: "A", parentId: "P", targets: [{ type: "reel", quantity: 10 }] }),
      ],
      outputsFor({ A: [output("reel", 5)] }),
    )
    const a = find(s.goals, "A")
    expect(a.weight).toBe(1)
    expect(a.doneWeight).toBeCloseTo(0.5)

    const p = find(s.goals, "P")
    expect(p.progress).toBe(50)
    // The sub-goal's target is not a target OF the parent.
    expect(p.outcomeProgress).toBeNull()
  })

  it("averages several targets on one goal", () => {
    const s = summarise(
      [
        row({
          id: "P",
          targets: [
            { type: "reel", quantity: 10 },
            { type: "video", quantity: 2 },
          ],
        }),
      ],
      outputsFor({ P: [output("reel", 10)] }),
    )
    expect(find(s.goals, "P").outcomeProgress).toBe(50)
  })

  it("keeps one shared output map from leaking between projects", () => {
    const outputs = outputsFor({ p1g: [output("reel", 3)], p2g: [output("reel", 9)] })
    const one = summarise([row({ id: "p1g", targets: [{ type: "reel", quantity: 10 }] })], outputs)
    const two = summarise([row({ id: "p2g", targets: [{ type: "reel", quantity: 10 }] })], outputs)

    expect(find(one.goals, "p1g").targets[0]!.made).toBe(3)
    expect(find(two.goals, "p2g").targets[0]!.made).toBe(9)
  })
})

describe("tallyTarget", () => {
  it("is inclusive on both ends of the period", () => {
    const t = {
      typeKey: "reel",
      quantity: 4,
      periodStart: D("2026-02-01"),
      periodEnd: D("2026-02-28"),
    }
    const made = tallyTarget(t, [
      output("reel", 1, "2026-01-31"),
      output("reel", 1, "2026-02-01"),
      output("reel", 1, "2026-02-28"),
      output("reel", 1, "2026-03-01"),
    ])
    expect(made.made).toBe(2)
    expect(made.ratio).toBeCloseTo(0.5)
    expect(made.met).toBe(false)
  })
})

describe("targetTypeKeys", () => {
  it("returns the distinct case-folded types", () => {
    expect(
      targetTypeKeys([
        { targets: [{ deliverableType: "Reel" }, { deliverableType: "reel " }] },
        { targets: [{ deliverableType: "Video" }] },
      ]),
    ).toEqual(["reel", "video"])
  })
})

describe("derivedStatus", () => {
  it("releases a stored AT_RISK once everything under it is done", () => {
    expect(derivedStatus("AT_RISK", [], [{ status: "DONE" }], [])).toBe("DONE")
  })

  it("counts a part-delivered target as started", () => {
    expect(derivedStatus("NOT_STARTED", [], [{ status: "TODO" }], [{ made: 1, met: false }])).toBe(
      "IN_PROGRESS",
    )
  })
})

describe("isSlipping", () => {
  const base = {
    status: "IN_PROGRESS" as GoalStatusValue,
    isActive: true,
    measurable: true,
    createdAt: D("2026-01-01"),
    today: TODAY,
  }

  it("flags a goal a quarter behind its runway", () => {
    expect(isSlipping({ ...base, ratio: 0.2, targetDate: D("2026-04-30") })).toBe(true)
  })

  it("leaves a goal only a fifth behind alone", () => {
    expect(isSlipping({ ...base, ratio: 0.3, targetDate: D("2026-04-30") })).toBe(false)
  })

  it("flags anything under three-quarters inside the last week", () => {
    expect(isSlipping({ ...base, ratio: 0.7, targetDate: D("2026-03-06") })).toBe(true)
    expect(isSlipping({ ...base, ratio: 0.75, targetDate: D("2026-03-06") })).toBe(false)
  })
})

describe("slipping, on the tree", () => {
  it("says overdue rather than slipping once the date has passed", () => {
    const s = summarise([row({ id: "P", tasks: ["TODO"], targetDate: D("2026-02-01") })])
    const p = find(s.goals, "P")
    expect(p.overdue).toBe(true)
    expect(p.slipping).toBe(false)
  })

  it("never flags a manual leaf, however much of its runway is gone", () => {
    const s = summarise([row({ id: "P", targetDate: D("2026-03-08") })])
    const p = find(s.goals, "P")
    expect(p.progress).toBe(0)
    expect(p.slipping).toBe(false)
  })

  it("never flags a discarded goal", () => {
    const s = summarise([
      row({ id: "P", status: "DISCARDED", tasks: ["TODO"], targetDate: D("2026-03-02") }),
    ])
    expect(find(s.goals, "P").slipping).toBe(false)
    expect(s.slippingGoals).toBe(0)
  })

  it("counts slipping and at-risk goals across the whole board", () => {
    const s = summarise([
      row({ id: "P", tasks: ["TODO", "TODO"], targetDate: D("2026-04-30") }),
      row({ id: "Q", status: "AT_RISK", tasks: ["TODO"] }),
    ])
    expect(find(s.goals, "P").slipping).toBe(true)
    expect(s.slippingGoals).toBe(1)
    expect(s.atRiskGoals).toBe(1)
  })
})

describe("output skipping", () => {
  it("marks a task whose owner said there was nothing to log", () => {
    const s = summarise([
      row({
        id: "P",
        tasks: [
          { status: "DONE", producesOutput: true, outputSkippedAt: D("2026-02-20"), outputs: 0 },
          { status: "DONE", producesOutput: true, outputs: 0 },
        ],
      }),
    ])
    const tasks = find(s.goals, "P").tasks
    expect(tasks[0]!.outputSkipped).toBe(true)
    // The one nobody answered for still reads as missing its output.
    expect(tasks[1]!.outputSkipped).toBe(false)
    expect(
      tasks.filter((t) => t.producesOutput && t.outputs === 0 && !t.outputSkipped),
    ).toHaveLength(1)
  })
})
