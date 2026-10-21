import "server-only"

import type { Session } from "next-auth"
import { db } from "@/server/db"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import { createNotification } from "@/lib/notifications"
import { assignRefusal, assignableIds } from "../lib/task-assign"
import { isOpenStatus } from "../lib/deliverable-lifecycle"
import { myWorkHref } from "../lib/project-href"
import { teamAssignContext, type TeamAssignContext } from "./task-assign.service"
import { openFirstStatusPeriod } from "./task-status-periods"

// One planned deliverable, split into tasks for the team's people. Each task belongs to the
// deliverable (and so its goal); work logged on them adds to the deliverable's made count.

const MAX_SPLIT = 30
const MAX_TITLE = 200

export interface SplitLine {
  title: string
  assigneeId: string
  /** yyyy-MM-dd; defaults to the deliverable's due day. */
  dueDate?: string | null
  estimatedHours?: number | null
}

export interface DeliverableTaskRow {
  id: string
  title: string
  status: string
  assigneeId: string | null
  assigneeName: string | null
  dueDate: string | null
  loggedHours: number
  /** Units logged through this task's work logs. */
  logged: number
}

export interface DeliverableTasks {
  /** The deliverable itself, so a link to it can open with nothing else loaded. */
  deliverable: {
    id: string
    title: string
    type: string
    quantity: number
    made: number
    status: string
    dueOn: string | null
    teamName: string | null
    goal: { id: string; title: string } | null
  }
  tasks: DeliverableTaskRow[]
  /** Whom the caller may give a task on this deliverable to. Empty when they can't split it. */
  assignable: { id: string; name: string }[]
  canSplit: boolean
}

const ymd = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)

async function loadDeliverable(projectId: string, id: string) {
  const row = await db.projectDeliverable.findFirst({
    where: { id, projectId },
    select: {
      id: true,
      title: true,
      status: true,
      teamId: true,
      employeeId: true,
      goalId: true,
      dueOn: true,
      type: true,
      quantity: true,
      deliveredQuantity: true,
      team: { select: { name: true } },
      goal: { select: { id: true, title: true } },
    },
  })
  if (!row) throw new NotFoundError("Deliverable")
  return row
}

/** Members of the owing team, its manager and the project's managers may split it. */
function maySplit(ctx: TeamAssignContext | null, me: string): boolean {
  return !!ctx && (ctx.canAssignAnyone || ctx.teamMemberIds.includes(me))
}

export async function getDeliverableTasks(
  session: Session,
  projectId: string,
  deliverableId: string,
): Promise<DeliverableTasks> {
  const d = await loadDeliverable(projectId, deliverableId)
  const ctx = d.teamId ? await teamAssignContext(session, projectId, d.teamId) : null
  const canSplit = isOpenStatus(d.status) && maySplit(ctx, session.user.id)
  const tasks = await db.projectTask.findMany({
    where: { deliverableId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      status: true,
      assigneeId: true,
      dueDate: true,
      loggedHours: true,
      assignee: { select: { firstName: true, lastName: true } },
      workLogs: { select: { quantity: true } },
    },
  })
  return {
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      assigneeId: t.assigneeId,
      assigneeName: t.assignee
        ? `${t.assignee.firstName} ${t.assignee.lastName ?? ""}`.trim()
        : null,
      dueDate: ymd(t.dueDate),
      loggedHours: t.loggedHours,
      logged: t.workLogs.reduce((s, l) => s + (l.quantity ?? 0), 0),
    })),
    assignable:
      canSplit && ctx
        ? assignableIds(ctx).map((id) => ({ id, name: ctx.memberNames.get(id) ?? "Member" }))
        : [],
    canSplit,
    deliverable: {
      id: d.id,
      title: d.title,
      type: d.type,
      quantity: d.quantity,
      made: d.deliveredQuantity,
      status: d.status,
      dueOn: ymd(d.dueOn),
      teamName: d.team?.name ?? null,
      goal: d.goal,
    },
  }
}

function parseDue(value: string | null | undefined, fallback: Date | null): Date | null {
  if (!value) return fallback
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new ValidationError("A due date looks like YYYY-MM-DD.")
  const d = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) throw new ValidationError("That due date is not a real date.")
  return d
}

