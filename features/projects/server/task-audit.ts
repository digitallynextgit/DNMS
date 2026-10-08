import "server-only"

import { db } from "@/server/db"
import { TASK_PRIORITY_LABELS } from "@/lib/constants"
import { formatHours } from "@/features/projects/lib/format-hours"

// Before/after values of task field edits, for the activity log.
// Status is not tracked here - it has its own timeline.

type FieldKind = "text" | "priority" | "date" | "hours" | "person" | "bool"

const TRACKED: Record<string, { label: string; kind: FieldKind }> = {
  title: { label: "Title", kind: "text" },
  description: { label: "Actual", kind: "text" },
  priority: { label: "Priority", kind: "priority" },
  dueDate: { label: "Due date", kind: "date" },
  startDate: { label: "Start date", kind: "date" },
  estimatedHours: { label: "Allocated", kind: "hours" },
  assigneeId: { label: "Assignee", kind: "person" },
  isMilestone: { label: "Milestone", kind: "bool" },
}

type Snapshot = string | number | boolean | null

/** JSON-safe value, so from/to survive the round trip through Prisma's Json. */
function snapshot(v: unknown): Snapshot {
  if (v === null || v === undefined) return null
  if (v instanceof Date) return v.toISOString()
  if (typeof v === "number" || typeof v === "boolean" || typeof v === "string") return v
  return String(v)
}

export interface TaskFieldDiff {
  [field: string]: { from: Snapshot; to: Snapshot }
}

/** Tracked fields this update changes, or null so a status-only PATCH leaves no empty entry. */
export function diffTaskFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): TaskFieldDiff | null {
  const fields: TaskFieldDiff = {}
  for (const key of Object.keys(TRACKED)) {
    // Absent means "not touched", not "set to null".
    if (!(key in after)) continue
    const from = snapshot(before[key])
    const to = snapshot(after[key])
    if (from === to) continue
    fields[key] = { from, to }
  }
  return Object.keys(fields).length > 0 ? fields : null
}

export interface TaskEdit {
  id: string
  at: string
  actor: { id: string; firstName: string; lastName: string } | null
  changes: { label: string; from: string; to: string }[]
}

/** Nothing there - an empty title, no due date, no allocation. */
const EMPTY = "-"

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function render(kind: FieldKind, v: Snapshot, names: Map<string, string>): string {
  if (v === null || v === "") return EMPTY
  switch (kind) {
    case "priority":
      return TASK_PRIORITY_LABELS[String(v)] ?? String(v)
    case "date":
      return formatDate(String(v))
    case "hours":
      return typeof v === "number" ? formatHours(v) : String(v)
    case "person":
      return names.get(String(v)) ?? "Someone who has since left"
    case "bool":
      return v ? "Yes" : "No"
    case "text": {
      const s = String(v)
      // Keep long descriptions from pushing the log off screen.
      return s.length > 80 ? `${s.slice(0, 79)}…` : s
    }
  }
}

/** The stored shape, or null for a legacy row that only recorded new values. */
function fieldsOf(changes: unknown): TaskFieldDiff | null {
  if (!changes || typeof changes !== "object") return null
  const f = (changes as { fields?: unknown }).fields
  return f && typeof f === "object" ? (f as TaskFieldDiff) : null
}

/** Every recorded edit to a task, oldest first. Legacy rows with only the new value are skipped. */
export async function getTaskEditHistory(taskId: string): Promise<TaskEdit[]> {
  const rows = await db.auditLog.findMany({
    where: { entityType: "ProjectTask", entityId: taskId, action: "UPDATE" },
    orderBy: { createdAt: "asc" },
    include: { actor: { select: { id: true, firstName: true, lastName: true } } },
  })

  // Resolve every person in the history in one query.
  const personIds = new Set<string>()
  for (const r of rows) {
    const a = fieldsOf(r.changes)?.assigneeId
    if (!a) continue
    if (typeof a.from === "string") personIds.add(a.from)
    if (typeof a.to === "string") personIds.add(a.to)
  }
  const people =
    personIds.size > 0
      ? await db.employee.findMany({
          where: { id: { in: [...personIds] } },
          select: { id: true, firstName: true, lastName: true },
        })
      : []
  const names = new Map(people.map((p) => [p.id, `${p.firstName} ${p.lastName}`.trim()]))

  const out: TaskEdit[] = []
  for (const r of rows) {
    const fields = fieldsOf(r.changes)
    if (!fields) continue
    const changes = Object.entries(fields)
      .filter(([k]) => k in TRACKED)
      .map(([k, v]) => ({
        label: TRACKED[k]!.label,
        from: render(TRACKED[k]!.kind, v.from, names),
        to: render(TRACKED[k]!.kind, v.to, names),
      }))
    if (changes.length === 0) continue
    out.push({ id: r.id, at: r.createdAt.toISOString(), actor: r.actor, changes })
  }
  return out
}
