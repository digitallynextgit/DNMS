import "server-only"

import { db } from "@/server/db"
import { hasPermission } from "@/lib/permissions"
import { requireSession, requirePermission } from "@/server/action-guard"
import { ok, fail, runAction, serialize, type ActionResult } from "@/server/action-result"
import { resolvePagination, paginationMeta } from "@/lib/pagination"
import { checklistProgress, type ChecklistItemState } from "../lib/checklist-rules"
import { checklistListQuerySchema, type ChecklistListQuery } from "../schemas/checklist.schema"
import { readScopeFor, writeScopeFor } from "./checklists.service"

// =============================================================================
// Reads for the checklist screens.
// =============================================================================

const EMPLOYEE_CARD_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  employeeNo: true,
  profilePhoto: true,
  designation: { select: { title: true } },
  department: { select: { name: true } },
} as const

const ITEM_SELECT = {
  id: true,
  sectionTitle: true,
  text: true,
  helpText: true,
  itemKind: true,
  assigneeRole: true,
  assigneeId: true,
  isRequired: true,
  dueDate: true,
  displayOrder: true,
  isAdHoc: true,
  isDone: true,
  doneAt: true,
  note: true,
  assignee: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
  doneBy: { select: { id: true, firstName: true, lastName: true } },
} as const

/** HR's list of checklists of one kind. */
export async function listChecklists(
  query: Partial<ChecklistListQuery>,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const input = checklistListQuerySchema.parse(query)
    await requirePermission(readScopeFor(input.kind))

    const { page, limit, skip, take } = resolvePagination(input, 20)

    const where = {
      kind: input.kind,
      ...(input.status === "ALL" ? {} : { status: input.status }),
      ...(input.search
        ? {
            employee: {
              OR: [
                { firstName: { contains: input.search, mode: "insensitive" as const } },
                { lastName: { contains: input.search, mode: "insensitive" as const } },
                { employeeNo: { contains: input.search, mode: "insensitive" as const } },
              ],
            },
          }
        : {}),
    }

    const [rows, total] = await Promise.all([
      db.checklistInstance.findMany({
        where,
        select: {
          id: true,
          kind: true,
          status: true,
          anchorDate: true,
          completedAt: true,
          createdAt: true,
          employee: { select: EMPLOYEE_CARD_SELECT },
          // Counts only - the list draws a progress bar, not the items.
          items: {
            select: { itemKind: true, isRequired: true, isDone: true, id: true, text: true },
          },
        },
        orderBy: [{ status: "asc" }, { anchorDate: "asc" }, { createdAt: "desc" }],
        skip,
        take,
      }),
      db.checklistInstance.count({ where }),
    ])

    const data = rows.map((row) => {
      const { items, ...rest } = row
      return { ...rest, progress: checklistProgress(items as ChecklistItemState[]) }
    })

    return ok(serialize({ data, pagination: paginationMeta(total, page, limit) }))
  })
}

/**
 * One checklist in full.
 *
 * Readable by anyone holding the read scope, by the employee it is about, and
 * by anyone who owns an item on it - a Finance head has no HR scope at all and
 * still has to see the exit they are being asked to sign.
 */
export async function getChecklist(instanceId: string): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requireSession()

    const instance = await db.checklistInstance.findUnique({
      where: { id: instanceId },
      select: {
        id: true,
        kind: true,
        status: true,
        anchorDate: true,
        cancelReason: true,
        completedAt: true,
        createdAt: true,
        employee: {
          select: { ...EMPLOYEE_CARD_SELECT, dateOfJoining: true, lastWorkingDate: true },
        },
        completedBy: { select: { id: true, firstName: true, lastName: true } },
        resignation: {
          select: { id: true, status: true, requestedLastWorkingDate: true, reason: true },
        },
        items: { select: ITEM_SELECT, orderBy: { displayOrder: "asc" } },
      },
    })
    if (!instance) return fail("Checklist not found", undefined, 404)

    const kind = instance.kind as "ONBOARDING" | "EXIT"
    const canRead = hasPermission(session, readScopeFor(kind))
    const canWrite = hasPermission(session, writeScopeFor(kind))
    const isSubject = instance.employee.id === session.user.id
    const ownsAnItem = instance.items.some((i) => i.assigneeId === session.user.id)

    if (!canRead && !canWrite && !isSubject && !ownsAnItem) {
      return fail("You do not have access to this checklist", undefined, 403)
    }

    const progress = checklistProgress(instance.items as ChecklistItemState[])

    return ok(
      serialize({
        data: {
          ...instance,
          progress,
          // What THIS viewer may do, so the UI never offers a button the server
          // will refuse.
          canWrite,
          myItemIds: instance.items
            .filter((i) => i.assigneeId === session.user.id)
            .map((i) => i.id),
        },
      }),
    )
  })
}

/**
 * "Awaiting my sign-off" - every open item assigned to the caller.
 *
 * Needs NO permission scope. The people this exists for - a Finance head, an
 * IT lead, a reporting manager - hold no HR scope, and gating it would lock out
 * exactly the population the feature depends on.
 */
export async function getMyChecklistItems(): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requireSession()

    const items = await db.checklistInstanceItem.findMany({
      where: {
        assigneeId: session.user.id,
        isDone: false,
        instance: { status: "IN_PROGRESS" },
      },
      select: {
        ...ITEM_SELECT,
        instance: {
          select: {
            id: true,
            kind: true,
            anchorDate: true,
            employee: { select: EMPLOYEE_CARD_SELECT },
          },
        },
      },
      // Clearances first - they are what blocks somebody's relieving letter -
      // then by due date, soonest first.
      orderBy: [{ itemKind: "desc" }, { dueDate: "asc" }],
      take: 100,
    })

    return ok(serialize({ data: items }))
  })
}

/** Badge count for the sidebar. Cheap: a count, not the rows. */
export async function getMyPendingItemCount(): Promise<ActionResult<{ count: number }>> {
  return runAction(async () => {
    const session = await requireSession()
    const count = await db.checklistInstanceItem.count({
      where: {
        assigneeId: session.user.id,
        isDone: false,
        instance: { status: "IN_PROGRESS" },
      },
    })
    return ok({ count })
  })
}

/** The checklists for one employee, for their profile page. */
export async function getChecklistsForEmployee(employeeId: string): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requireSession()
    const isSelf = session.user.id === employeeId
    const canRead =
      hasPermission(session, readScopeFor("ONBOARDING")) ||
      hasPermission(session, readScopeFor("EXIT"))
    if (!isSelf && !canRead) return fail("Not allowed", undefined, 403)

    const rows = await db.checklistInstance.findMany({
      where: { employeeId },
      select: {
        id: true,
        kind: true,
        status: true,
        anchorDate: true,
        completedAt: true,
        items: { select: { id: true, text: true, itemKind: true, isRequired: true, isDone: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    const data = rows.map((row) => {
      const { items, ...rest } = row
      return { ...rest, progress: checklistProgress(items as ChecklistItemState[]) }
    })

    return ok(serialize({ data }))
  })
}
