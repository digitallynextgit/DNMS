import "server-only"

import type { Prisma } from "@prisma/client"
import type { Session } from "next-auth"
import { db, type DbTransaction } from "@/server/db"
import { isProjectService } from "../lib/project-services"
import { PROJECT_LEADS_SELECT, isProjectLead } from "../lib/project-leads"
import { currentPlanMonth } from "../lib/calendar-months"
import { canManageProject } from "./project-access"
import { syncServiceCalendarManager } from "./service-calendars"
import { parsePeriodMonth } from "./sheets.service"

// Each service on a project has an owner (who manages its calendars) and, optionally, an always-on
// secondary owner with the same powers on those calendars.

const PERSON = {
  select: { id: true, firstName: true, lastName: true, profilePhoto: true },
} as const

/** What the UI shows for an owner: the service plus the people. */
export const SERVICE_OWNER_SELECT = {
  service: true,
  employee: PERSON,
  secondaryEmployee: PERSON,
} satisfies Prisma.ProjectServiceOwnerSelect

/** A rule the caller broke: 422, or 403 when it is about who may do it. */
export class ServiceOwnerError extends Error {
  constructor(
    message: string,
    readonly status: 403 | 422 = 422,
  ) {
    super(message)
  }
}

/** undefined = leave alone, null = clear, a string = this employee. */
export interface ServiceOwnerChange {
  primary?: string | null
  secondary?: string | null
}

/**
 * Who may make this change: an Account Manager or a project admin sets anything; the service's owner
 * (as they are now) may also pick or clear their own secondary.
 */
export async function assertMayChangeServiceOwners(
  session: Session,
  projectId: string,
  service: string,
  change: ServiceOwnerChange,
): Promise<void> {
  if (await canManageProject(session, projectId)) return
  if (change.primary !== undefined) {
    throw new ServiceOwnerError(
      "Only an Account Manager or a project admin can choose a service's owner.",
      403,
    )
  }
  const row = await db.projectServiceOwner.findUnique({
    where: { projectId_service: { projectId, service } },
    select: { employeeId: true },
  })
  if (row?.employeeId !== session.user.id) {
    throw new ServiceOwnerError(
      "Only the service's owner, an Account Manager or a project admin can choose its secondary owner.",
      403,
    )
  }
}

/**
 * Set a service's owner and/or secondary owner. Clearing the owner moves the secondary up, and making
 * the secondary the owner empties their old slot, so a covered service is never left unowned.
 * Returns who was newly given a role, to tell them.
 */
export async function setServiceOwners(
  projectId: string,
  service: string,
  change: ServiceOwnerChange,
): Promise<{ employeeId: string; secondary: boolean }[]> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { services: true, ...PROJECT_LEADS_SELECT },
  })
  if (!project) throw new ServiceOwnerError("Project not found")
  if (!isProjectService(service) || !project.services.includes(service)) {
    throw new ServiceOwnerError("This project doesn't include that service.")
  }

  const row = await db.projectServiceOwner.findUnique({
    where: { projectId_service: { projectId, service } },
    select: { employeeId: true, secondaryEmployeeId: true },
  })
  const before = { primary: row?.employeeId ?? null, secondary: row?.secondaryEmployeeId ?? null }
  let { primary, secondary } = before
  if (change.primary !== undefined) {
    primary = change.primary
    if (change.secondary === undefined && !primary && secondary) {
      primary = secondary
      secondary = null
    } else if (change.secondary === undefined && primary && primary === secondary) {
      secondary = null
    }
  }
  if (change.secondary !== undefined) secondary = change.secondary
  if (secondary && !primary) {
    throw new ServiceOwnerError("Choose the service's owner before a secondary owner.")
  }
  if (secondary && secondary === primary) {
    throw new ServiceOwnerError("The secondary owner must be someone other than the owner.")
  }

  // Owners must already be on the project, so they can open it, see its tasks and use its Drive.
  for (const id of [primary, secondary]) {
    if (!id || id === before.primary || id === before.secondary || isProjectLead(project, id)) {
      continue
    }
    const onTeam = await db.projectTeamMember.count({ where: { projectId, employeeId: id } })
    if (onTeam === 0) {
      throw new ServiceOwnerError(
        "Only someone on this project's teams can own a service. Add them to a team first.",
      )
    }
  }

  await db.$transaction(async (tx) => {
    await tx.projectServiceOwner.deleteMany({ where: { projectId, service } })
    if (primary) {
      await tx.projectServiceOwner.create({
        data: { projectId, service, employeeId: primary, secondaryEmployeeId: secondary },
      })
    }
  })
  // The calendars follow: their manager when the owner is set, their secondary whenever it moved.
  if (change.primary !== undefined || secondary !== before.secondary) {
    await syncServiceCalendarManager(
      projectId,
      service,
      change.primary !== undefined ? primary : before.primary,
      secondary !== before.secondary || change.primary !== undefined ? secondary : undefined,
    )
  }

  const assigned: { employeeId: string; secondary: boolean }[] = []
  if (primary && primary !== before.primary)
    assigned.push({ employeeId: primary, secondary: false })
  if (secondary && secondary !== before.secondary) {
    assigned.push({ employeeId: secondary, secondary: true })
  }
  return assigned
}

