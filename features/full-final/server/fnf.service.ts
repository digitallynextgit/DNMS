import "server-only"

import { db } from "@/server/db"
import { createAuditLog } from "@/lib/audit"
import { createNotifications } from "@/lib/notifications"
import { requirePermission, getAuditMeta } from "@/server/action-guard"
import { ok, fail, runAction, type ActionResult } from "@/server/action-result"
import { PERMISSIONS } from "@/lib/constants"
import { toDateOnly } from "@/lib/dates"
import {
  DUE_SOON_DAYS,
  daysFrom,
  fnfDueDate,
  fnfStatus,
  indiaToday,
  type NoticePeriod,
} from "../lib/fnf"
import { createFullFinalSchema, updateFullFinalSchema } from "../schemas/fnf.schema"
import type { FullFinalRow } from "../types"

const asDate = (d: string) => new Date(`${d}T00:00:00.000Z`)
const dayOf = (d: Date | null) => (d ? toDateOnly(d) : null)

const ROW_SELECT = {
  id: true,
  employeeId: true,
  name: true,
  designation: true,
  lastWorkingDate: true,
  dueDate: true,
  releasedOn: true,
  noticePeriod: true,
  relievingGiven: true,
  relievingDate: true,
  notes: true,
  employee: {
    select: { id: true, employeeNo: true, firstName: true, lastName: true, profilePhoto: true },
  },
} as const

type Stored = {
  id: string
  employeeId: string | null
  name: string
  designation: string | null
  lastWorkingDate: Date
  dueDate: Date
  releasedOn: Date | null
  noticePeriod: string | null
  relievingGiven: boolean
  relievingDate: Date | null
  notes: string | null
  employee: FullFinalRow["employee"]
}

function toRow(r: Stored, today: string): FullFinalRow {
  const dueDate = toDateOnly(r.dueDate)
  const releasedOn = dayOf(r.releasedOn)
  return {
    id: r.id,
    employeeId: r.employeeId,
    name: r.employee ? `${r.employee.firstName} ${r.employee.lastName}`.trim() : r.name,
    designation: r.designation,
    lastWorkingDate: toDateOnly(r.lastWorkingDate),
    dueDate,
    releasedOn,
    noticePeriod: r.noticePeriod as NoticePeriod | null,
    relievingGiven: r.relievingGiven,
    relievingDate: dayOf(r.relievingDate),
    notes: r.notes,
    employee: r.employee,
    status: fnfStatus({ dueDate, releasedOn }, today),
  }
}

/** Open ones first, most urgent on top; then the settled ones, latest first. */
function byUrgency(a: FullFinalRow, b: FullFinalRow): number {
  if (!a.releasedOn !== !b.releasedOn) return a.releasedOn ? 1 : -1
  if (!a.releasedOn) return a.dueDate.localeCompare(b.dueDate)
  return b.releasedOn!.localeCompare(a.releasedOn!)
}

/**
 * Adds every leaver DNMS knows about - an accepted resignation, or marked Resigned/Terminated -
 * once they have a last working day. While unsettled, a linked row follows the profile's last
 * working day, and its due date too unless HR set one by hand.
 */
export async function syncFullFinalFromExits(employeeId?: string): Promise<number> {
  const leavers = await db.employee.findMany({
    where: {
      ...(employeeId ? { id: employeeId } : {}),
      OR: [
        { resignations: { some: { status: "APPROVED" } } },
        { status: { in: ["RESIGNED", "TERMINATED"] } },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      lastWorkingDate: true,
      designation: { select: { title: true } },
      resignations: {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { requestedLastWorkingDate: true },
      },
      fullFinal: { select: { id: true, lastWorkingDate: true, dueDate: true, releasedOn: true } },
    },
  })

  let added = 0
  for (const e of leavers) {
    // The profile is what HR keeps up to date; the resignation's requested day is the fallback.
    const lwd = e.lastWorkingDate ?? e.resignations[0]?.requestedLastWorkingDate ?? null
    if (!lwd) continue
    const lwdDay = toDateOnly(lwd)
    const row = e.fullFinal
    if (!row) {
      try {
        await db.fullFinalSettlement.create({
          data: {
            employeeId: e.id,
            name: `${e.firstName} ${e.lastName}`.trim(),
            designation: e.designation?.title ?? null,
            lastWorkingDate: asDate(lwdDay),
            dueDate: asDate(fnfDueDate(lwdDay)),
          },
        })
        added++
      } catch (err) {
        // Another request added them first.
        if ((err as { code?: string })?.code !== "P2002") throw err
      }
      continue
    }
    const rowLwd = toDateOnly(row.lastWorkingDate)
    if (row.releasedOn || rowLwd === lwdDay) continue
    const defaultDue = toDateOnly(row.dueDate) === fnfDueDate(rowLwd)
    await db.fullFinalSettlement.update({
      where: { id: row.id },
      data: {
        lastWorkingDate: asDate(lwdDay),
        ...(defaultDue ? { dueDate: asDate(fnfDueDate(lwdDay)) } : {}),
      },
    })
  }
  return added
}

export async function listFullFinal(): Promise<ActionResult<FullFinalRow[]>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.EXIT_READ)
    await syncFullFinalFromExits()
    const rows = await db.fullFinalSettlement.findMany({ select: ROW_SELECT })
    const today = indiaToday()
    return ok(rows.map((r) => toRow(r, today)).sort(byUrgency))
  })
}

