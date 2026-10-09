import "server-only"

import { db } from "@/server/db"
import { generateProjectSlug } from "./project-slug"
import { ensureProjectTeams } from "./project-teams"
import { syncProjectFolderAccessAsync } from "./project-drive.service"
import { ensureServiceCalendars } from "./service-calendars"
import type { ProjectServiceCode } from "../lib/project-services"

export interface NewProject {
  name: string
  description?: string | null
  status?: "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED"
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  stage?: "LAUNCH" | "GROWTH" | "REBRANDING" | "DECLINE" | null
  ownerId: string
  clientId?: string | null
  startDate?: Date | null
  budget?: number | null
  shortName?: string | null
  services?: ProjectServiceCode[]
}

export class ShortNameTakenError extends Error {
  constructor(shortName: string) {
    super(`The short name "${shortName}" is already used by another project.`)
  }
}

/** Is this short name already used by another project of this company (any case)? */
export async function shortNameTaken(shortName: string, exceptProjectId?: string) {
  const other = await db.project.findFirst({
    where: {
      shortName: { equals: shortName, mode: "insensitive" },
      ...(exceptProjectId ? { id: { not: exceptProjectId } } : {}),
    },
    select: { id: true },
  })
  return !!other
}

/**
 * Create a project the way "New Project" does: next DN code, slug, every catalogue team, a calendar
 * per service, Drive access.
 */
export async function createProject(input: NewProject, actorId: string | null = null) {
  if (input.shortName && (await shortNameTaken(input.shortName))) {
    throw new ShortNameTakenError(input.shortName)
  }

  // Codes are fixed-width DN#####, so the highest string is the highest number.
  // Retries on the unique-violation race when two creates compute the same code.
  let project
  for (let attempt = 0; ; attempt++) {
    const lastDn = await db.project.findFirst({
      where: { code: { startsWith: "DN" } },
      select: { code: true },
      orderBy: { code: "desc" },
    })
    const lastMatch = lastDn?.code.match(/^DN(\d+)$/)
    const maxNum = lastMatch ? parseInt(lastMatch[1] ?? "0", 10) : 0
    const code = `DN${(maxNum + 1 + attempt).toString().padStart(5, "0")}`

    try {
      project = await db.project.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          code,
          slug: await generateProjectSlug(input.name, code),
          shortName: input.shortName ?? null,
          services: input.services ?? [],
          status: input.status ?? "PLANNING",
          priority: input.priority ?? "MEDIUM",
          stage: input.stage ?? null,
          ownerId: input.ownerId,
          clientId: input.clientId || null,
          startDate: input.startDate ?? null,
          budget: input.budget ?? null,
        },
        include: { owner: { select: { id: true, firstName: true, lastName: true } } },
      })
      break
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e
      // Someone took the short name between the check and the insert.
      if (input.shortName && (await shortNameTaken(input.shortName))) {
        throw new ShortNameTakenError(input.shortName)
      }
      // Otherwise another create took this code number; recompute (give up after 5).
      if (attempt >= 5) throw e
    }
  }

  // Every project gets the whole team catalogue from day one, its owner on AM.
  const teams = await ensureProjectTeams(project.id)
  // The project exists either way; a calendar that fails can be made from the services popup.
  await ensureServiceCalendars(project.id, actorId).catch((e) =>
    console.error("[SERVICE_CALENDARS]", e),
  )
  // Share the Drive folder with the owner and team managers straight away.
  syncProjectFolderAccessAsync(project.id)
  return { project, teams }
}
