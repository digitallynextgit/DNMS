import { describe, expect, it, vi } from "vitest"
import type { Session } from "next-auth"

// Stub server-only and the route guards (next-auth) so the policy can be unit-tested.
vi.mock("server-only", () => ({}))
vi.mock("@/server/api-handler", () => ({ withSession: (h: unknown) => h }))

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
        // The projectId filter matters: an id from another project must not resolve.
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

// Nobody has project:write here; access comes from their role on this project.
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
    // Unlike withTeamStaffing, managing some team here is not enough to edit another team's row.
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
    // The workbook lookup is project-scoped, so an id from p2 resolves to nothing here.
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
    // assignedToId is null; null === null must not hand the calendar to a session with no id.
    expect(await canEditWorkbookTeam(session("a-designer"), PROJECT, "unowned", "design")).toBe(
      false,
    )
    expect(await canEditWorkbookTeam(session("design-lead"), PROJECT, "unowned", "design")).toBe(
      true,
    )
  })
})

describe("canContributeToWorkbookTeam", () => {
  // A plain member can't change what the team owes, but can record delivering it.
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