export async function createFullFinal(input: unknown): Promise<ActionResult<FullFinalRow>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.EXIT_WRITE)
    const data = createFullFinalSchema.parse(input)

    let name = data.name ?? ""
    let designation = data.designation ?? null
    if (data.employeeId) {
      const emp = await db.employee.findUnique({
        where: { id: data.employeeId },
        select: {
          firstName: true,
          lastName: true,
          designation: { select: { title: true } },
          fullFinal: { select: { id: true } },
        },
      })
      if (!emp) return fail("Employee not found", undefined, 404)
      if (emp.fullFinal) return fail(`${emp.firstName} is already in the register`, undefined, 409)
      name = `${emp.firstName} ${emp.lastName}`.trim()
      designation = designation || emp.designation?.title || null
    }

    const row = await db.fullFinalSettlement.create({
      data: {
        employeeId: data.employeeId ?? null,
        name,
        designation,
        lastWorkingDate: asDate(data.lastWorkingDate),
        dueDate: asDate(data.dueDate ?? fnfDueDate(data.lastWorkingDate)),
        releasedOn: data.releasedOn ? asDate(data.releasedOn) : null,
        noticePeriod: data.noticePeriod ?? null,
        relievingGiven: data.relievingGiven ?? false,
        relievingDate:
          data.relievingGiven && data.relievingDate ? asDate(data.relievingDate) : null,
        notes: data.notes || null,
      },
      select: ROW_SELECT,
    })

    await createAuditLog(session, {
      action: "CREATE",
      module: "exit",
      entityType: "FullFinalSettlement",
      entityId: row.id,
      changes: { name, lastWorkingDate: data.lastWorkingDate },
      ...(await getAuditMeta()),
    })
    return ok(toRow(row, indiaToday()))
  })
}

export async function updateFullFinal(
  id: string,
  input: unknown,
): Promise<ActionResult<FullFinalRow>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.EXIT_WRITE)
    const data = updateFullFinalSchema.parse(input)
    const before = await db.fullFinalSettlement.findUnique({
      where: { id },
      select: { employeeId: true, lastWorkingDate: true, dueDate: true },
    })
    if (!before) return fail("Not found", undefined, 404)

    const linked = !!before.employeeId
    const oldLwd = toDateOnly(before.lastWorkingDate)
    const lwd = data.lastWorkingDate ?? oldLwd
    if (linked && lwd !== oldLwd) {
      return fail(
        "Change their last working day on their profile; this follows it.",
        undefined,
        409,
      )
    }
    // A new last working day moves a due date that was never set by hand.
    const dueDate =
      data.dueDate ??
      (lwd !== oldLwd && toDateOnly(before.dueDate) === fnfDueDate(oldLwd)
        ? fnfDueDate(lwd)
        : toDateOnly(before.dueDate))
    if (dueDate < lwd) return fail("The FnF due date can't be before the last working day")

    const update: Record<string, unknown> = {
      lastWorkingDate: asDate(lwd),
      dueDate: asDate(dueDate),
    }
    if (data.name !== undefined && !linked) update.name = data.name
    if (data.designation !== undefined) update.designation = data.designation || null
    if (data.releasedOn !== undefined)
      update.releasedOn = data.releasedOn ? asDate(data.releasedOn) : null
    if (data.noticePeriod !== undefined) update.noticePeriod = data.noticePeriod
    if (data.relievingGiven !== undefined) update.relievingGiven = data.relievingGiven
    if (data.relievingDate !== undefined)
      update.relievingDate = data.relievingDate ? asDate(data.relievingDate) : null
    if (data.relievingGiven === false) update.relievingDate = null
    if (data.notes !== undefined) update.notes = data.notes || null

    const row = await db.fullFinalSettlement.update({
      where: { id },
      data: update,
      select: ROW_SELECT,
    })
    await createAuditLog(session, {
      action: "UPDATE",
      module: "exit",
      entityType: "FullFinalSettlement",
      entityId: id,
      changes: { fields: Object.keys(data) },
      ...(await getAuditMeta()),
    })
    return ok(toRow(row, indiaToday()))
  })
}

