import { describe, expect, it, vi } from "vitest"
import type { Session } from "next-auth"

// project-access.ts opens with `import "server-only"`, which throws outside a
// React Server Component, and it pulls in the route guards, which pull in
// next-auth. Both are stubbed so that a POLICY can be unit-tested at all: the
// predicate under test is pure decision-making, and neither the build-time
// guard nor the session machinery has anything to say about it.
vi.mock("server-only", () => ({}))
vi.mock("@/server/api-handler", () => ({ withSession: (h: unknown) => h }))

// The three tables the predicate touches, and nothing else. A fake rather than
// the real client: this is a POLICY test, and the policy is the only thing that
// should be able to fail it.
const state = {
  /** projectId -> the Account Manager's employee id. */
  owners: {} as Record<string, string>,
  /** workbookId -> { projectId, assignedToId } */
  workbooks: {} as Record<string, { projectId: string; assignedToId: string | null }>,
  /** teamId -> { projectId, managerId } */
  teams: {} as Record<string, { projectId: string; managerId: string | null }>,
  /** teamId -> the employees ON that team, its manager included. */
  rosters: {} as Record<string, string[]>,
}

vi.mock("@/server/db", () => ({
  db: {
    project: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.owners[where.id] ? { ownerId: state.owners[where.id] } : null,
    },
    projectWorkbook: {
      findFirst: async ({ where }: { where: { id: string; projectId: string } }) => {
        const w = state.workbooks[where.id]
        // The projectId filter is the point of the query, not decoration: an id
        // from another project must not resolve.
        return w && w.projectId === where.projectId ? { assignedToId: w.assignedToId } : null
      },
    },
    projectTeam: {
      findFirst: async ({
        where,
      }: {
        where: { projectId: string; managerId: string; id?: string }
      }) => {
        const hit = Object.entries(state.teams).find(
          ([id, t]) =>
            t.projectId === where.projectId &&
            t.managerId === where.managerId &&
            (where.id === undefined || where.id === id),
        )
        return hit ? { id: hit[0] } : null
      },
    },
    projectTeamMember: {
      findFirst: async ({
        where,
      }: {
        where: { projectId: string; teamId: string; employeeId: string }
      }) =>
        state.rosters[where.teamId]?.includes(where.employeeId) &&
        state.teams[where.teamId]?.projectId === where.projectId
          ? { id: "m1" }
          : null,
    },
  },
}))

// Nobody in these tests holds the global project:write permission; the ones who
// are allowed are allowed because of who they are ON THIS PROJECT, which is the
// distinction worth testing.
vi.mock("@/lib/permissions", () => ({ hasPermission: () => false }))

import { canContributeToWorkbookTeam, canEditWorkbookTeam } from "./project-access"

const session = (id: string) => ({ user: { id } }) as Session

const PROJECT = "p1"

function setup() {
  state.owners = { [PROJECT]: "account-manager" }
  state.workbooks = {
    sep: { projectId: PROJECT, assignedToId: "calendar-manager" },
    unowned: { projectId: PROJECT, assignedToId: null },
    elsewhere: { projectId: "p2", assignedToId: null },
  }
  state.teams = {
    video: { projectId: PROJECT, managerId: "video-lead" },
    design: { projectId: PROJECT, managerId: "design-lead" },
    web: { projectId: PROJECT, managerId: null },
  }
  state.rosters = {
    video: ["video-lead", "a-videographer"],
    design: ["design-lead", "a-designer"],
    web: [],
  }
}

