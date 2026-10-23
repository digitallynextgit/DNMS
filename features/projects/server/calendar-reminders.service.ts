import "server-only"

import type { Prisma } from "@prisma/client"
import { db } from "@/server/db"
import { createNotifications } from "@/lib/notifications"
import { addDays, indiaToday, toDateOnly } from "@/lib/dates"
import { projectHref } from "../lib/project-href"
import {
  cellDate,
  isClosedStatus,
  isReadyStatus,
  normaliseStatus,
  rowTitle,
} from "../lib/calendar-templates"

// Date-driven calendar reminders (daily, from 9 AM) and the Monday column digest. Both read only
// tabs that carry template keys; a free sheet never notifies. One notification per person, tab
// and kind, naming the rows: a calendar with three posts a day must not ping three times. Each
// row remembers what it was reminded of ({ "<kind>": "<date>" }), so nothing goes out twice.

const SOON_DAYS = 3
/** How long an overdue row keeps nagging (daily) before it goes quiet. */
const OVERDUE_DAYS = 14
const REVIEW_STUCK_DAYS = 2
/** Rows named in one notification before "and N more". */
const LISTED = 4

type Cell = string | number | boolean | null
type Note = Parameters<typeof createNotifications>[0][number]
type Kind = "due_soon" | "due_today" | "due_overdue" | "publish_today" | "publish_overdue"
/** Overdue kinds repeat daily (stamped with today); the rest are told once per date. */
const DAILY: ReadonlySet<Kind> = new Set(["due_overdue", "publish_overdue"])

const KINDS: Record<Kind, { title: string; type: Note["type"]; intro: (n: number) => string }> = {
  due_soon: {
    title: "Due soon",
    type: "info",
    intro: (n) => (n === 1 ? "Due in the next 3 days" : `${n} rows due in the next 3 days`),
  },
  due_today: {
    title: "Due today",
    type: "warning",
    intro: (n) => (n === 1 ? "Should be ready today" : `${n} rows should be ready today`),
  },
  due_overdue: {
    title: "Internal deadline missed",
    type: "error",
    intro: (n) =>
      n === 1 ? "Past its internal deadline" : `${n} rows past their internal deadline`,
  },
  publish_today: {
    title: "Goes out today",
    type: "warning",
    intro: (n) => (n === 1 ? "Scheduled for today" : `${n} rows scheduled for today`),
  },
  publish_overdue: {
    title: "Not published",
    type: "error",
    intro: (n) => (n === 1 ? "Dated but not out yet" : `${n} rows dated but not out yet`),
  },
}

const asCells = (raw: Prisma.JsonValue): Record<string, Cell> =>
  raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, Cell>) : {}
const asStamps = (raw: Prisma.JsonValue | null): Record<string, string> =>
  raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, string>) : {}

const LIVE_PROJECT: Prisma.ProjectWhereInput = { status: { notIn: ["COMPLETED", "CANCELLED"] } }

/** Every templated tab on live projects, with its rows and the workbook it belongs to. */
async function templatedTabs() {
  return db.projectSheet.findMany({
    where: {
      columns: { some: { key: "date" } },
      workbook: { project: LIVE_PROJECT },
    },
    select: {
      id: true,
      name: true,
      columns: { select: { id: true, key: true, name: true } },
      rows: { select: { id: true, position: true, cells: true, reminders: true } },
      workbook: {
        select: {
          id: true,
          name: true,
          periodMonth: true,
          assignedToId: true,
          secondaryAssignedToId: true,
          campaign: { select: { name: true, ownerId: true, deadline: true } },
          project: { select: { id: true, slug: true, name: true, ownerId: true } },
        },
      },
    },
  })
}

type Tab = Awaited<ReturnType<typeof templatedTabs>>[number]

async function activeEmployees(): Promise<Set<string>> {
  const rows = await db.employee.findMany({ where: { isActive: true }, select: { id: true } })
  return new Set(rows.map((r) => r.id))
}

function reader(tab: Tab, active: ReadonlySet<string>) {
  const byKey = new Map(tab.columns.filter((c) => c.key).map((c) => [c.key!, { id: c.id }]))
  const cell = (cells: Record<string, Cell>, key: string): Cell => {
    const c = byKey.get(key)
    return c ? (cells[c.id] ?? null) : null
  }
  const text = (cells: Record<string, Cell>, key: string): string | null => {
    const v = cell(cells, key)
    return typeof v === "string" && v.trim() ? v.trim() : null
  }
  /** A person cell that names a current employee (a typed-in name on an old column does not). */
  const person = (cells: Record<string, Cell>, key: string): string | null => {
    const v = text(cells, key)
    return v && active.has(v) ? v : null
  }
  return { byKey, cell, text, person }
}

