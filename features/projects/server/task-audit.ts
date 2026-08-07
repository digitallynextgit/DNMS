import "server-only"

import { db } from "@/server/db"
import { TASK_PRIORITY_LABELS } from "@/lib/constants"
import { formatHours } from "@/features/projects/lib/format-hours"

// =============================================================================
// What changed on a task, and who changed it.
//
// The status timeline already answers "which phase, for how long, by whom". It
// cannot answer "who moved the deadline" or "what did the title used to say" -
// the audit log recorded only the NEW value, so the before was lost the moment
// it was written. These rows store both sides, so the activity log can show the
// edit rather than just the fact that an edit happened.
//
// Status is deliberately NOT tracked here: it has its own timeline, and listing
// it twice is exactly the clutter the activity log does not need.
// =============================================================================

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

/**
 * Which tracked fields this update actually changes. Returns null when nothing
 * did - a status-only PATCH must not leave an empty "edited" entry behind.
 */
export function diffTaskFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): TaskFieldDiff | null {
  const fields: TaskFieldDiff = {}
  for (const key of Object.keys(TRACKED)) {
    // Absent from the payload means "not touched", which is not the same as
    // "set to null" - only compare what the request actually sent.
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
const EMPTY = "—"

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
      // Long descriptions would push the whole log off the screen; the point is
      // to see THAT it changed and roughly to what.
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

/**
 * Every recorded edit to one task, oldest first.
 *
 * Rows written before this existed carried only the new value, so they are
 * skipped rather than rendered as a change from nothing - a wrong history is
 * worse than a short one.
 */
export async function getTaskEditHistory(taskId: string): Promise<TaskEdit[]> {
  const rows = await db.auditLog.findMany({
    where: { entityType: "ProjectTask", entityId: taskId, action: "UPDATE" },
    orderBy: { createdAt: "asc" },
    include: { actor: { select: { id: true, firstName: true, lastName: true } } },
  })

  // Resolve every person named anywhere in the history in ONE query, rather
  // than a lookup per reassignment.
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
