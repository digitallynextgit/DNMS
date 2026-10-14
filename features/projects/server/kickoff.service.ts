import "server-only"

import { db } from "@/server/db"
import { NotFoundError } from "@/lib/errors"
import {
  KICKOFF_KEYS,
  KICKOFF_SECTIONS,
  KICKOFF_TOTAL,
  type KickoffProgress,
  type KickoffView,
} from "../lib/kickoff-template"
import type { KickoffItemPatch } from "../schemas/kickoff.schema"

const DONE_BY = { select: { id: true, firstName: true, lastName: true } }

/** The project's checklist, created from the template on first read so older projects get it too. */
export async function getProjectKickoff(projectId: string): Promise<KickoffView> {
  const existing = await db.projectKickoffItem.findMany({
    where: { projectId },
    select: { key: true },
  })
  const have = new Set(existing.map((e) => e.key))
  let order = 0
  const missing = KICKOFF_SECTIONS.flatMap((s) =>
    s.items.flatMap((i) => {
      order++
      return have.has(i.key)
        ? []
        : [{ projectId, key: i.key, section: s.key, text: i.text, displayOrder: order }]
    }),
  )
  if (missing.length > 0) {
    await db.projectKickoffItem.createMany({ data: missing, skipDuplicates: true })
  }

  const rows = await db.projectKickoffItem.findMany({
    where: { projectId },
    select: { key: true, isDone: true, doneAt: true, note: true, doneBy: DONE_BY },
  })
  const byKey = new Map(rows.map((r) => [r.key, r]))
  // Text comes from the template, so a reworded item reads the same on every project.
  const sections = KICKOFF_SECTIONS.map((s) => ({
    key: s.key,
    title: s.title,
    items: s.items.map((i) => {
      const r = byKey.get(i.key)
      return {
        key: i.key,
        text: i.text,
        isDone: r?.isDone ?? false,
        doneAt: r?.doneAt ?? null,
        doneBy: r?.doneBy ?? null,
        note: r?.note ?? null,
      }
    }),
  }))
  const done = sections.reduce((n, s) => n + s.items.filter((i) => i.isDone).length, 0)
  return { done, total: KICKOFF_TOTAL, sections }
}

export async function setKickoffItem(
  projectId: string,
  key: string,
  patch: KickoffItemPatch,
  actorId: string,
): Promise<KickoffView> {
  if (!KICKOFF_KEYS.has(key)) throw new NotFoundError("Checklist item")
  // Makes sure the row exists before the update.
  await getProjectKickoff(projectId)
  await db.projectKickoffItem.update({
    where: { projectId_key: { projectId, key } },
    data: {
      ...(patch.isDone !== undefined
        ? {
            isDone: patch.isDone,
            doneAt: patch.isDone ? new Date() : null,
            doneById: patch.isDone ? actorId : null,
          }
        : {}),
      ...(patch.note !== undefined ? { note: patch.note?.trim() || null } : {}),
    },
  })
  return getProjectKickoff(projectId)
}

/** Progress per project for list badges. A project with no rows yet simply has nothing done. */
export async function kickoffProgressFor(
  projectIds: string[],
): Promise<Record<string, KickoffProgress>> {
  const out: Record<string, KickoffProgress> = Object.fromEntries(
    projectIds.map((id) => [id, { done: 0, total: KICKOFF_TOTAL }]),
  )
  if (projectIds.length === 0) return out
  const groups = await db.projectKickoffItem.groupBy({
    by: ["projectId"],
    where: { projectId: { in: projectIds }, isDone: true },
    _count: { _all: true },
  })
  for (const g of groups) out[g.projectId] = { done: g._count._all, total: KICKOFF_TOTAL }
  return out
}
