import "server-only"

import { db } from "@/server/db"
import { createAuditLog } from "@/lib/audit"
import { createNotification, createNotifications } from "@/lib/notifications"
import { requireSession, requirePermission, getAuditMeta } from "@/server/action-guard"
import { ok, fail, runAction, serialize, type ActionResult } from "@/server/action-result"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { instantiateChecklist } from "./instantiate"
import { canActOnItem, canComplete, type ChecklistItemState } from "../lib/checklist-rules"
import {
  addItemSchema,
  cancelChecklistSchema,
  reassignItemSchema,
  setItemDoneSchema,
  type AddItemInput,
  type CancelChecklistInput,
  type ReassignItemInput,
  type SetItemDoneInput,
} from "../schemas/checklist.schema"

// =============================================================================
// HR checklists - onboarding and exit clearance
// =============================================================================
// One engine, two processes. A checklist is INSTANTIATED from the tenant's
// template as a snapshot, then worked through by several different people: HR,
// the manager, the employee, and - for an exit - each department head who must
// sign off before relieving can be issued.
//
// The permission scope differs by kind (onboarding:write vs exit:write), so
// every entry point resolves it from the instance rather than taking it on
// trust from the caller.
// =============================================================================

type ChecklistKind = "ONBOARDING" | "EXIT"

/** The scope that may RUN a checklist of this kind. */
export function writeScopeFor(kind: ChecklistKind): string {
  return kind === "EXIT" ? PERMISSIONS.EXIT_WRITE : PERMISSIONS.ONBOARDING_WRITE
}

/** The scope that may VIEW one. */
export function readScopeFor(kind: ChecklistKind): string {
  return kind === "EXIT" ? PERMISSIONS.EXIT_READ : PERMISSIONS.ONBOARDING_READ
}

// ─── Instantiation ───────────────────────────────────────────────────────────

/**
 * Build a checklist AND tell the people who now own something.
 *
 * The building itself lives in ./instantiate, which imports only the database
 * and the pure rules so that seeds and backfills can use it - this module
 * reaches NextAuth through the action guards and cannot be imported by a plain
 * tsx script. Everything inside a request should call this wrapper; a script
 * calls instantiateChecklist directly and decides for itself whether anyone is
 * notified about historical data.
 */
export async function instantiateAndNotify(opts: {
  employeeId: string
  kind: ChecklistKind
  resignationId?: string | null
  anchorDate?: Date | null
  actorId?: string | null
}): Promise<{ id: string; created: boolean } | null> {
  const result = await instantiateChecklist(opts)
  if (!result) return null

  if (result.created && result.assigneeCounts.size > 0) {
    // One notification per person: a department head with three clearances
    // wants one message, not three.
    const label = opts.kind === "EXIT" ? "exit clearance" : "onboarding"
    await createNotifications(
      [...result.assigneeCounts].map(([assigneeId, count]) => ({
        employeeId: assigneeId,
        title: opts.kind === "EXIT" ? "Exit clearance assigned" : "Onboarding tasks assigned",
        message: `You have ${count} ${label} item${count === 1 ? "" : "s"} to action.`,
        type: "info" as const,
        link: "/clearances",
      })),
    )
  }

  return { id: result.id, created: result.created }
}

// ─── Entry points ────────────────────────────────────────────────────────────

/** Start a checklist by hand, from the HR screens. */
export async function startChecklist(
  employeeId: string,
  kind: ChecklistKind,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requirePermission(writeScopeFor(kind))

    const employee = await db.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, firstName: true, lastName: true, employeeNo: true },
    })
    if (!employee) return fail("Employee not found", undefined, 404)

    const result = await instantiateAndNotify({ employeeId, kind, actorId: session.user.id })
    if (!result) {
      return fail(
        `No ${kind === "EXIT" ? "exit clearance" : "onboarding"} template is set up yet. An administrator can create one under Admin.`,
        undefined,
        409,
      )
    }
    if (!result.created) {
      return fail("That employee already has an open checklist of this kind", undefined, 409)
    }

    await createAuditLog(session, {
      action: kind === "EXIT" ? "exit_checklist:start" : "onboarding_checklist:start",
      module: kind === "EXIT" ? "exit" : "onboarding",
      entityType: "ChecklistInstance",
      entityId: result.id,
      changes: { employeeId, kind },
      ...(await getAuditMeta()),
    })

    return ok(serialize({ data: { id: result.id } }))
  })
}

