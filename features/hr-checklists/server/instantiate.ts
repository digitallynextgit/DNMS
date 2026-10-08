import "server-only"

import { db } from "@/server/db"
import { itemDueDate, resolveAssignee } from "../lib/checklist-rules"

// Kept out of checklists.service.ts so plain tsx scripts can import it (that service pulls in
// NextAuth). It doesn't notify - the caller decides.

export type ChecklistKind = "ONBOARDING" | "EXIT"

export interface InstantiateResult {
  id: string
  created: boolean
  /** assigneeId -> items they now own (excluding the subject's), for one message per person. */
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
  // No template is a valid state for an older tenant; don't fail employee creation over it.
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

  // Top-level createMany, not nested: the tenant guard doesn't stamp nested writes.
  if (rows.length > 0) await db.checklistInstanceItem.createMany({ data: rows })

  const assigneeCounts = new Map<string, number>()
  for (const row of rows) {
    if (!row.assigneeId || row.assigneeId === employeeId) continue
    assigneeCounts.set(row.assigneeId, (assigneeCounts.get(row.assigneeId) ?? 0) + 1)
  }

  return { id: instance.id, created: true, assigneeCounts }
}
