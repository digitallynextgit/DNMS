import "server-only"

import { db } from "@/server/db"
import { NotFoundError } from "@/lib/errors"
import {
  WEB_CHECKLIST_ITEMS,
  WEB_CHECKLIST_KEYS,
  WEB_CHECKLIST_STATUSES,
  WEB_CHECKLIST_TOTAL,
  isWebChecklistStatus,
  type WebChecklistStatus,
  type WebChecklistView,
} from "../lib/web-checklist-template"
import type { WebChecklistItemPatch } from "../schemas/web-checklist.schema"

const STATUS_BY = { select: { id: true, firstName: true, lastName: true } }

/** The project's checklist. Items nobody has touched yet have no row and read as Not started. */
export async function getProjectWebChecklist(projectId: string): Promise<WebChecklistView> {
  const rows = await db.projectWebChecklistItem.findMany({
    where: { projectId },
    select: { key: true, status: true, statusAt: true, note: true, statusBy: STATUS_BY },
  })
  const byKey = new Map(rows.map((r) => [r.key, r]))
  const counts = Object.fromEntries(WEB_CHECKLIST_STATUSES.map((s) => [s, 0])) as Record<
    WebChecklistStatus,
    number
  >
  // Text comes from the template, so a renamed item reads the same on every project.
  const items = WEB_CHECKLIST_ITEMS.map((i) => {
    const r = byKey.get(i.key)
    // A status the template no longer offers reads as Not started.
    const status: WebChecklistStatus =
      r && isWebChecklistStatus(r.status) ? r.status : "NOT_STARTED"
    counts[status]++
    return {
      key: i.key,
      text: i.text,
      status,
      statusAt: r?.statusAt ?? null,
      statusBy: r?.statusBy ?? null,
      note: r?.note ?? null,
    }
  })
  return {
    counts,
    applicable: WEB_CHECKLIST_TOTAL - counts.NOT_APPLICABLE,
    total: WEB_CHECKLIST_TOTAL,
    items,
  }
}

/**
 * Sets an item's status and/or note. `actorId` comes from actorStampId, so it is null for the
 * hidden admin role; nothing keys off it except the "Updated by" line.
 */
export async function setWebChecklistItem(
  projectId: string,
  key: string,
  patch: WebChecklistItemPatch,
  actorId: string | null,
): Promise<WebChecklistView> {
  if (!WEB_CHECKLIST_KEYS.has(key)) throw new NotFoundError("Checklist item")
  const statusData =
    patch.status !== undefined
      ? { status: patch.status, statusAt: new Date(), statusById: actorId }
      : {}
  const noteData = patch.note !== undefined ? { note: patch.note?.trim() || null } : {}
  await db.projectWebChecklistItem.upsert({
    where: { projectId_key: { projectId, key } },
    create: { projectId, key, ...statusData, ...noteData },
    update: { ...statusData, ...noteData },
  })
  return getProjectWebChecklist(projectId)
}