describe("canEditWorkbookTeam", () => {
  it("lets the Account Manager edit any team's row", async () => {
    setup()
    expect(await canEditWorkbookTeam(session("account-manager"), PROJECT, "sep", "video")).toBe(
      true,
    )
    expect(await canEditWorkbookTeam(session("account-manager"), PROJECT, "sep", "design")).toBe(
      true,
    )
  })

  it("lets the calendar's manager edit any team's row", async () => {
    setup()
    expect(await canEditWorkbookTeam(session("calendar-manager"), PROJECT, "sep", "video")).toBe(
      true,
    )
    expect(await canEditWorkbookTeam(session("calendar-manager"), PROJECT, "sep", "design")).toBe(
      true,
    )
  })

  it("lets a team manager edit THEIR OWN team's row", async () => {
    setup()
    expect(await canEditWorkbookTeam(session("video-lead"), PROJECT, "sep", "video")).toBe(true)
  })

  it("does NOT let a team manager edit another team's row", async () => {
    setup()
    // The whole reason this is not withTeamStaffing: that guard would answer
    // "do they manage any team here", and let the design lead rewrite the video
    // team's deadline.
    expect(await canEditWorkbookTeam(session("design-lead"), PROJECT, "sep", "video")).toBe(false)
  })

  it("refuses somebody who manages nothing", async () => {
    setup()
    expect(await canEditWorkbookTeam(session("a-designer"), PROJECT, "sep", "design")).toBe(false)
  })

  it("asks 'may they edit ANYTHING here' when no team is named", async () => {
    setup()
    // What decides whether the Add team button renders at all.
    expect(await canEditWorkbookTeam(session("video-lead"), PROJECT, "sep")).toBe(true)
    expect(await canEditWorkbookTeam(session("a-designer"), PROJECT, "sep")).toBe(false)
  })

  it("refuses a calendar belonging to another project", async () => {
    setup()
    // Even for the Account Manager of THIS project: the workbook lookup is
    // scoped, so an id from p2 resolves to nothing here. (The AM short-circuit
    // is checked first, so use a team manager to reach the lookup.)
    expect(await canEditWorkbookTeam(session("video-lead"), PROJECT, "elsewhere", "video")).toBe(
      false,
    )
  })

  it("refuses a calendar that does not exist", async () => {
    setup()
    expect(await canEditWorkbookTeam(session("video-lead"), PROJECT, "ghost", "video")).toBe(false)
  })

  it("does not treat an unmanaged calendar as everyone's", async () => {
    setup()
    // assignedToId is null here; a null === null comparison against a missing
    // session id would hand the calendar to nobody in particular.
    expect(await canEditWorkbookTeam(session("a-designer"), PROJECT, "unowned", "design")).toBe(
      false,
    )
    expect(await canEditWorkbookTeam(session("design-lead"), PROJECT, "unowned", "design")).toBe(
      true,
    )
  })
})

describe("canContributeToWorkbookTeam", () => {
  // The split that makes the plan worth putting on the calendar: a plain team
  // member cannot decide what their team owes, but they can record delivering
  // it. Without the second half they would read "DESIGN owes 12 by the 19th"
  // and then have to walk to the Files tab to hand it in.
  it("lets a plain team member hand work in against their own team's row", async () => {
    setup()
    expect(await canContributeToWorkbookTeam(session("a-designer"), PROJECT, "sep", "design")).toBe(
      true,
    )
  })

  it("does NOT let them re-plan that row", async () => {
    setup()
    expect(await canEditWorkbookTeam(session("a-designer"), PROJECT, "sep", "design")).toBe(false)
  })

  it("does not let them hand work in against another team's row", async () => {
    setup()
    expect(await canContributeToWorkbookTeam(session("a-designer"), PROJECT, "sep", "video")).toBe(
      false,
    )
  })

  it("still admits everyone who can plan", async () => {
    setup()
    for (const who of ["account-manager", "calendar-manager", "design-lead"]) {
      expect(await canContributeToWorkbookTeam(session(who), PROJECT, "sep", "design")).toBe(true)
    }
  })

  it("refuses somebody on no team at all", async () => {
    setup()
    expect(await canContributeToWorkbookTeam(session("a-stranger"), PROJECT, "sep", "design")).toBe(
      false,
    )
  })

  it("refuses a calendar from another project", async () => {
    setup()
    expect(
      await canContributeToWorkbookTeam(session("a-designer"), PROJECT, "elsewhere", "design"),
    ).toBe(false)
  })
})