/**
 * Tick or untick one item.
 *
 * A CLEARANCE may only be signed by its assignee or an HR-scoped override -
 * that is what makes it a sign-off rather than a checkbox. The write uses a
 * conditional updateMany so two people clicking at once cannot both "win":
 * the second sees zero rows affected and is told the state already changed.
 */
export async function setItemDone(
  itemId: string,
  body: SetItemDoneInput,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requireSession()
    const input = setItemDoneSchema.parse(body)

    const item = await db.checklistInstanceItem.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        itemKind: true,
        assigneeId: true,
        isDone: true,
        text: true,
        instance: {
          select: { id: true, kind: true, status: true, employeeId: true },
        },
      },
    })
    if (!item) return fail("Checklist item not found", undefined, 404)
    if (item.instance.status !== "IN_PROGRESS") {
      return fail("This checklist is closed", undefined, 409)
    }

    const kind = item.instance.kind as ChecklistKind
    const hasWrite = hasPermission(session, writeScopeFor(kind))
    // The employee's own items are theirs to tick - preparing the handover
    // document is the leaver's job, and they are the one who knows it is done.
    const isOwnItem = item.assigneeId === session.user.id
    if (!canActOnItem(item, session.user.id, hasWrite) && !isOwnItem) {
      return fail("This item is assigned to somebody else", undefined, 403)
    }

    const claimed = await db.checklistInstanceItem.updateMany({
      where: { id: itemId, isDone: item.isDone },
      data: input.done
        ? { isDone: true, doneAt: new Date(), doneById: session.user.id, note: input.note || null }
        : // Clearing doneAt alongside isDone is required, not tidiness: the
          // checklist_instance_items_done_attributed CHECK refuses a done row
          // with no timestamp, so the two always move together.
          { isDone: false, doneAt: null, doneById: null, note: input.note || null },
    })
    if (claimed.count === 0) {
      return fail("Somebody else just changed this item - reload to see it", undefined, 409)
    }

    if (item.itemKind === "CLEARANCE" && input.done) {
      await createAuditLog(session, {
        action: "exit_clearance:sign",
        module: "exit",
        entityType: "ChecklistInstanceItem",
        entityId: itemId,
        changes: { text: item.text, note: input.note || null },
        ...(await getAuditMeta()),
      })
    }

    return ok(serialize({ data: { id: itemId, isDone: input.done } }))
  })
}

/** Hand one item to a named person - a stand-in while a head is away. */
export async function reassignItem(
  itemId: string,
  body: ReassignItemInput,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const input = reassignItemSchema.parse(body)

    const item = await db.checklistInstanceItem.findUnique({
      where: { id: itemId },
      select: { id: true, text: true, instance: { select: { kind: true, status: true } } },
    })
    if (!item) return fail("Checklist item not found", undefined, 404)
    if (item.instance.status !== "IN_PROGRESS") {
      return fail("This checklist is closed", undefined, 409)
    }

    const kind = item.instance.kind as ChecklistKind
    const session = await requirePermission(writeScopeFor(kind))

    if (input.assigneeId) {
      const target = await db.employee.findFirst({
        where: { id: input.assigneeId, isActive: true },
        select: { id: true, firstName: true, lastName: true },
      })
      if (!target) return fail("That person is not an active employee", undefined, 404)

      await db.checklistInstanceItem.update({
        where: { id: itemId },
        data: { assigneeId: input.assigneeId },
      })
      await createNotification({
        employeeId: input.assigneeId,
        title: "Checklist item assigned to you",
        message: `"${item.text}" is now yours to action.`,
        type: "info",
        link: "/clearances",
      })
    } else {
      await db.checklistInstanceItem.update({ where: { id: itemId }, data: { assigneeId: null } })
    }

    await createAuditLog(session, {
      action: "checklist_item:reassign",
      module: kind === "EXIT" ? "exit" : "onboarding",
      entityType: "ChecklistInstanceItem",
      entityId: itemId,
      changes: { assigneeId: input.assigneeId },
      ...(await getAuditMeta()),
    })

    return ok(serialize({ data: { id: itemId } }))
  })
}

