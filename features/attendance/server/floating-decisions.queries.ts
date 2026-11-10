import "server-only"

import type { Session } from "next-auth"
import { db } from "@/server/db"
import { SYSTEM_ROLES } from "@/lib/constants"
import { managedBy } from "@/lib/reporting-line"
import { EMPLOYEE_SUMMARY_SELECT } from "@/server/selects"

// Same reach as the requests inbox: HR and admins see everyone, a manager their own reports.
const HR_ROLES: string[] = [SYSTEM_ROLES.HR_MANAGER, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.ADMIN_]

export interface FloatingDecision {
  id: string
  holidayId: string
  status: "PENDING" | "APPROVED" | "REJECTED"
  employee: {
    id: string
    firstName: string
    lastName: string
    employeeNo: string
    profilePhoto: string | null
  }
  /** The employee's own reason for applying. */
  reason: string | null
  rejectionReason: string | null
  /** Who made the final call; "Management" when it was the hidden owner account. */
  decidedBy: string | null
  decidedAt: string | null
  /** The manager's advisory step, shown while HR's call is still pending. */
  managerDecision: "APPROVED" | "REJECTED" | null
}

/** Every live floating-holiday request in a year, for the per-holiday board. Withdrawn ones are left out. */
export async function listFloatingDecisions(
  session: Session,
  year: number,
): Promise<FloatingDecision[]> {
  const isHr = (session.user.roles ?? []).some((r) => HR_ROLES.includes(r))
  const rows = await db.floatingHolidaySelection.findMany({
    where: {
      year,
      status: { in: ["PENDING", "APPROVED", "REJECTED"] },
      ...(isHr ? {} : { employee: managedBy(session.user.id) }),
    },
    select: {
      id: true,
      holidayId: true,
      status: true,
      reason: true,
      rejectionReason: true,
      managerDecision: true,
      hrApproverId: true,
      reviewedAt: true,
      employee: { select: EMPLOYEE_SUMMARY_SELECT },
    },
    orderBy: [{ employee: { firstName: "asc" } }, { employee: { lastName: "asc" } }],
  })

  const deciderIds = [...new Set(rows.map((r) => r.hrApproverId).filter((x): x is string => !!x))]
  const deciders = deciderIds.length
    ? await db.employee.findMany({
        where: { id: { in: deciderIds } },
        select: { id: true, firstName: true, lastName: true },
      })
    : []
  const nameOf = new Map(deciders.map((d) => [d.id, `${d.firstName} ${d.lastName}`.trim()]))

  return rows.map((r) => {
    const decided = r.status !== "PENDING"
    return {
      id: r.id,
      holidayId: r.holidayId,
      status: r.status as FloatingDecision["status"],
      employee: r.employee,
      reason: r.reason,
      rejectionReason: r.rejectionReason,
      decidedBy: decided ? ((r.hrApproverId && nameOf.get(r.hrApproverId)) ?? "Management") : null,
      decidedAt: decided ? (r.reviewedAt?.toISOString() ?? null) : null,
      managerDecision: (r.managerDecision as FloatingDecision["managerDecision"]) ?? null,
    }
  })
}
