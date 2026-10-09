import "server-only"

import type { Prisma } from "@prisma/client"
import { db, type DbTransaction } from "@/server/db"
import { isProjectService } from "../lib/project-services"
import { syncServiceCalendarManager } from "./service-calendars"

/** What the UI shows for an owner: the service plus the person. */
export const SERVICE_OWNER_SELECT = {
  service: true,
  employee: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
} satisfies Prisma.ProjectServiceOwnerSelect

/** A rule the caller broke; the route turns it into a 422. */
export class ServiceOwnerError extends Error {}

/** Make `employeeId` the owner of `service` on the project, or clear the owner with null. */
export async function setServiceOwner(
  projectId: string,
  service: string,
  employeeId: string | null,
): Promise<void> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { services: true, ownerId: true },
  })
  if (!project) throw new ServiceOwnerError("Project not found")
  if (!isProjectService(service) || !project.services.includes(service)) {
    throw new ServiceOwnerError("This project doesn't include that service.")
  }
  // Owners must already be on the project, so they can open it, see its tasks and use its Drive.
  if (employeeId && employeeId !== project.ownerId) {
    const onTeam = await db.projectTeamMember.count({ where: { projectId, employeeId } })
    if (onTeam === 0) {
      throw new ServiceOwnerError(
        "Only someone on this project's teams can own a service. Add them to a team first.",
      )
    }
  }

  await db.$transaction(async (tx) => {
    await tx.projectServiceOwner.deleteMany({ where: { projectId, service } })
    if (employeeId) {
      await tx.projectServiceOwner.create({ data: { projectId, service, employeeId } })
    }
  })
  await syncServiceCalendarManager(projectId, service, employeeId)
}

/** Drop owners of services the project no longer includes. */
export async function pruneServiceOwners(projectId: string, services: readonly string[]) {
  await db.projectServiceOwner.deleteMany({
    where: { projectId, service: { notIn: [...services] } },
  })
}

/** After someone leaves a team: if they are now off the project entirely, their services lose them. */
export async function dropServicesIfOffProject(
  tx: DbTransaction,
  projectId: string,
  employeeId: string,
): Promise<void> {
  const [teams, project] = await Promise.all([
    tx.projectTeamMember.count({ where: { projectId, employeeId } }),
    tx.project.findUnique({ where: { id: projectId }, select: { ownerId: true } }),
  ])
  if (teams > 0 || project?.ownerId === employeeId) return
  await tx.projectServiceOwner.deleteMany({ where: { projectId, employeeId } })
}