/** Past employees only: a DNMS leaver would just be added back. */
export async function deleteFullFinal(id: string): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.EXIT_WRITE)
    const row = await db.fullFinalSettlement.findUnique({
      where: { id },
      select: { employeeId: true, name: true },
    })
    if (!row) return fail("Not found", undefined, 404)
    if (row.employeeId) {
      return fail(
        "This leaver comes from DNMS and can't be removed; edit it instead.",
        undefined,
        409,
      )
    }
    await db.fullFinalSettlement.delete({ where: { id } })
    await createAuditLog(session, {
      action: "DELETE",
      module: "exit",
      entityType: "FullFinalSettlement",
      entityId: id,
      changes: { name: row.name },
      ...(await getAuditMeta()),
    })
    return ok({ id })
  })
}

/**
 * Completing an exit clearance issues relieving: tick it here with that day. Someone with no last
 * working day on record is entered with that day as it.
 */
export async function markRelievingFromClearance(employeeId: string, at = new Date()) {
  const today = indiaToday(at)
  await syncFullFinalFromExits(employeeId)
  const existing = await db.fullFinalSettlement.findUnique({
    where: { employeeId },
    select: { id: true, relievingGiven: true },
  })
  if (existing) {
    if (!existing.relievingGiven) {
      await db.fullFinalSettlement.update({
        where: { id: existing.id },
        data: { relievingGiven: true, relievingDate: asDate(today) },
      })
    }
    return
  }
  const emp = await db.employee.findUnique({
    where: { id: employeeId },
    select: { firstName: true, lastName: true, designation: { select: { title: true } } },
  })
  if (!emp) return
  await db.fullFinalSettlement.create({
    data: {
      employeeId,
      name: `${emp.firstName} ${emp.lastName}`.trim(),
      designation: emp.designation?.title ?? null,
      lastWorkingDate: asDate(today),
      dueDate: asDate(fnfDueDate(today)),
      relievingGiven: true,
      relievingDate: asDate(today),
    },
  })
}

const shortDate = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })

/**
 * Once a day: tell whoever runs exits (exit:write) about settlements that just came within a week
 * of their due date, or just went past it. Each row is mentioned once per stage.
 */
export async function runFullFinalReminders(
  now = new Date(),
): Promise<{ sent: number; skipped: boolean }> {
  const today = indiaToday(now)
  // Claim the day first: a duplicate reminder is worse than a late one.
  try {
    await db.digestRun.create({
      data: { kind: "full-final-reminders", periodStart: asDate(today) },
    })
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") return { sent: 0, skipped: true }
    throw err
  }

  await syncFullFinalFromExits()
  const open = await db.fullFinalSettlement.findMany({
    where: { releasedOn: null },
    orderBy: { dueDate: "asc" },
    select: {
      id: true,
      name: true,
      dueDate: true,
      dueSoonNotifiedAt: true,
      overdueNotifiedAt: true,
    },
  })
  const overdue = open.filter(
    (r) => !r.overdueNotifiedAt && daysFrom(today, toDateOnly(r.dueDate)) < 0,
  )
  const dueSoon = open.filter((r) => {
    const left = daysFrom(today, toDateOnly(r.dueDate))
    return !r.dueSoonNotifiedAt && left >= 0 && left <= DUE_SOON_DAYS
  })
  if (overdue.length === 0 && dueSoon.length === 0) return { sent: 0, skipped: false }

  const list = (rows: typeof open) =>
    rows.map((r) => `${r.name} (due ${shortDate(r.dueDate)})`).join(", ")
  const message = [
    overdue.length ? `Overdue: ${list(overdue)}.` : "",
    dueSoon.length ? `Due within ${DUE_SOON_DAYS} days: ${list(dueSoon)}.` : "",
  ]
    .filter(Boolean)
    .join(" ")

  const recipients = await db.employee.findMany({
    where: {
      isActive: true,
      employeeRoles: {
        some: {
          role: { rolePermissions: { some: { permission: { scope: PERMISSIONS.EXIT_WRITE } } } },
        },
      },
    },
    select: { id: true },
  })
  if (recipients.length > 0) {
    await createNotifications(
      recipients.map((r) => ({
        employeeId: r.id,
        title: overdue.length
          ? "Full & Final settlement overdue"
          : "Full & Final settlement due soon",
        message,
        type: overdue.length ? ("warning" as const) : ("info" as const),
        link: "/exit-clearance?tab=fnf",
      })),
    )
  }

  const stamp = new Date()
  if (overdue.length) {
    await db.fullFinalSettlement.updateMany({
      where: { id: { in: overdue.map((r) => r.id) } },
      data: { overdueNotifiedAt: stamp },
    })
  }
  if (dueSoon.length) {
    await db.fullFinalSettlement.updateMany({
      where: { id: { in: dueSoon.map((r) => r.id) } },
      data: { dueSoonNotifiedAt: stamp },
    })
  }
  return { sent: recipients.length, skipped: false }
}