/**
 * Split owed work into tasks. The deliverable is claimed if nobody had (by the caller when they are
 * on the team, else by the first assignee), so it no longer reads as unclaimed.
 */
export async function splitDeliverable(
  session: Session,
  projectId: string,
  deliverableId: string,
  lines: SplitLine[],
): Promise<{ created: number }> {
  const d = await loadDeliverable(projectId, deliverableId)
  if (!isOpenStatus(d.status)) throw new ValidationError("That work is already made.")
  if (!d.teamId) throw new ValidationError("Only work owed by a team can be split into tasks.")
  const ctx = await teamAssignContext(session, projectId, d.teamId)
  const me = session.user.id
  if (!ctx || !maySplit(ctx, me)) {
    throw new ForbiddenError("Only the team that owes this, or its managers, can split it.")
  }

  if (!Array.isArray(lines) || lines.length === 0)
    throw new ValidationError("Add at least one task.")
  if (lines.length > MAX_SPLIT) {
    throw new ValidationError(`That is more than ${MAX_SPLIT} tasks - split it in two goes.`)
  }
  const rows = lines.map((l) => {
    const title = typeof l.title === "string" ? l.title.trim() : ""
    if (!title) throw new ValidationError("Every task needs a title.")
    if (title.length > MAX_TITLE)
      throw new ValidationError("Keep task titles under 200 characters.")
    const refusal = assignRefusal(ctx, l.assigneeId)
    if (refusal) throw new ForbiddenError(refusal)
    const hours = l.estimatedHours
    if (
      hours !== undefined &&
      hours !== null &&
      (!Number.isFinite(hours) || hours < 0 || hours > 500)
    ) {
      throw new ValidationError("Estimated hours must be a number between 0 and 500.")
    }
    return {
      title,
      assigneeId: l.assigneeId,
      dueDate: parseDue(l.dueDate, d.dueOn),
      estimatedHours: hours ?? null,
    }
  })

  const claimer = d.employeeId ? null : ctx.teamMemberIds.includes(me) ? me : rows[0]!.assigneeId
  const created = await db.$transaction(async (tx) => {
    const made: { id: string; assigneeId: string; dueDate: Date | null; title: string }[] = []
    for (const r of rows) {
      const task = await tx.projectTask.create({
        data: {
          projectId,
          teamId: d.teamId,
          title: r.title,
          status: "TODO",
          assigneeId: r.assigneeId,
          creatorId: me,
          dueDate: r.dueDate,
          estimatedHours: r.estimatedHours,
          goalId: d.goalId,
          deliverableId: d.id,
          // Its output is the deliverable's count, fed by work logs - not a new row to log.
          producesOutput: false,
          approvalStatus: "APPROVED",
          isManagerCreated: r.assigneeId !== me,
        },
        select: { id: true },
      })
      await openFirstStatusPeriod(tx, { taskId: task.id, status: "TODO", actorId: me })
      made.push({ id: task.id, ...r })
    }
    if (claimer) {
      await tx.projectDeliverable.update({ where: { id: d.id }, data: { employeeId: claimer } })
    }
    await tx.projectDeliverableEvent.create({
      data: {
        deliverableId: d.id,
        type: "EDITED",
        changes: claimer ? { employeeId: [null, claimer] } : undefined,
        reason: `Split into ${made.length} task${made.length === 1 ? "" : "s"}`,
        actorId: me,
      },
    })
    return made
  })

  const told = new Set<string>()
  for (const t of created) {
    if (t.assigneeId === me || told.has(t.assigneeId)) continue
    told.add(t.assigneeId)
    const mine = created.filter((x) => x.assigneeId === t.assigneeId)
    await createNotification({
      employeeId: t.assigneeId,
      title: mine.length === 1 ? "New task assigned" : `${mine.length} new tasks assigned`,
      message: `${session.user.name ?? "Your manager"} gave you work on "${d.title}" (${ctx.teamName}): ${mine.map((x) => x.title).join(", ")}`,
      type: "info",
      link: myWorkHref({ dueDate: t.dueDate }),
    })
  }
  return { created: created.length }
}