/** Make `employeeId` the owner of `service` on the project, or clear the owner with null. */
export async function setServiceOwner(
  projectId: string,
  service: string,
  employeeId: string | null,
): Promise<void> {
  await setServiceOwners(projectId, service, { primary: employeeId })
}

/** Drop owners of services the project no longer includes. */
export async function pruneServiceOwners(projectId: string, services: readonly string[]) {
  await db.projectServiceOwner.deleteMany({
    where: { projectId, service: { notIn: [...services] } },
  })
}

/**
 * After someone leaves a team: if they are now off the project entirely, they stop being a
 * secondary owner, and a service they own passes to its secondary (or is left unowned).
 */
export async function dropServicesIfOffProject(
  tx: DbTransaction,
  projectId: string,
  employeeId: string,
): Promise<void> {
  const [teams, project] = await Promise.all([
    tx.projectTeamMember.count({ where: { projectId, employeeId } }),
    tx.project.findUnique({ where: { id: projectId }, select: PROJECT_LEADS_SELECT }),
  ])
  if (teams > 0 || (project && isProjectLead(project, employeeId))) return

  const from = parsePeriodMonth(currentPlanMonth())!
  const thisMonthOn = [{ periodMonth: null }, { periodMonth: { gte: from } }]
  await tx.projectServiceOwner.updateMany({
    where: { projectId, secondaryEmployeeId: employeeId },
    data: { secondaryEmployeeId: null },
  })
  await tx.projectWorkbook.updateMany({
    where: {
      projectId,
      service: { not: null },
      secondaryAssignedToId: employeeId,
      OR: thisMonthOn,
    },
    data: { secondaryAssignedToId: null },
  })
  const owned = await tx.projectServiceOwner.findMany({
    where: { projectId, employeeId },
    select: { id: true, service: true, secondaryEmployeeId: true },
  })
  for (const o of owned) {
    if (!o.secondaryEmployeeId) {
      await tx.projectServiceOwner.delete({ where: { id: o.id } })
      continue
    }
    await tx.projectServiceOwner.update({
      where: { id: o.id },
      data: { employeeId: o.secondaryEmployeeId, secondaryEmployeeId: null },
    })
    // The same hand-over as syncServiceCalendarManager: this month on; past months keep theirs.
    await tx.projectWorkbook.updateMany({
      where: { projectId, service: o.service, OR: thisMonthOn },
      data: { assignedToId: o.secondaryEmployeeId, secondaryAssignedToId: null },
    })
  }
}

/**
 * A leaver's service and calendar ownership, as steps for a batch `db.$transaction([...])`: where
 * they own a service or manage a calendar, its secondary takes over (calendars from this month on);
 * where they are the secondary, they just drop off; a service with nobody behind them is left
 * unowned. Raw SQL is scoped by the leaver's id, which belongs to one company.
 */
export function serviceOwnerExitSteps(employeeId: string) {
  const from = parsePeriodMonth(currentPlanMonth())!
  return [
    // Calendars they manage, this month on: their secondary takes over (service calendars carry the
    // service's secondary, which steps up just below).
    db.$executeRaw`
      UPDATE project_workbooks
      SET assigned_to_id = secondary_assigned_to_id, secondary_assigned_to_id = NULL
      WHERE assigned_to_id = ${employeeId} AND secondary_assigned_to_id IS NOT NULL
        AND (period_month IS NULL OR period_month >= ${from})`,
    db.projectWorkbook.updateMany({
      where: { secondaryAssignedToId: employeeId },
      data: { secondaryAssignedToId: null },
    }),
    db.$executeRaw`
      UPDATE project_service_owners
      SET employee_id = secondary_employee_id, secondary_employee_id = NULL
      WHERE employee_id = ${employeeId} AND secondary_employee_id IS NOT NULL`,
    db.projectServiceOwner.updateMany({
      where: { secondaryEmployeeId: employeeId },
      data: { secondaryEmployeeId: null },
    }),
    db.projectServiceOwner.deleteMany({ where: { employeeId } }),
  ] as const
}

/**
 * Everything a leaver holds on projects, as steps for one batch `db.$transaction([...])` - the same
 * for every way an account ends (deactivate, bulk terminate, exit checklist, exit sweep). The first
 * two results are the team seats removed and the teams left without a manager. A project they lead
 * passes to its secondary Account Manager; where they are the secondary, they just drop off; a
 * project with no secondary keeps them as its Account Manager until someone picks a new one.
 */
export function projectExitSteps(employeeId: string) {
  return [
    db.projectTeamMember.deleteMany({ where: { employeeId } }),
    db.projectTeam.updateMany({ where: { managerId: employeeId }, data: { managerId: null } }),
    ...serviceOwnerExitSteps(employeeId),
    db.$executeRaw`
      UPDATE projects
      SET owner_id = secondary_account_manager_id, secondary_account_manager_id = NULL
      WHERE owner_id = ${employeeId} AND secondary_account_manager_id IS NOT NULL`,
    db.project.updateMany({
      where: { secondaryAccountManagerId: employeeId },
      data: { secondaryAccountManagerId: null },
    }),
  ] as const
}
