import { describe, expect, it, vi } from "vitest"

// The module reaches for the real Prisma client only as a default; the tests
// hand in a fake, so keep the real one from being constructed.
vi.mock("@/server/db", () => ({ db: {} }))

import { ensureProjectTeams } from "./project-teams"

type Team = {
  id: string
  tenantId: string
  projectId: string
  name: string
  managerId: string | null
}
type Member = { id: string; projectId: string; employeeId: string }

type Client = NonNullable<Parameters<typeof ensureProjectTeams>[1]>["client"]

/** Just enough of Prisma for ensureProjectTeams: the four calls it makes. */
function fakeClient(state: { teams: Team[]; members: Member[]; active: Record<string, boolean> }) {
  const { teams, members, active } = state
  let n = 0
  const client = {
    project: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id.startsWith("missing") ? null : { tenantId: "t1" },
    },
    projectTeam: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        if ("name" in where) {
          const notProject = (where.projectId as { not: string }).not
          return teams
            .filter(
              (t) =>
                t.tenantId === where.tenantId &&
                t.name === where.name &&
                t.projectId !== notProject &&
                t.managerId !== null &&
                active[t.managerId] === true,
            )
            .map((t) => ({ managerId: t.managerId }))
        }
        return teams.filter((t) => t.projectId === where.projectId).map((t) => ({ name: t.name }))
      },
      create: async ({
        data,
      }: {
        data: {
          projectId: string
          name: string
          managerId: string | null
          members?: { create: { projectId: string; employeeId: string } }
        }
      }) => {
        n += 1
        const team: Team = {
          id: `team-${n}`,
          tenantId: "t1",
          projectId: data.projectId,
          name: data.name,
          managerId: data.managerId,
        }
        teams.push(team)
        if (data.members) {
          members.push({
            id: `m-${n}`,
            projectId: data.members.create.projectId,
            employeeId: data.members.create.employeeId,
          })
        }
        return team
      },
    },
    projectTeamMember: {
      findFirst: async ({ where }: { where: { projectId: string; employeeId: string } }) =>
        members.find((m) => m.projectId === where.projectId && m.employeeId === where.employeeId) ??
        null,
    },
  }
  return client as unknown as Client
}

const team = (projectId: string, name: string, managerId: string | null): Team => ({
  id: `${projectId}-${name}`,
  tenantId: "t1",
  projectId,
  name,
  managerId,
})

const everyoneActive = {
  diwakar: true,
  hemant: true,
  aashutosh: true,
  dev: true,
  teesha: true,
  manpreet: true,
}

/** Two fully staffed projects - the precedent a new project copies. */
function precedent(): Team[] {
  const rows: Team[] = []
  for (const p of ["p1", "p2"]) {
    rows.push(
      team(p, "WEB", "diwakar"),
      team(p, "DESIGN", "hemant"),
      team(p, "MAP", "aashutosh"),
      team(p, "VIDEO", "dev"),
      team(p, "AMG/SMO", "teesha"),
      team(p, "ADMIN", "manpreet"),
    )
  }
  return rows
}

describe("ensureProjectTeams", () => {
  it("gives a bare project all six teams, staffed the way the other projects are", async () => {
    const teams = precedent()
    const members: Member[] = []
    const client = fakeClient({ teams, members, active: everyoneActive })

    const created = await ensureProjectTeams("p3", { client })

    expect(created.map((c) => c.name)).toEqual([
      "WEB",
      "DESIGN",
      "MAP",
      "VIDEO",
      "AMG/SMO",
      "ADMIN",
    ])
    expect(Object.fromEntries(created.map((c) => [c.name, c.managerId]))).toEqual({
      WEB: "diwakar",
      DESIGN: "hemant",
      MAP: "aashutosh",
      VIDEO: "dev",
      "AMG/SMO": "teesha",
      ADMIN: "manpreet",
    })
    // each manager is seated as the team's first member
    expect(
      members
        .filter((m) => m.projectId === "p3")
        .map((m) => m.employeeId)
        .sort(),
    ).toEqual(["aashutosh", "dev", "diwakar", "hemant", "manpreet", "teesha"])
  })

  it("is idempotent - a fully set-up project gets nothing new", async () => {
    const teams = precedent()
    const client = fakeClient({ teams, members: [], active: everyoneActive })

    const created = await ensureProjectTeams("p1", { client })

    expect(created).toEqual([])
    expect(teams).toHaveLength(12)
  })

  it("adds only the missing teams and leaves existing ones alone", async () => {
    const teams = [...precedent(), team("p3", "WEB", "diwakar"), team("p3", "VIDEO", null)]
    const client = fakeClient({ teams, members: [], active: everyoneActive })

    const created = await ensureProjectTeams("p3", { client })

    expect(created.map((c) => c.name)).toEqual(["DESIGN", "MAP", "AMG/SMO", "ADMIN"])
    // the unmanaged VIDEO team was not "fixed" - existing teams are not touched
    expect(teams.find((t) => t.id === "p3-VIDEO")?.managerId).toBeNull()
  })

  it("pins a manager when told to, even with no precedent for that team", async () => {
    const teams = precedent().filter((t) => t.name !== "ADMIN")
    const members: Member[] = []
    const client = fakeClient({ teams, members, active: everyoneActive })

    const created = await ensureProjectTeams("p3", { client, managers: { ADMIN: "manpreet" } })

    expect(created.find((c) => c.name === "ADMIN")?.managerId).toBe("manpreet")
    expect(members.some((m) => m.projectId === "p3" && m.employeeId === "manpreet")).toBe(true)
  })

  it("starts a team unstaffed when its usual manager already sits on another team of that project", async () => {
    const teams = [...precedent(), team("p3", "WEB", "teesha")]
    const members: Member[] = [{ id: "m0", projectId: "p3", employeeId: "teesha" }]
    const client = fakeClient({ teams, members, active: everyoneActive })

    const created = await ensureProjectTeams("p3", { client })

    expect(created.find((c) => c.name === "AMG/SMO")?.managerId).toBeNull()
    expect(members.filter((m) => m.projectId === "p3" && m.employeeId === "teesha")).toHaveLength(1)
  })

  it("ignores managers who have left the company", async () => {
    const client = fakeClient({
      teams: precedent(),
      members: [],
      active: { ...everyoneActive, dev: false },
    })

    const created = await ensureProjectTeams("p3", { client })

    expect(created.find((c) => c.name === "VIDEO")?.managerId).toBeNull()
  })

  it("follows the majority when projects disagree", async () => {
    const teams = [...precedent(), team("p4", "VIDEO", "guru"), team("p4", "WEB", "diwakar")]
    const client = fakeClient({ teams, members: [], active: { ...everyoneActive, guru: true } })

    const created = await ensureProjectTeams("p5", { client })

    expect(created.find((c) => c.name === "VIDEO")?.managerId).toBe("dev")
  })

  it("refuses an unknown project instead of seeding orphan teams", async () => {
    const client = fakeClient({ teams: [], members: [], active: {} })
    await expect(ensureProjectTeams("missing-1", { client })).rejects.toThrow(/not found/)
  })
})
