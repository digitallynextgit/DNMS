import "server-only"

import type { Prisma } from "@prisma/client"
import type { Session } from "next-auth"
import { db, type DbTransaction } from "@/server/db"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import { addDays, latestCalendarDay, todayUtc } from "@/lib/dates"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { isOpenStatus, type DeliverableStatus } from "../lib/deliverable-lifecycle"
import { resolveTaskManagerId } from "../lib/task-permissions"
import { dedupeLinks, isSafeHttpUrl } from "../lib/task-links"
import { canAccessTask, canManageProject } from "./project-access"

// What was done on a task, day by day. The assignee can always log, whoever raised the task; units
// logged add to the made count of the deliverable the task is part of while it is still owed.

const MAX_NOTE = 2000
const MAX_LOG_QUANTITY = 10_000
const MAX_LOG_LINKS = 10
/** Members may back-fill this far; managers any time. */
const BACKFILL_DAYS = 90
/** How long the author may take a log back; managers any time. */
const UNDO_DAYS = 7

export interface TaskWorkLogEntry {
  id: string
  workedOn: string
  note: string
  quantity: number | null
  links: string[]
  employeeId: string
  employeeName: string
  createdAt: string
  canDelete: boolean
}

/** Where the task sits: goal (and its parent) › deliverable. */
export interface TaskChain {
  goal: { id: string; title: string; parentTitle: string | null; service: string | null } | null
  deliverable: {
    id: string
    title: string
    type: string
    quantity: number
    made: number
    status: string
  } | null
}

export interface TaskWork {
  chain: TaskChain
  logs: TaskWorkLogEntry[]
  canLog: boolean
}

const ymd = (d: Date) => d.toISOString().slice(0, 10)

/** The deliverable's count as it is now, locked until the transaction ends - two logs can't race. */
async function lockDeliverable(tx: DbTransaction, id: string) {
  const [row] = await tx.$queryRaw<
    {
      quantity: number
      delivered_quantity: number
      status: string
      employee_id: string | null
      started_on: Date | null
    }[]
  >`SELECT quantity, delivered_quantity, status::text AS status, employee_id, started_on
    FROM project_deliverables WHERE id = ${id} FOR UPDATE`
  return row ?? null
}

async function taskAccess(session: Session, taskId: string) {
  const task = await db.projectTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      title: true,
      projectId: true,
      teamId: true,
      assigneeId: true,
      creatorId: true,
      team: { select: { managerId: true } },
      assignee: { select: { managerId: true } },
      goal: {
        select: { id: true, title: true, service: true, parent: { select: { title: true } } },
      },
      deliverable: {
        select: {
          id: true,
          title: true,
          type: true,
          quantity: true,
          deliveredQuantity: true,
          status: true,
          employeeId: true,
          startedOn: true,
        },
      },
    },
  })
  if (!task) throw new NotFoundError("Task")
  const me = session.user.id
  const managerId = resolveTaskManagerId({
    teamId: task.teamId,
    teamManagerId: task.team?.managerId,
    assigneeManagerId: task.assignee?.managerId,
  })
  const manager =
    hasPermission(session, PERMISSIONS.PROJECT_WRITE) ||
    managerId === me ||
    (task.projectId ? await canManageProject(session, task.projectId) : false)
  const canLog = manager || task.assigneeId === me
  // Whoever may open the task may read its log.
  if (!canLog && !(await canAccessTask(session, taskId))) throw new NotFoundError("Task")
  return { task, canLog, manager }
}

export async function getTaskWork(session: Session, taskId: string): Promise<TaskWork> {
  const { task, canLog, manager } = await taskAccess(session, taskId)
  const logs = await db.taskWorkLog.findMany({
    where: { taskId },
    orderBy: [{ workedOn: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      workedOn: true,
      note: true,
      quantity: true,
      links: true,
      employeeId: true,
      createdAt: true,
      employee: { select: { firstName: true, lastName: true } },
    },
  })
  const undoFrom = addDays(new Date(), -UNDO_DAYS)
  const d = task.deliverable
  return {
    chain: {
      goal: task.goal
        ? {
            id: task.goal.id,
            title: task.goal.title,
            parentTitle: task.goal.parent?.title ?? null,
            service: task.goal.service,
          }
        : null,
      deliverable: d
        ? {
            id: d.id,
            title: d.title,
            type: d.type,
            quantity: d.quantity,
            made: d.deliveredQuantity,
            status: d.status,
          }
        : null,
    },
    logs: logs.map((l) => ({
      id: l.id,
      workedOn: ymd(l.workedOn),
      note: l.note,
      quantity: l.quantity,
      links: l.links,
      employeeId: l.employeeId,
      employeeName: `${l.employee.firstName} ${l.employee.lastName ?? ""}`.trim(),
      createdAt: l.createdAt.toISOString(),
      canDelete: manager || (l.employeeId === session.user.id && l.createdAt >= undoFrom),
    })),
    canLog,
  }
}

function parseWorkedOn(value: unknown, manager: boolean): Date {
  if (value === undefined || value === null || value === "") return todayUtc()
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationError("The date must look like YYYY-MM-DD.")
  }
  const d = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) throw new ValidationError("That date is not a real date.")
  if (d > latestCalendarDay()) throw new ValidationError("Work can't be logged for a future day.")
  if (!manager && d < addDays(todayUtc(), -BACKFILL_DAYS)) {
    throw new ValidationError(
      `Work older than ${BACKFILL_DAYS} days is logged by the team manager.`,
    )
  }
  return d
}

