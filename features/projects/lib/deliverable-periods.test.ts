import { describe, expect, it } from "vitest"

import type { DeliverableStatus } from "./deliverable-lifecycle"
import {
  UNPLANNED_KEY,
  UNPLANNED_LABEL,
  derivePeriodStatus,
  groupIntoPeriods,
  NO_TEAM_KEY,
  pctMade,
  periodKeyFromSlug,
  periodSlug,
  splitByTeam,
  unitsByStatus,
  type PeriodRowLike,
} from "./deliverable-periods"

describe("periodSlug / periodKeyFromSlug", () => {
  it("round-trips a window", () => {
    const key = "2026-09-07..2026-09-11"
    expect(periodSlug(key)).toBe("2026-09-07_2026-09-11")
    expect(periodKeyFromSlug(periodSlug(key))).toBe(key)
  })

  it("round-trips the unplanned bucket", () => {
    expect(periodSlug(UNPLANNED_KEY)).toBe("unplanned")
    expect(periodKeyFromSlug("unplanned")).toBe(UNPLANNED_KEY)
  })

  it("refuses anything that is not a slug it produced", () => {
    for (const bad of [
      "",
      "2026-09-07",
      "2026-09-07_",
      "_2026-09-11",
      "2026-09-07_2026-09-11_x",
      "07-09-2026_11-09-2026",
      "2026-09-11_2026-09-07", // backwards
      "..",
      "unplanned_",
    ]) {
      expect(periodKeyFromSlug(bad), bad).toBeNull()
    }
  })
})

const row = (
  status: DeliverableStatus,
  o: Partial<PeriodRowLike> & { qty?: number } = {},
): PeriodRowLike => ({
  periodStart: o.periodStart === undefined ? "2026-09-07" : o.periodStart,
  periodEnd: o.periodEnd === undefined ? "2026-09-11" : o.periodEnd,
  status,
  quantity: o.qty ?? 1,
  // Made rows are fully made unless a test says otherwise - that is what the
  // migration back-filled, so it is the state the app actually holds.
  deliveredQuantity:
    o.deliveredQuantity ?? (status === "DELIVERED" || status === "ACCEPTED" ? (o.qty ?? 1) : 0),
  team: o.team === undefined ? { id: "web", name: "WEB" } : o.team,
})

const TODAY = "2026-09-09" // mid-week, inside 7-11 Sep

describe("derivePeriodStatus", () => {
  it("an empty set is owed - there is nothing else it could be", () => {
    expect(derivePeriodStatus([])).toBe("PLANNED")
  })

  it("untouched work is owed", () => {
    expect(derivePeriodStatus(["PLANNED", "PLANNED"])).toBe("PLANNED")
  })

  it("one piece started makes the whole period in progress", () => {
    expect(derivePeriodStatus(["PLANNED", "IN_PROGRESS"])).toBe("IN_PROGRESS")
  })

  it("some made, some not, is still in progress - not delivered", () => {
    // The client was promised the week, not half of it.
    expect(derivePeriodStatus(["DELIVERED", "PLANNED"])).toBe("IN_PROGRESS")
    expect(derivePeriodStatus(["ACCEPTED", "PLANNED"])).toBe("IN_PROGRESS")
  })

  it("everything at least made is delivered", () => {
    expect(derivePeriodStatus(["DELIVERED", "DELIVERED"])).toBe("DELIVERED")
    expect(derivePeriodStatus(["DELIVERED", "ACCEPTED"])).toBe("DELIVERED")
  })

  it("everything accepted is accepted", () => {
    expect(derivePeriodStatus(["ACCEPTED", "ACCEPTED"])).toBe("ACCEPTED")
  })

  it("one rejection outranks everything, including acceptances", () => {
    // The one state waiting on the team must not hide behind a green pill.
    expect(derivePeriodStatus(["ACCEPTED", "ACCEPTED", "REJECTED"])).toBe("REJECTED")
    expect(derivePeriodStatus(["PLANNED", "REJECTED"])).toBe("REJECTED")
  })
})

