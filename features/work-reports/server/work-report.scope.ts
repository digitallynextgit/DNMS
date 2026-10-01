import "server-only"

import type { Session } from "next-auth"

import { db } from "@/server/db"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS, SYSTEM_ROLES } from "@/lib/constants"
import { VISIBLE_EMPLOYEE_FILTER } from "@/server/selects"
import { isAiConfigured } from "@/lib/ai"
import { previousMonth } from "../lib/report-format"
import { reportingLine } from "../lib/reporting-line"
import type { WorkReportRole, WorkReportScopeData, WorkReportScopePerson } from "../types"

// =============================================================================
// Who a work report may cover.
//
//   admin   - project:write holders and HR (hr_manager / admin): anyone.
//   manager - has people reporting to them: themselves plus their whole
//             reporting line, indirect reports included, and anyone who has
//             them as a dotted-line manager.
//   member  - only themselves, whatever the request asks for.
//
// The picker and the download both come from here, so the page can never offer
// a person the route would then refuse.
// =============================================================================

const HR_ROLE_NAMES: string[] = [SYSTEM_ROLES.HR_MANAGER, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.ADMIN_]

export interface WorkReportScope {
  role: WorkReportRole
  employeeId: string
  /** Everyone the caller may report on; null = anyone (admin). */
  allowedIds: string[] | null
  /** The caller's own reporting line, for the "my team" shortcut. */
  teamIds: string[]
}

const ACTIVE = { isActive: true, ...VISIBLE_EMPLOYEE_FILTER }

export async function resolveWorkReportScope(session: Session): Promise<WorkReportScope> {
  const me = session.user.id
  const roles = session.user.roles ?? []
  const seesEveryone =
    hasPermission(session, PERMISSIONS.PROJECT_WRITE) ||
    roles.some((r) => HR_ROLE_NAMES.includes(r))

  const employees = await db.employee.findMany({
    where: ACTIVE,
    select: { id: true, managerId: true, dottedManagerId: true },
  })
  const teamIds = reportingLine(me, employees)

  if (seesEveryone) return { role: "admin", employeeId: me, allowedIds: null, teamIds }
  if (teamIds.length)
    return { role: "manager", employeeId: me, allowedIds: [me, ...teamIds], teamIds }
  return { role: "member", employeeId: me, allowedIds: [me], teamIds: [] }
}

/**
 * The people a request may actually cover, or null when it asks for someone
 * outside the caller's scope (a 403, not a silently shorter report). A member
 * always gets themselves.
 */
export function narrowPeople(scope: WorkReportScope, requested: string[]): string[] | null {
  if (scope.role === "member") return [scope.employeeId]
  const ids = Array.from(new Set(requested))
  if (ids.length === 0) return null
  if (scope.allowedIds === null) return ids
  return ids.every((id) => scope.allowedIds!.includes(id)) ? ids : null
}

export async function describeWorkReportScope(
  scope: WorkReportScope,
): Promise<WorkReportScopeData> {
  const rows = await db.employee.findMany({
    where: {
      ...ACTIVE,
      ...(scope.allowedIds === null ? {} : { id: { in: scope.allowedIds } }),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      designation: { select: { title: true } },
      department: { select: { name: true } },
    },
  })
  const team = new Set(scope.teamIds)
  const people: WorkReportScopePerson[] = rows
    .map((e) => ({
      id: e.id,
      name: `${e.firstName} ${e.lastName}`.trim(),
      designation: e.designation?.title ?? null,
      department: e.department?.name ?? null,
      inTeam: team.has(e.id),
      isMe: e.id === scope.employeeId,
    }))
    .sort(
      (a, b) =>
        Number(b.isMe) - Number(a.isMe) ||
        Number(b.inTeam) - Number(a.inTeam) ||
        a.name.localeCompare(b.name),
    )
  return {
    role: scope.role,
    people,
    defaultMonth: previousMonth(new Date()),
    aiAvailable: isAiConfigured(),
  }
}