export async function addTaskWorkLog(
  session: Session,
  taskId: string,
  input: { workedOn?: unknown; note?: unknown; quantity?: unknown; links?: unknown },
): Promise<{ id: string }> {
  const { task, canLog, manager } = await taskAccess(session, taskId)
  if (!canLog) {
    throw new ForbiddenError("Only the person on this task, or their manager, can log work on it.")
  }
  const note = typeof input.note === "string" ? input.note.trim() : ""
  if (!note) throw new ValidationError("Say what was done.")
  if (note.length > MAX_NOTE) throw new ValidationError("Keep a work log under 2000 characters.")
  const workedOn = parseWorkedOn(input.workedOn, manager)

  let quantity: number | null = null
  if (input.quantity !== undefined && input.quantity !== null && input.quantity !== "") {
    const q = Number(input.quantity)
    if (!Number.isInteger(q) || q < 1 || q > MAX_LOG_QUANTITY) {
      throw new ValidationError("How many were made is a whole number, 1 or more.")
    }
    if (!task.deliverable) {
      throw new ValidationError(
        "This task is not part of a deliverable, so there is nothing to count.",
      )
    }
    if (!isOpenStatus(task.deliverable.status)) {
      throw new ValidationError(
        "That deliverable is already made - there is nothing left to count.",
      )
    }
    quantity = q
  }
  const links = Array.isArray(input.links)
    ? dedupeLinks(input.links.filter((l): l is string => typeof l === "string" && isSafeHttpUrl(l)))
    : []
  if (links.length > MAX_LOG_LINKS) throw new ValidationError("Add at most 10 links to a log.")

  return db.$transaction(async (tx) => {
    const log = await tx.taskWorkLog.create({
      data: { taskId, employeeId: session.user.id, workedOn, note, quantity, links },
      select: { id: true },
    })
    const d = quantity && task.deliverable ? await lockDeliverable(tx, task.deliverable.id) : null
    if (quantity && d && task.deliverable) {
      const id = task.deliverable.id
      if (!isOpenStatus(d.status as DeliverableStatus)) {
        throw new ValidationError(
          "That deliverable is already made - there is nothing left to count.",
        )
      }
      // Refused rather than capped, so taking the log back later takes off exactly what it added.
      const left = d.quantity - d.delivered_quantity
      if (quantity > left) {
        throw new ValidationError(
          left > 0
            ? `Only ${left} of ${d.quantity} are left to make on this deliverable.`
            : `All ${d.quantity} are already counted as made.`,
        )
      }
      const made = d.delivered_quantity + quantity
      const data: Prisma.ProjectDeliverableUncheckedUpdateInput = { deliveredQuantity: made }
      const changes: Record<string, [unknown, unknown]> = {
        deliveredQuantity: [d.delivered_quantity, made],
      }
      const starting = d.status === "PLANNED"
      // Logged work means it has started; a started row has a maker.
      if (starting) {
        data.status = "IN_PROGRESS"
        data.startedOn = d.started_on ?? workedOn
        changes.status = ["PLANNED", "IN_PROGRESS"]
        if (!d.employee_id) {
          const maker = task.assigneeId ?? session.user.id
          data.employeeId = maker
          changes.employeeId = [null, maker]
        }
      }
      await tx.projectDeliverable.update({ where: { id }, data })
      await tx.projectDeliverableEvent.create({
        data: {
          deliverableId: id,
          type: starting ? "STATUS_CHANGED" : "EDITED",
          fromStatus: starting ? "PLANNED" : undefined,
          toStatus: starting ? "IN_PROGRESS" : undefined,
          changes,
          reason: `+${quantity} from the task "${task.title}"`,
          actorId: session.user.id,
        },
      })
    }
    return log
  })
}

export async function deleteTaskWorkLog(
  session: Session,
  taskId: string,
  logId: string,
): Promise<void> {
  const { task, manager } = await taskAccess(session, taskId)
  const log = await db.taskWorkLog.findFirst({
    where: { id: logId, taskId },
    select: { id: true, employeeId: true, quantity: true, createdAt: true },
  })
  if (!log) throw new NotFoundError("Work log")
  const ownRecent =
    log.employeeId === session.user.id && log.createdAt >= addDays(new Date(), -UNDO_DAYS)
  if (!manager && !ownRecent) {
    throw new ForbiddenError(
      `You can take back your own log for ${UNDO_DAYS} days; after that ask the team manager.`,
    )
  }
  await db.$transaction(async (tx) => {
    await tx.taskWorkLog.delete({ where: { id: log.id } })
    const id = task.deliverable?.id
    const d = log.quantity && id ? await lockDeliverable(tx, id) : null
    // Once made, the count is the maker's word; removing a log no longer moves it.
    if (log.quantity && id && d && isOpenStatus(d.status as DeliverableStatus)) {
      const made = Math.max(0, d.delivered_quantity - log.quantity)
      await tx.projectDeliverable.update({ where: { id }, data: { deliveredQuantity: made } })
      await tx.projectDeliverableEvent.create({
        data: {
          deliverableId: id,
          type: "EDITED",
          changes: { deliveredQuantity: [d.delivered_quantity, made] },
          reason: `-${log.quantity}: a work log on "${task.title}" was removed`,
          actorId: session.user.id,
        },
      })
    }
  })
}
