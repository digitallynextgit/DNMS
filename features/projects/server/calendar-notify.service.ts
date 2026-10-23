import "server-only"

import { db } from "@/server/db"
import { createNotifications } from "@/lib/notifications"
import { projectHref } from "../lib/project-href"
import { normaliseStatus, rowTitle } from "../lib/calendar-templates"

// Instant calendar notifications: the hand-offs. Everything date-driven is the daily job
// (calendar-reminders.service.ts), and the "what is missing" picture is the Monday digest.

type Cell = string | number | boolean | null

export interface CalendarCellChange {
  key: string
  before: Cell
  after: Cell
}

export async function notifyCalendarCellChanges(input: {
  sheetId: string
  rowId: string
  position: number
  cells: Record<string, Cell>
  columns: { id: string; key: string | null; name: string }[]
  changes: CalendarCellChange[]
  actorId: string | null
}): Promise<void> {
  const status = input.changes.find((c) => c.key === "status")
  const owner = input.changes.find((c) => c.key === "owner")
  if (!status && !owner) return

  const sheet = await db.projectSheet.findUnique({
    where: { id: input.sheetId },
    select: {
      name: true,
      workbook: {
        select: {
          id: true,
          name: true,
          assignedToId: true,
          campaign: { select: { name: true } },
          project: { select: { id: true, slug: true, name: true, ownerId: true } },
        },
      },
    },
  })
  if (!sheet) return
  const byKey = new Map(input.columns.filter((c) => c.key).map((c) => [c.key!, { id: c.id }]))
  const raw = (key: string): string | null => {
    const col = byKey.get(key)
    const v = col ? input.cells[col.id] : null
    return typeof v === "string" && v ? v : null
  }
  // Only current employees are told: a name typed into an old text column is not an id.
  const candidates = [
    raw("approver"),
    raw("owner"),
    raw("designer"),
    sheet.workbook.assignedToId,
    sheet.workbook.project.ownerId,
    typeof owner?.after === "string" ? owner.after : null,
  ].filter((v): v is string => !!v)
  const active = new Set(
    (
      await db.employee.findMany({
        where: { id: { in: [...new Set(candidates)] }, isActive: true },
        select: { id: true },
      })
    ).map((e) => e.id),
  )
  const person = (key: string): string | null => {
    const v = raw(key)
    return v && active.has(v) ? v : null
  }
  const first = (...ids: (string | null)[]) => ids.find((id) => !!id && active.has(id)) ?? null

  const title = rowTitle(input.cells, byKey, input.position)
  const where = sheet.workbook.campaign?.name ?? `${sheet.workbook.name} · ${sheet.name}`
  const link = projectHref(sheet.workbook.project, "calendar", { calendar: sheet.workbook.id })

  type Note = Parameters<typeof createNotifications>[0][number]
  const notes: Note[] = []
  const tell = (employeeId: string | null, note: Omit<Note, "employeeId">) => {
    // Never notify the person who made the change.
    if (!employeeId || employeeId === input.actorId) return
    if (notes.some((n) => n.employeeId === employeeId && n.title === note.title)) return
    notes.push({ employeeId, ...note })
  }

  if (status) {
    const next = normaliseStatus(status.after)
    if (next === "Review") {
      // The approver; else whoever runs the calendar; else the account manager.
      tell(first(person("approver"), sheet.workbook.assignedToId, sheet.workbook.project.ownerId), {
        title: "Ready for your review",
        message: `${where}: "${title}" is waiting for your approval.`,
        type: "info",
        link,
      })
    } else if (next === "Approved") {
      const message = `${where}: "${title}" is approved - over to you.`
      tell(person("owner"), { title: "Approved", message, type: "success", link })
      tell(person("designer"), {
        title: "Approved - ready to make",
        message,
        type: "success",
        link,
      })
    } else if (next === "Dropped") {
      tell(first(sheet.workbook.assignedToId), {
        title: "Row dropped",
        message: `${where}: "${title}" was dropped.`,
        type: "warning",
        link,
      })
    }
  }

  if (owner && typeof owner.after === "string" && active.has(owner.after)) {
    tell(owner.after, {
      title: "You now own a calendar row",
      message: `${where}: "${title}" is yours.`,
      type: "info",
      link,
    })
  }

  if (notes.length) await createNotifications(notes)
}
