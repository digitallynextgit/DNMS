import "server-only"

import type { Session } from "next-auth"
import { db } from "@/server/db"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS, SYSTEM_ROLES } from "@/lib/constants"
import { actorStampId } from "@/lib/audit"

// HR reads anyone's week, as in My Work; writing stays with the person and their manager.
const HR_ROLES: string[] = [SYSTEM_ROLES.HR_MANAGER, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.ADMIN_]
import { isManagerOf } from "@/lib/reporting-line"
import { ActionError, ok, runAction, type ActionResult } from "@/server/action-result"
import { canAccessProject, canManageProject } from "./project-access"
import { weeklyImpactQuerySchema, weeklyImpactSchema } from "../schemas/weekly-impact.schema"

export interface WeeklyImpactNote {
  employeeId: string
  /** Null for the Adhoc row. */
  projectId: string | null
  note: string
  updatedAt: string
  updatedBy: { id: string; name: string } | null
}

const ADHOC_KEY = "adhoc"

const NOTE_SELECT = {
  employeeId: true,
  projectId: true,
  note: true,
  updatedAt: true,
  updatedBy: { select: { id: true, firstName: true, lastName: true } },
} as const

type NoteRow = {
  employeeId: string
  projectId: string | null
  note: string
  updatedAt: Date
  updatedBy: { id: string; firstName: string; lastName: string | null } | null
}

function toView(r: NoteRow): WeeklyImpactNote {
  return {
    employeeId: r.employeeId,
    projectId: r.projectId,
    note: r.note,
    updatedAt: r.updatedAt.toISOString(),
    updatedBy: r.updatedBy
      ? {
          id: r.updatedBy.id,
          name: `${r.updatedBy.firstName} ${r.updatedBy.lastName ?? ""}`.trim(),
        }
      : null,
  }
}

const weekDate = (week: string) => new Date(`${week}T00:00:00Z`)

/** Their line manager, or the manager of a team they are on - the same people My Tasks lets in. */
async function managesEmployee(userId: string, employeeId: string): Promise<boolean> {
  const [employee, team] = await Promise.all([
    db.employee.findUnique({
      where: { id: employeeId },
      select: { managerId: true, dottedManagerId: true },
    }),
    db.projectTeam.findFirst({
      where: { managerId: userId, members: { some: { employeeId } } },
      select: { id: true },
    }),
  ])
  return isManagerOf(employee, userId) || !!team
}

async function canSeePersonWeek(session: Session, employeeId: string): Promise<boolean> {
  if (employeeId === session.user.id) return true
  if (hasPermission(session, PERMISSIONS.PROJECT_WRITE)) return true
  if ((session.user.roles ?? []).some((r) => HR_ROLES.includes(r))) return true
  return managesEmployee(session.user.id, employeeId)
}

export async function listWeeklyImpact(
  input: unknown,
  session: Session,
): Promise<ActionResult<WeeklyImpactNote[]>> {
  return runAction(async () => {
    const q = weeklyImpactQuerySchema.parse(input)
    if (q.employeeId) {
      if (!(await canSeePersonWeek(session, q.employeeId)))
        throw new ActionError("You can't see this person's week", 403)
    } else if (!(await canAccessProject(session, q.projectId!))) {
      throw new ActionError("Project not found", 404)
    }

    const rows = await db.taskWeeklyImpact.findMany({
      where: {
        weekStart: weekDate(q.week),
        ...(q.employeeId ? { employeeId: q.employeeId } : { projectId: q.projectId }),
      },
      select: NOTE_SELECT,
    })
    return ok(rows.map(toView))
  })
}

/** The person themselves, their manager, or a project admin. An empty note deletes it. */
export async function saveWeeklyImpact(
  input: unknown,
  session: Session,
): Promise<ActionResult<WeeklyImpactNote | null>> {
  return runAction(async () => {
    const v = weeklyImpactSchema.parse(input)
    const userId = session.user.id

    const allowed =
      v.employeeId === userId ||
      (v.projectId
        ? await canManageProject(session, v.projectId)
        : hasPermission(session, PERMISSIONS.PROJECT_WRITE)) ||
      (await managesEmployee(userId, v.employeeId))
    if (!allowed)
      throw new ActionError("Only they, their manager or a project admin can write this", 403)

    // The tenant guard scopes WHERE clauses, not payloads, so check both ids belong here.
    const [employee, project] = await Promise.all([
      db.employee.findFirst({ where: { id: v.employeeId }, select: { id: true } }),
      v.projectId
        ? db.project.findFirst({ where: { id: v.projectId }, select: { id: true } })
        : { id: null },
    ])
    if (!employee) throw new ActionError("Employee not found", 404)
    if (!project) throw new ActionError("Project not found", 404)

    const key = {
      employeeId: v.employeeId,
      rowKey: v.projectId ?? ADHOC_KEY,
      weekStart: weekDate(v.week),
    }
    if (!v.note) {
      await db.taskWeeklyImpact.deleteMany({ where: key })
      return ok(null)
    }

    const updatedById = actorStampId(session)
    const row = await db.taskWeeklyImpact.upsert({
      where: { employeeId_rowKey_weekStart: key },
      create: { ...key, projectId: v.projectId, note: v.note, updatedById },
      update: { note: v.note, updatedById },
      select: NOTE_SELECT,
    })
    return ok(toView(row))
  })
}
