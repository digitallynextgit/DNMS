import { db } from "@/server/db"
import {
  ACCOUNT_MANAGER_TEAM,
  PROJECT_TEAMS,
  type ProjectTeamName,
} from "@/features/projects/lib/project-teams"

/** The app client, or a transaction. Tests hand in a fake shaped like the calls made here. */
type Client = typeof db

export interface SeededTeam {
  name: ProjectTeamName
  managerId: string | null
}

/**
 * Give a project every catalogue team it is missing (existing teams are never touched). The AM team
 * gets the project's Account Manager; any other new team gets the person who manages it on most
 * other projects. `managers` pins one explicitly.
 */
export async function ensureProjectTeams(
  projectId: string,
  opts: { managers?: Partial<Record<ProjectTeamName, string>>; client?: Client } = {},
): Promise<SeededTeam[]> {
  const client = opts.client ?? db

  const project = await client.project.findUnique({
    where: { id: projectId },
    select: { tenantId: true, ownerId: true },
  })
  if (!project) throw new Error(`ensureProjectTeams: project ${projectId} not found`)

  const existing = await client.projectTeam.findMany({
    where: { projectId },
    select: { name: true },
  })
  const have = new Set(existing.map((t) => t.name))

  const created: SeededTeam[] = []
  for (const name of PROJECT_TEAMS) {
    if (have.has(name)) continue

    const managerId =
      opts.managers?.[name] ??
      (name === ACCOUNT_MANAGER_TEAM
        ? project.ownerId
        : await usualManagerFor(name, projectId, project.tenantId, client))

    await client.projectTeam.create({
      data: {
        projectId,
        name,
        managerId,
        ...(managerId ? { members: { create: { projectId, employeeId: managerId } } } : {}),
      },
    })
    created.push({ name, managerId })
  }
  return created
}

/**
 * Make the project's Account Manager the AM team's manager (and a member). The previous Account
 * Manager stays on the team until someone removes them.
 */
export async function syncAccountManagerTeam(
  projectId: string,
  accountManagerId: string,
  client: Client = db,
): Promise<void> {
  const team = await client.projectTeam.findUnique({
    where: { projectId_name: { projectId, name: ACCOUNT_MANAGER_TEAM } },
    select: { id: true, managerId: true },
  })
  if (!team) {
    await ensureProjectTeams(projectId, {
      client,
      managers: { [ACCOUNT_MANAGER_TEAM]: accountManagerId },
    })
    return
  }
  await client.projectTeamMember.upsert({
    where: { teamId_employeeId: { teamId: team.id, employeeId: accountManagerId } },
    create: { teamId: team.id, projectId, employeeId: accountManagerId },
    update: {},
  })
  if (team.managerId !== accountManagerId) {
    await client.projectTeam.update({
      where: { id: team.id },
      data: { managerId: accountManagerId },
    })
  }
}

async function usualManagerFor(
  name: ProjectTeamName,
  projectId: string,
  tenantId: string,
  client: Client,
): Promise<string | null> {
  const rows = await client.projectTeam.findMany({
    where: {
      tenantId,
      name,
      projectId: { not: projectId },
      managerId: { not: null },
      manager: { isActive: true },
    },
    select: { managerId: true },
  })

  const tally = new Map<string, number>()
  for (const { managerId } of rows) {
    if (managerId) tally.set(managerId, (tally.get(managerId) ?? 0) + 1)
  }

  let best: string | null = null
  let bestCount = 0
  for (const [id, count] of tally) {
    if (count > bestCount) {
      best = id
      bestCount = count
    }
  }
  return best
}