/** Who answers for the calendar: its owner and the campaign's; else the project's account manager. */
function leadsOf(tab: Tab, active: ReadonlySet<string>): string[] {
  const own = [tab.workbook.assignedToId, tab.workbook.campaign?.ownerId].filter(
    (v): v is string => !!v && active.has(v),
  )
  if (own.length) return [...new Set(own)]
  const manager = tab.workbook.project.ownerId
  return active.has(manager) ? [manager] : []
}

const where = (tab: Tab) => tab.workbook.campaign?.name ?? `${tab.workbook.name} · ${tab.name}`
const linkTo = (tab: Tab) =>
  projectHref(tab.workbook.project, "calendar", { calendar: tab.workbook.id })

/** "25 Oct" for a YYYY-MM-DD. */
const short = (ymd: string) =>
  new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })

const list = (items: string[]) =>
  items.length <= LISTED
    ? items.join(", ")
    : `${items.slice(0, LISTED).join(", ")} and ${items.length - LISTED} more`

/** Daily: internal deadlines and publish dates, to the row's owner (the calendar's leads once late). */
export async function runCalendarReminders(
  now = new Date(),
): Promise<{ sent: number; skipped: boolean }> {
  const today = indiaToday(now)
  const todayDate = new Date(`${today}T00:00:00.000Z`)
  try {
    await db.digestRun.create({ data: { kind: "calendar-reminders", periodStart: todayDate } })
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") return { sent: 0, skipped: true }
    throw err
  }

  const soonCutoff = toDateOnly(addDays(todayDate, SOON_DAYS))
  const overdueFloor = toDateOnly(addDays(todayDate, -OVERDUE_DAYS))
  const active = await activeEmployees()
  const buckets = new Map<string, { employeeId: string; tab: Tab; kind: Kind; items: string[] }>()
  const stamps: { id: string; reminders: Record<string, string> }[] = []

  for (const tab of await templatedTabs()) {
    const { byKey, text, person } = reader(tab, active)
    const leads = leadsOf(tab, active)

    for (const row of tab.rows) {
      const cells = asCells(row.cells)
      const status = normaliseStatus(text(cells, "status"))
      if (status && isClosedStatus(status)) continue
      const owner = person(cells, "owner")
      const mine = owner ? [owner] : []
      const title = `"${rowTitle(cells, byKey, row.position)}"`
      const sent = asStamps(row.reminders)
      const next = { ...sent }
      // `about` is the date the reminder is for: a row whose date moves is told again.
      const tell = (kind: Kind, people: string[], item: string, about: string) => {
        const mark = DAILY.has(kind) ? today : about
        if (sent[kind] === mark) return
        const ids = [...new Set(people)]
        if (ids.length === 0) return
        for (const employeeId of ids) {
          const key = `${employeeId}|${tab.id}|${kind}`
          const bucket = buckets.get(key) ?? { employeeId, tab, kind, items: [] }
          bucket.items.push(item)
          buckets.set(key, bucket)
        }
        next[kind] = mark
      }

      const due = cellDate(text(cells, "internal_due"))
      if (due && !(status && isReadyStatus(status))) {
        if (due === today) tell("due_today", mine, title, due)
        else if (due > today && due <= soonCutoff)
          tell("due_soon", mine, `${title} (${short(due)})`, due)
        else if (due < today && due >= overdueFloor)
          tell("due_overdue", [...mine, ...leads], `${title} (due ${short(due)})`, due)
      }

      const date = cellDate(text(cells, "date"))
      if (date) {
        const state = status ?? "no status"
        if (date === today) tell("publish_today", [...mine, ...leads], `${title} (${state})`, date)
        else if (date < today && date >= overdueFloor)
          tell("publish_overdue", [...mine, ...leads], `${title} (${short(date)}, ${state})`, date)
      }

      if (JSON.stringify(next) !== JSON.stringify(sent))
        stamps.push({ id: row.id, reminders: next })
    }
  }

  const notes: Note[] = [...buckets.values()].map((b) => ({
    employeeId: b.employeeId,
    title: `${KINDS[b.kind].title} · ${where(b.tab)}`,
    message: `${KINDS[b.kind].intro(b.items.length)}: ${list(b.items)}.`,
    type: KINDS[b.kind].type,
    link: linkTo(b.tab),
  }))
  if (notes.length) await createNotifications(notes)
  for (const s of stamps) {
    await db.projectSheetRow.update({
      where: { id: s.id },
      data: { reminders: s.reminders as Prisma.InputJsonValue },
    })
  }
  return { sent: notes.length, skipped: false }
}