describe("groupIntoPeriods", () => {
  it("folds rows sharing a window into one period, named by the window", () => {
    const out = groupIntoPeriods([row("PLANNED"), row("PLANNED")], TODAY)
    expect(out).toHaveLength(1)
    expect(out[0]!.key).toBe("2026-09-07..2026-09-11")
    expect(out[0]!.label).toBe("7-11 Sep 2026")
    expect(out[0]!.rows).toHaveLength(2)
  })

  it("names a single-day period by the day and a whole month by the month", () => {
    const [d] = groupIntoPeriods(
      [row("PLANNED", { periodStart: "2026-09-10", periodEnd: "2026-09-10" })],
      TODAY,
    )
    expect(d!.label).toBe("10 Sep 2026")
    const [m] = groupIntoPeriods(
      [row("PLANNED", { periodStart: "2026-09-01", periodEnd: "2026-09-30" })],
      TODAY,
    )
    expect(m!.label).toBe("Sep 2026")
  })

  it("counts units, not rows, and only made units toward made", () => {
    const [p] = groupIntoPeriods(
      [row("PLANNED", { qty: 4 }), row("DELIVERED", { qty: 2 }), row("ACCEPTED", { qty: 1 })],
      TODAY,
    )
    expect(p!.planned).toBe(7)
    expect(p!.made).toBe(3)
  })

  it("lists each team once, in the order first seen", () => {
    const [p] = groupIntoPeriods(
      [
        row("PLANNED", { team: { id: "web", name: "WEB" } }),
        row("PLANNED", { team: { id: "video", name: "VIDEO" } }),
        row("PLANNED", { team: { id: "web", name: "WEB" } }),
      ],
      TODAY,
    )
    expect(p!.teams).toEqual(["WEB", "VIDEO"])
  })

  it("rolls status up from the rows", () => {
    const [p] = groupIntoPeriods([row("DELIVERED"), row("REJECTED")], TODAY)
    expect(p!.status).toBe("REJECTED")
  })

  it("is overdue only once the window has closed with something unmade", () => {
    const closed = { periodStart: "2026-08-31", periodEnd: "2026-09-04" }
    expect(groupIntoPeriods([row("PLANNED", closed)], TODAY)[0]!.overdue).toBe(true)
    expect(groupIntoPeriods([row("IN_PROGRESS", closed)], TODAY)[0]!.overdue).toBe(true)
    // Made in time, or the window still open: not overdue.
    expect(groupIntoPeriods([row("DELIVERED", closed)], TODAY)[0]!.overdue).toBe(false)
    expect(groupIntoPeriods([row("PLANNED")], TODAY)[0]!.overdue).toBe(false)
  })

  it("the last day of the window is not yet overdue", () => {
    const p = groupIntoPeriods([row("PLANNED")], "2026-09-11")[0]!
    expect(p.overdue).toBe(false)
  })

  it("puts newest window first", () => {
    const out = groupIntoPeriods(
      [
        row("PLANNED", { periodStart: "2026-09-07", periodEnd: "2026-09-11" }),
        row("PLANNED", { periodStart: "2026-09-14", periodEnd: "2026-09-18" }),
      ],
      TODAY,
    )
    expect(out.map((p) => p.label)).toEqual(["14-18 Sep 2026", "7-11 Sep 2026"])
  })

  it("gathers rows with no window under one unplanned bucket, last", () => {
    const out = groupIntoPeriods(
      [
        row("DELIVERED", { periodStart: null, periodEnd: null }),
        row("PLANNED"),
        row("DELIVERED", { periodStart: null, periodEnd: null }),
      ],
      TODAY,
    )
    expect(out).toHaveLength(2)
    expect(out[0]!.label).toBe("7-11 Sep 2026")
    expect(out[1]!.key).toBe(UNPLANNED_KEY)
    expect(out[1]!.label).toBe(UNPLANNED_LABEL)
    expect(out[1]!.rows).toHaveLength(2)
    // No window means nothing to be overdue against.
    expect(out[1]!.overdue).toBe(false)
  })

  it("does not mutate its input", () => {
    const rows = [row("PLANNED")]
    const before = JSON.stringify(rows)
    groupIntoPeriods(rows, TODAY)
    expect(JSON.stringify(rows)).toBe(before)
  })
})

describe("unitsByStatus", () => {
  it("returns all five statuses in reading order, zeroes included", () => {
    const out = unitsByStatus([row("PLANNED")])
    expect(out.map((s) => s.status)).toEqual([
      "PLANNED",
      "IN_PROGRESS",
      "DELIVERED",
      "ACCEPTED",
      "REJECTED",
    ])
    expect(out.filter((s) => s.units > 0)).toHaveLength(1)
  })

  it("counts units and items separately", () => {
    // Four units on one item is not four items of work to look at.
    const out = unitsByStatus([row("PLANNED", { qty: 4 }), row("PLANNED", { qty: 2 })])
    const planned = out.find((s) => s.status === "PLANNED")!
    expect(planned.units).toBe(6)
    expect(planned.items).toBe(2)
  })

  it("keeps each status apart", () => {
    const out = unitsByStatus([
      row("PLANNED", { qty: 3 }),
      row("DELIVERED", { qty: 2 }),
      row("REJECTED"),
    ])
    const at = (s: DeliverableStatus) => out.find((x) => x.status === s)!.units
    expect([at("PLANNED"), at("DELIVERED"), at("REJECTED"), at("ACCEPTED")]).toEqual([3, 2, 1, 0])
  })
})

