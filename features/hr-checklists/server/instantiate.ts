import "server-only"

import { db } from "@/server/db"
import { itemDueDate, resolveAssignee } from "../lib/checklist-rules"

// =============================================================================
// Building a checklist from a template.
// =============================================================================
// Split out of checklists.service.ts DELIBERATELY, and the reason is a real
// constraint rather than tidiness: that service imports the action guards,
// which import the API handler, which imports NextAuth - and NextAuth reaches
// React client code. Anything that touches it therefore cannot be imported by a
// plain `tsx` script (`React.createContext is not a function`), which rules out
// seeds, backfills and one-off data fixes.
//
// Creating rows from a template needs none of that. This module imports only
// the database and the pure rules, so it works identically inside a request and
// from a standalone script.
//
// It also does NOT notify. The caller owns that: notification needs the session
// (to suppress the hidden admin_ role), and a backfill writing historical data
// should be able to choose whether anybody is told.
// =============================================================================

export type ChecklistKind = "ONBOARDING" | "EXIT"

export interface InstantiateResult {
  id: string
  created: boolean
  /**
   * assigneeId -> how many items they now own, excluding the subject's own
   * items. What the caller needs to send one message per person rather than one
   * per item.
   */
  assigneeCounts: Map<string, number>
}

export async function instantiateChecklist(opts: {
  employeeId: string
  kind: ChecklistKind
  resignationId?: string | null
  /** Overrides the employee's own date. Exit passes the agreed last working day. */
  anchorDate?: Date | null
  actorId?: string | null
}): Promise<InstantiateResult | null> {
  const { employeeId, kind, resignationId = null, actorId = null } = opts

  const existing = await db.checklistInstance.findFirst({
    where: { employeeId, kind, status: "IN_PROGRESS" },
    select: { id: true },
  })
  if (existing) return { id: existing.id, created: false, assigneeCounts: new Map() }

  const template = await db.checklistTemplate.findFirst({
    where: { kind, isActive: true },
    select: {
      id: true,
      sections: {
        orderBy: { displayOrder: "asc" },
        select: {
          title: true,
          items: {
            orderBy: { displayOrder: "asc" },
            select: {
              text: true,
              helpText: true,
              itemKind: true,
              assigneeRole: true,
              clearanceDepartmentId: true,
              isRequired: true,
              offsetDays: true,
            },
          },
        },
      },
    },
  })
  // No template is a real state - a tenant provisioned before this feature and
  // not yet backfilled. Returning null lets the caller carry on rather than
  // failing an employee creation over a missing checklist.
  if (!template) return null

  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      managerId: true,
      dateOfJoining: true,
      lastWorkingDate: true,
      department: { select: { headId: true } },
    },
  })
  if (!employee) return null

  const anchorDate =
    opts.anchorDate !== undefined
      ? opts.anchorDate
      : kind === "EXIT"
        ? employee.lastWorkingDate
        : employee.dateOfJoining

  // Resolve every clearance department's head in ONE query rather than per item.
  const departmentIds = [
    ...new Set(
      template.sections
        .flatMap((s) => s.items)
        .map((i) => i.clearanceDepartmentId)
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  const departments = departmentIds.length
    ? await db.department.findMany({
        where: { id: { in: departmentIds } },
        select: { id: true, headId: true },
      })
    : []
  const headByDepartment = new Map(departments.map((d) => [d.id, d.headId]))

  const instance = await db.checklistInstance.create({
    data: {
      kind,
      employeeId,
      resignationId,
      templateId: template.id,
      anchorDate,
      startedById: actorId,
    },
    select: { id: true },
  })

  const rows = []
  let order = 0
  for (const section of template.sections) {
    for (const item of section.items) {
      rows.push({
        instanceId: instance.id,
        sectionTitle: section.title,
        text: item.text,
        helpText: item.helpText,
        itemKind: item.itemKind,
        assigneeRole: item.assigneeRole,
        assigneeId: resolveAssignee(item.assigneeRole, {
          employeeId: employee.id,
          managerId: employee.managerId,
          departmentHeadId: employee.department?.headId ?? null,
          clearanceDepartmentHeadId: item.clearanceDepartmentId
            ? (headByDepartment.get(item.clearanceDepartmentId) ?? null)
            : null,
        }),
        isRequired: item.isRequired,
        dueDate: itemDueDate(anchorDate, item.offsetDays),
        displayOrder: order++,
      })
    }
  }

  // ── SEPARATE top-level createMany, NOT nested under the instance above ──────
  // The tenant guard stamps top-level writes but NOT nested ones, so
  // `create({ data: { ..., items: { create: rows } } })` would leave every item
  // on the founding tenant's column default - the wrong company entirely.
  if (rows.length > 0) await db.checklistInstanceItem.createMany({ data: rows })

  const assigneeCounts = new Map<string, number>()
  for (const row of rows) {
    if (!row.assigneeId || row.assigneeId === employeeId) continue
    assigneeCounts.set(row.assigneeId, (assigneeCounts.get(row.assigneeId) ?? 0) + 1)
  }

  return { id: instance.id, created: true, assigneeCounts }
}
