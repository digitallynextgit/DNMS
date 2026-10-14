import { describe, expect, it } from "vitest"

import { calendarProgress, dueSoon } from "./employee-work"

const row = (over: Partial<Parameters<typeof calendarProgress>[0][number]> = {}) => ({
  quantity: 10,
  status: "IN_PROGRESS",
  dueOn: null as string | null,
  links: [] as unknown[],
  attachments: 0,
  ...over,
})

describe("calendarProgress", () => {
  it("adds up what is owed and handed in, never counting more than a team promised", () => {
    const p = calendarProgress([
      row({ quantity: 10, links: ["a", "b"], attachments: 1 }),
      row({ quantity: 2, links: ["a", "b", "c"], status: "DONE" }),
    ])
    expect(p).toEqual({ teams: 2, teamsDone: 1, quantity: 12, handedIn: 5, nextDue: null })
  })

  it("leaves Discarded teams out and finds the earliest due date still open", () => {
    const p = calendarProgress([
      row({ dueOn: "2026-10-28" }),
      row({ dueOn: "2026-10-20", status: "DONE" }),
      row({ dueOn: "2026-10-22" }),
      row({ dueOn: "2026-10-01", status: "DISCARDED" }),
    ])
    expect(p.teams).toBe(3)
    expect(p.nextDue).toBe("2026-10-22")
  })
})

describe("dueSoon", () => {
  it("counts open work due within a week, or late", () => {
    expect(dueSoon({ status: "TODO", dueOn: "2026-10-15" }, "2026-10-09")).toBe(true)
    expect(dueSoon({ status: "TODO", dueOn: "2026-10-01" }, "2026-10-09")).toBe(true)
    expect(dueSoon({ status: "TODO", dueOn: "2026-10-20" }, "2026-10-09")).toBe(false)
    expect(dueSoon({ status: "DONE", dueOn: "2026-10-10" }, "2026-10-09")).toBe(false)
    expect(dueSoon({ status: "TODO", dueOn: null }, "2026-10-09")).toBe(false)
  })
})