describe("splitByTeam", () => {
  const web = { id: "web", name: "WEB" }
  const video = { id: "video", name: "VIDEO" }

  it("splits in the order the teams first appear", () => {
    const out = splitByTeam([
      row("PLANNED", { team: video }),
      row("PLANNED", { team: web }),
      row("PLANNED", { team: video }),
    ])
    expect(out.map((t) => t.name)).toEqual(["VIDEO", "WEB"])
    expect(out[0]!.rows).toHaveLength(2)
  })

  it("totals units and made per team, not across them", () => {
    const out = splitByTeam([
      row("DELIVERED", { team: web, qty: 2 }),
      row("PLANNED", { team: web, qty: 2 }),
      row("PLANNED", { team: video, qty: 5 }),
    ])
    const byName = Object.fromEntries(out.map((t) => [t.name, t]))
    expect(byName.WEB).toMatchObject({ planned: 4, made: 2, status: "IN_PROGRESS" })
    expect(byName.VIDEO).toMatchObject({ planned: 5, made: 0, status: "PLANNED" })
  })

  it("files a line with no team under one bucket rather than dropping it", () => {
    const out = splitByTeam([row("DELIVERED", { team: null })])
    expect(out).toHaveLength(1)
    expect(out[0]!.key).toBe(NO_TEAM_KEY)
    expect(out[0]!.name).toBe("No team")
  })

  it("does not mutate its input", () => {
    const rows = [row("PLANNED", { team: web })]
    const before = JSON.stringify(rows)
    splitByTeam(rows)
    expect(JSON.stringify(rows)).toBe(before)
  })
})

describe("pctMade", () => {
  it("rounds to whole percents", () => {
    expect(pctMade(6, 2)).toBe(33)
    expect(pctMade(3, 1)).toBe(33)
    expect(pctMade(8, 7)).toBe(88)
  })

  it("is 0 when nothing was planned, never NaN", () => {
    expect(pctMade(0, 0)).toBe(0)
  })

  it("is 100 only when everything landed", () => {
    expect(pctMade(4, 4)).toBe(100)
    expect(pctMade(4, 3)).toBe(75)
  })
})

describe("progress counts part-finished work", () => {
  it("counts units made on a row that is still in progress", () => {
    // One blog of four written. The week is 25% done, not 0%.
    const [p] = groupIntoPeriods(
      [row("IN_PROGRESS", { qty: 4, deliveredQuantity: 1 })],
      "2026-09-09",
    )
    expect(p!.planned).toBe(4)
    expect(p!.made).toBe(1)
    expect(p!.status).toBe("IN_PROGRESS")
  })

  it("still counts a delivered row whole", () => {
    const [p] = groupIntoPeriods([row("DELIVERED", { qty: 4 })], "2026-09-09")
    expect(p!.made).toBe(4)
  })

  it("never counts more than was promised", () => {
    // The promise can be edited down after work was logged against it.
    const [p] = groupIntoPeriods(
      [row("IN_PROGRESS", { qty: 2, deliveredQuantity: 5 })],
      "2026-09-09",
    )
    expect(p!.made).toBe(2)
  })

  it("splits part-finished progress by team", () => {
    const out = splitByTeam([
      row("IN_PROGRESS", { qty: 4, deliveredQuantity: 3, team: { id: "web", name: "WEB" } }),
      row("PLANNED", { qty: 2, team: { id: "video", name: "VIDEO" } }),
    ])
    const byName = Object.fromEntries(out.map((t) => [t.name, t]))
    expect(byName.WEB).toMatchObject({ planned: 4, made: 3 })
    expect(byName.VIDEO).toMatchObject({ planned: 2, made: 0 })
  })

  it("an overdue window is still overdue with part of it made", () => {
    const p = groupIntoPeriods(
      [
        row("IN_PROGRESS", {
          qty: 4,
          deliveredQuantity: 3,
          periodStart: "2026-08-31",
          periodEnd: "2026-09-04",
        }),
      ],
      "2026-09-09",
    )[0]!
    expect(p.overdue).toBe(true)
  })
})