/** Monday: per calendar, what is missing and what is stuck, to its owner and secondary. */
export async function runCalendarDigest(
  now = new Date(),
): Promise<{ sent: number; skipped: boolean }> {
  const today = indiaToday(now)
  const todayDate = new Date(`${today}T00:00:00.000Z`)
  try {
    await db.digestRun.create({ data: { kind: "calendar-digest", periodStart: todayDate } })
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") return { sent: 0, skipped: true }
    throw err
  }

  const weekEnd = toDateOnly(addDays(todayDate, 7))
  const stuckBefore = new Date(todayDate.getTime() - REVIEW_STUCK_DAYS * 86_400_000)
  const active = await activeEmployees()
  const notes: Note[] = []

  // Only this month's calendars and campaigns still running are worth a weekly nag.
  const monthStart = new Date(Date.UTC(todayDate.getUTCFullYear(), todayDate.getUTCMonth(), 1))
  for (const tab of await templatedTabs()) {
    const wb = tab.workbook
    if (wb.periodMonth && wb.periodMonth.getTime() !== monthStart.getTime()) continue
    if (wb.campaign && toDateOnly(wb.campaign.deadline) < today) continue
    const { byKey, text, person } = reader(tab, active)
    // A row counts once it says something: a date, a status, an owner or a name. Summary rows
    // ("Total posts") and stray cells do not.
    const open = tab.rows
      .map((r) => ({ r, cells: asCells(r.cells) }))
      .filter(({ r, cells }) => {
        const s = normaliseStatus(text(cells, "status"))
        if (s && isClosedStatus(s)) return false
        return (
          !!cellDate(text(cells, "date")) ||
          !!s ||
          !!person(cells, "owner") ||
          !rowTitle(cells, byKey, r.position).startsWith("Row ")
        )
      })
    if (open.length === 0) continue

    const missing: string[] = []
    const count = (label: string, has: (cells: Record<string, Cell>) => boolean) => {
      const n = open.filter(({ cells }) => !has(cells)).length
      if (n) missing.push(`${n} without ${label}`)
    }
    if (byKey.has("owner")) count("an owner", (c) => !!person(c, "owner"))
    if (byKey.has("date")) count("a date", (c) => !!cellDate(text(c, "date")))
    if (byKey.has("status")) count("a status", (c) => !!text(c, "status"))
    const thisWeekNoAsset = byKey.has("asset")
      ? open.filter(({ cells }) => {
          const d = cellDate(text(cells, "date"))
          return d && d >= today && d <= weekEnd && !text(cells, "asset")
        }).length
      : 0
    if (thisWeekNoAsset) missing.push(`${thisWeekNoAsset} due this week without a final asset`)

    const byStatus = new Map<string, number>()
    for (const { cells } of open) {
      const s = normaliseStatus(text(cells, "status")) ?? "no status"
      byStatus.set(s, (byStatus.get(s) ?? 0) + 1)
    }

    // Rows parked in Review: the last status edit is older than the grace period.
    const statusCol = byKey.get("status")
    let stuck = 0
    if (statusCol) {
      const inReview = open.filter(
        ({ cells }) => normaliseStatus(text(cells, "status")) === "Review",
      )
      for (const { r } of inReview) {
        const last = await db.projectSheetEvent.findFirst({
          where: { sheetId: tab.id, rowId: r.id, columnId: statusCol.id, type: "CELL_UPDATED" },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        })
        if (!last || last.createdAt < stuckBefore) stuck++
      }
    }

    if (!missing.length && !stuck) continue
    const lines = [
      `${open.length} open row${open.length === 1 ? "" : "s"}: ${[...byStatus].map(([s, n]) => `${s} ${n}`).join(", ")}.`,
      ...(missing.length ? [`Missing: ${missing.join("; ")}.`] : []),
      ...(stuck ? [`${stuck} waiting in Review for over ${REVIEW_STUCK_DAYS} days.`] : []),
    ]

    const own = [wb.assignedToId, wb.secondaryAssignedToId, wb.campaign?.ownerId].filter(
      (v): v is string => !!v && active.has(v),
    )
    const recipients = own.length
      ? [...new Set(own)]
      : active.has(wb.project.ownerId)
        ? [wb.project.ownerId]
        : []
    for (const employeeId of recipients) {
      notes.push({
        employeeId,
        title: `Calendar check: ${where(tab)}`,
        message: lines.join(" "),
        type: "warning",
        link: linkTo(tab),
      })
    }
  }

  if (notes.length) await createNotifications(notes)
  return { sent: notes.length, skipped: false }
}
