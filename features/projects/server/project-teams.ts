import { db } from "@/server/db"
import { PROJECT_TEAMS, type ProjectTeamName } from "@/features/projects/lib/project-teams"

/** The app client. Tests hand in a fake shaped like the four calls made here. */
type Client = typeof db

export interface SeededTeam {
  name: ProjectTeamName
  managerId: string | null
}

/**
 * Give a project every catalogue team it is missing. Idempotent: existing teams
 * are never touched, so this runs on project creation and is safe to run again.
 *
 * A new team is staffed the way the company already staffs it elsewhere: the
 * active person who manages that team on most other projects becomes its
 * manager and first member ("teams don't change between projects - members
 * do"). `managers` pins a person for a team explicitly, which is how ADMIN got
 * its default before any ADMIN team existed. With nobody to copy, the team is
 * created unstaffed.
 */
export async function ensureProjectTeams(
  projectId: string,
  opts: { managers?: Partial<Record<ProjectTeamName, string>>; client?: Client } = {},
): Promise<SeededTeam[]> {
  const client = opts.client ?? db

  const project = await client.project.findUnique({
    where: { id: projectId },
    select: { tenantId: true },
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

    let managerId =
      opts.managers?.[name] ?? (await usualManagerFor(name, projectId, project.tenantId, client))

    // One team per project per person. If the usual manager already sits on
    // another team of this project, the team starts unstaffed instead.
    if (managerId) {
      const elsewhere = await client.projectTeamMember.findFirst({
        where: { projectId, employeeId: managerId },
        select: { id: true },
      })
      if (elsewhere) managerId = null
    }

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
 * The active person managing this team on most of the tenant's other projects,
 * or null when nobody does.
 */
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