/** Add an item to a live checklist - "one more department to clear". */
export async function addItem(
  instanceId: string,
  body: AddItemInput,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const input = addItemSchema.parse(body)

    const instance = await db.checklistInstance.findUnique({
      where: { id: instanceId },
      select: { id: true, kind: true, status: true },
    })
    if (!instance) return fail("Checklist not found", undefined, 404)
    if (instance.status !== "IN_PROGRESS") return fail("This checklist is closed", undefined, 409)

    const kind = instance.kind as ChecklistKind
    const session = await requirePermission(writeScopeFor(kind))

    const last = await db.checklistInstanceItem.findFirst({
      where: { instanceId },
      orderBy: { displayOrder: "desc" },
      select: { displayOrder: true },
    })

    const created = await db.checklistInstanceItem.create({
      data: {
        instanceId,
        sectionTitle: input.sectionTitle,
        text: input.text,
        helpText: input.helpText || null,
        itemKind: input.itemKind,
        // Ad-hoc items are assigned directly, so the role is only a label.
        assigneeRole: input.assigneeId ? "DEPARTMENT_HEAD" : "HR",
        assigneeId: input.assigneeId ?? null,
        isRequired: input.isRequired,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        displayOrder: (last?.displayOrder ?? 0) + 1,
        isAdHoc: true,
      },
      select: { id: true },
    })

    if (input.assigneeId) {
      await createNotification({
        employeeId: input.assigneeId,
        title:
          input.itemKind === "CLEARANCE" ? "Clearance assigned to you" : "Checklist item assigned",
        message: `"${input.text}" is yours to action.`,
        type: "info",
        link: "/clearances",
      })
    }

    await createAuditLog(session, {
      action: "checklist_item:add",
      module: kind === "EXIT" ? "exit" : "onboarding",
      entityType: "ChecklistInstanceItem",
      entityId: created.id,
      changes: { text: input.text, itemKind: input.itemKind },
      ...(await getAuditMeta()),
    })

    return ok(serialize({ data: { id: created.id } }))
  })
}

/** Abandon a checklist - a withdrawn resignation, a joiner who never started. */
export async function cancelChecklist(
  instanceId: string,
  body: CancelChecklistInput,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const input = cancelChecklistSchema.parse(body)

    const instance = await db.checklistInstance.findUnique({
      where: { id: instanceId },
      select: { id: true, kind: true, status: true },
    })
    if (!instance) return fail("Checklist not found", undefined, 404)
    if (instance.status !== "IN_PROGRESS") {
      return fail("This checklist is already closed", undefined, 409)
    }

    const kind = instance.kind as ChecklistKind
    const session = await requirePermission(writeScopeFor(kind))

    await db.checklistInstance.update({
      where: { id: instanceId },
      data: { status: "CANCELLED", cancelReason: input.reason || null },
    })

    await createAuditLog(session, {
      action: "checklist:cancel",
      module: kind === "EXIT" ? "exit" : "onboarding",
      entityType: "ChecklistInstance",
      entityId: instanceId,
      changes: { reason: input.reason || null },
      ...(await getAuditMeta()),
    })

    return ok(serialize({ data: { id: instanceId } }))
  })
}

/**
 * Finish an ONBOARDING checklist.
 *
 * Exits do not come through here - completing one deactivates an account and
 * issues relieving, so it has its own guarded path in clearance.service.ts.
 */
export async function completeOnboarding(instanceId: string): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.ONBOARDING_WRITE)

    const instance = await db.checklistInstance.findUnique({
      where: { id: instanceId },
      select: {
        id: true,
        kind: true,
        status: true,
        employeeId: true,
        items: { select: { id: true, text: true, itemKind: true, isRequired: true, isDone: true } },
      },
    })
    if (!instance) return fail("Checklist not found", undefined, 404)
    if (instance.kind !== "ONBOARDING") {
      return fail("Use the exit clearance screen to complete an exit", undefined, 400)
    }
    if (instance.status !== "IN_PROGRESS") return fail("Already closed", undefined, 409)

    const gate = canComplete(instance.items as ChecklistItemState[])
    if (!gate.ok) {
      return fail(
        `Sign off the remaining clearance${gate.blocking.length === 1 ? "" : "s"} first: ${gate.blocking
          .map((b) => b.text)
          .join(", ")}`,
        { blocking: gate.blocking },
        409,
      )
    }

    await db.checklistInstance.update({
      where: { id: instanceId },
      data: { status: "COMPLETED", completedAt: new Date(), completedById: session.user.id },
    })

    await createAuditLog(session, {
      action: "onboarding_checklist:complete",
      module: "onboarding",
      entityType: "ChecklistInstance",
      entityId: instanceId,
      changes: { employeeId: instance.employeeId },
      ...(await getAuditMeta()),
    })

    return ok(serialize({ data: { id: instanceId } }))
  })
}
