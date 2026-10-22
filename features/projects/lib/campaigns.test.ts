import { describe, expect, it } from "vitest"

import {
  campaignDatesProblem,
  campaignTiming,
  campaignTimingLabel,
  planProgress,
  reminderStage,
} from "./campaigns"

const halloween = { startDate: "2026-10-15", deadline: "2026-10-31" }

describe("campaignTiming", () => {
  it("is upcoming, live or ended around its dates", () => {
    expect(campaignTiming(halloween, "2026-10-10")).toEqual({ state: "UPCOMING", days: 5 })
    expect(campaignTiming(halloween, "2026-10-15")).toEqual({ state: "LIVE", days: 16 })
    expect(campaignTiming(halloween, "2026-10-31")).toEqual({ state: "LIVE", days: 0 })
    expect(campaignTiming(halloween, "2026-11-02")).toEqual({ state: "ENDED", days: 2 })
  })
  it("reads in plain words", () => {
    expect(campaignTimingLabel({ state: "UPCOMING", days: 1 })).toBe("Starts tomorrow")
    expect(campaignTimingLabel({ state: "LIVE", days: 0 })).toBe("Live - last day")
    expect(campaignTimingLabel({ state: "LIVE", days: 9 })).toBe("Live - 9 days left")
    expect(campaignTimingLabel({ state: "ENDED", days: 3 })).toBe("Ended 3 days ago")
  })
  it("refuses a deadline before the start", () => {
    expect(campaignDatesProblem("2026-10-15", "2026-10-14")).toMatch(/before the start/)
    expect(campaignDatesProblem("2026-10-15", "2026-10-15")).toBeNull()
  })
})

describe("planProgress", () => {
  it("counts done out of owed, leaving dropped plans out", () => {
    const today = "2026-10-20"
    expect(
      planProgress(
        [
          { status: "DONE", dueOn: "2026-10-18" },
          { status: "IN_PROGRESS", dueOn: "2026-10-19" },
          { status: "STUCK", dueOn: "2026-10-25" },
          { status: "DISCARDED", dueOn: "2026-10-10" },
          { status: "TODO", dueOn: null },
        ],
        today,
      ),
    ).toEqual({ total: 4, done: 1, stuck: 1, overdue: 1 })
  })
})

describe("reminderStage", () => {
  const today = "2026-10-20"
  it("reminds 3 days ahead, on the day and once late", () => {
    expect(reminderStage({ status: "TODO", dueOn: "2026-10-24" }, today)).toBeNull()
    expect(reminderStage({ status: "TODO", dueOn: "2026-10-23" }, today)).toBe("SOON")
    expect(reminderStage({ status: "IN_PROGRESS", dueOn: "2026-10-21" }, today)).toBe("SOON")
    expect(reminderStage({ status: "STUCK", dueOn: today }, today)).toBe("DUE")
    expect(reminderStage({ status: "TODO", dueOn: "2026-10-19" }, today)).toBe("OVERDUE")
  })
  it("never reminds about finished, dropped or undated work", () => {
    expect(reminderStage({ status: "DONE", dueOn: "2026-10-19" }, today)).toBeNull()
    expect(reminderStage({ status: "DISCARDED", dueOn: today }, today)).toBeNull()
    expect(reminderStage({ status: "TODO", dueOn: null }, today)).toBeNull()
  })
})
