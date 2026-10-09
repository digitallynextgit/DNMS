import { describe, expect, it, vi } from "vitest"

// The tests hand in a fake client; keep the real Prisma client from being constructed.
vi.mock("@/server/db", () => ({ db: {} }))

import { ensureProjectTeams, syncAccountManagerTeam } from "./project-teams"

type Team = {
  id: string
  tenantId: string
  projectId: string
  name: string
  managerId: string | null
}
type Member = { id: string; teamId?: string; projectId: string; employeeId: string }

type Client = NonNullable<Parameters<typeof ensureProjectTeams>[1]>["client"]

function fakeClient(state: { teams: Team[]; members: Member[]; active: Record<string, boolean> }) {
  const { teams, members, active } = state
  let n = 0
  const client = {
    project: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id.startsWith("missing") ? null : { tenantId: "t1", ownerId: "owner" },
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
      findUnique: async ({
        where,
      }: {
        where: { projectId_name: { projectId: string; name: string } }
      }) =>
        teams.find(
          (t) =>
            t.projectId === where.projectId_name.projectId && t.name === where.projectId_name.name,
        ) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: { managerId: string } }) => {
        const t = teams.find((x) => x.id === where.id)!
        t.managerId = data.managerId
        return t
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
            teamId: team.id,
            projectId: data.members.create.projectId,
            employeeId: data.members.create.employeeId,
          })
        }
        return team
      },
    },
    projectTeamMember: {
      upsert: async ({
        where,
        create,
      }: {
        where: { teamId_employeeId: { teamId: string; employeeId: string } }
        create: { teamId: string; projectId: string; employeeId: string }
      }) => {
        const { teamId, employeeId } = where.teamId_employeeId
        const found = members.find((m) => m.teamId === teamId && m.employeeId === employeeId)
        if (found) return found
        n += 1
        const row = { id: `m-${n}`, ...create }
        members.push(row)
        return row
      },
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
  harsh: true,
  gokul: true,
}

/** Two fully staffed projects - the precedent a new project copies. */
function precedent(): Team[] {
  const rows: Team[] = []
  for (const p of ["p1", "p2"]) {
    rows.push(
      team(p, "AM", "teesha"),
      team(p, "WEB", "diwakar"),
      team(p, "DESIGN", "hemant"),
      team(p, "VIDEO", "dev"),
      team(p, "CONTENT", "aashutosh"),
      team(p, "SMO", "teesha"),
      team(p, "SEO", null),
      team(p, "PERFORMANCE", null),
      team(p, "PR", "harsh"),
      team(p, "ALLIANCES & PARTNERSHIPS", "gokul"),
      team(p, "ADMIN", "manpreet"),
    )
  }
  return rows
}

describe("ensureProjectTeams", () => {
  it("gives a bare project all eleven teams, staffed the way the other projects are", async () => {
    const teams = precedent()
    const members: Member[] = []
    const client = fakeClient({ teams, members, active: everyoneActive })

    const created = await ensureProjectTeams("p3", { client })

    expect(created.map((c) => c.name)).toEqual([
      "AM",
      "WEB",
      "DESIGN",
      "VIDEO",
      "CONTENT",
      "SMO",
      "SEO",
      "PERFORMANCE",
      "PR",
      "ALLIANCES & PARTNERSHIPS",
      "ADMIN",
    ])
    expect(Object.fromEntries(created.map((c) => [c.name, c.managerId]))).toEqual({
      AM: "owner",
      WEB: "diwakar",
      DESIGN: "hemant",
      VIDEO: "dev",
      CONTENT: "aashutosh",
      SMO: "teesha",
      SEO: null,
      PERFORMANCE: null,
      PR: "harsh",
      "ALLIANCES & PARTNERSHIPS": "gokul",
      ADMIN: "manpreet",
    })
    expect(
      members
        .filter((m) => m.projectId === "p3")
        .map((m) => m.employeeId)
        .sort(),
    ).toEqual([
      "aashutosh",
      "dev",
      "diwakar",
      "gokul",
      "harsh",
      "hemant",
      "manpreet",
      "owner",
      "teesha",
    ])
  })

  it("is idempotent - a fully set-up project gets nothing new", async () => {
    const teams = precedent()
    const client = fakeClient({ teams, members: [], active: everyoneActive })

    const created = await ensureProjectTeams("p1", { client })

    expect(created).toEqual([])
    expect(teams).toHaveLength(22)
  })

  it("adds only the missing teams and leaves existing ones alone", async () => {
    const teams = [...precedent(), team("p3", "WEB", "diwakar"), team("p3", "VIDEO", null)]
    const client = fakeClient({ teams, members: [], active: everyoneActive })

    const created = await ensureProjectTeams("p3", { client })

    expect(created.map((c) => c.name)).toEqual([
      "AM",
      "DESIGN",
      "CONTENT",
      "SMO",
      "SEO",
      "PERFORMANCE",
      "PR",
      "ALLIANCES & PARTNERSHIPS",
      "ADMIN",
    ])
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

  it("lets one person manage several teams of the same project", async () => {
    const teams = [...precedent(), team("p3", "WEB", "teesha")]
    const members: Member[] = [{ id: "m0", projectId: "p3", employeeId: "teesha" }]
    const client = fakeClient({ teams, members, active: everyoneActive })

    const created = await ensureProjectTeams("p3", { client })

    expect(created.find((c) => c.name === "SMO")?.managerId).toBe("teesha")
    expect(members.filter((m) => m.projectId === "p3" && m.employeeId === "teesha")).toHaveLength(2)
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

  it("puts the project's Account Manager in charge of the AM team", async () => {
    const client = fakeClient({ teams: precedent(), members: [], active: everyoneActive })

    const created = await ensureProjectTeams("p3", { client })

    expect(created.find((c) => c.name === "AM")?.managerId).toBe("owner")
  })

  it("refuses an unknown project instead of seeding orphan teams", async () => {
    const client = fakeClient({ teams: [], members: [], active: {} })
    await expect(ensureProjectTeams("missing-1", { client })).rejects.toThrow(/not found/)
  })
})

describe("syncAccountManagerTeam", () => {
  it("makes the new Account Manager the AM team's manager and keeps the old one as a member", async () => {
    const teams = [team("p1", "AM", "teesha")]
    const members: Member[] = [{ id: "m0", teamId: "p1-AM", projectId: "p1", employeeId: "teesha" }]
    const client = fakeClient({ teams, members, active: everyoneActive })

    await syncAccountManagerTeam("p1", "manpreet", client)

    expect(teams[0]?.managerId).toBe("manpreet")
    expect(members.map((m) => m.employeeId).sort()).toEqual(["manpreet", "teesha"])
  })

  it("does nothing new when they already run it", async () => {
    const teams = [team("p1", "AM", "teesha")]
    const members: Member[] = [{ id: "m0", teamId: "p1-AM", projectId: "p1", employeeId: "teesha" }]
    const client = fakeClient({ teams, members, active: everyoneActive })

    await syncAccountManagerTeam("p1", "teesha", client)

    expect(teams[0]?.managerId).toBe("teesha")
    expect(members).toHaveLength(1)
  })
})
