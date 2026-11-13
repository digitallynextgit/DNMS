import "server-only"

import type { Session } from "next-auth"
import { db } from "@/server/db"
import { NotFoundError } from "@/lib/errors"
import { canAccessProject, canManageProject } from "@/features/projects/server/project-access"
import { shiftWeek, STANDARD_METRICS, weekStartOf } from "../lib/metrics"
import type { CreateMetricInput, SaveEntriesInput, UpdateMetricInput } from "../schemas/metrics.schema"
import type { MetricRow, MetricsBoard } from "../types"

const asDate = (weekStart: string) => new Date(`${weekStart}T00:00:00.000Z`)

export async function metricsAccess(session: Session, projectId: string) {
  if (!(await canAccessProject(session, projectId))) return { canView: false, canManage: false }
  return { canView: true, canManage: await canManageProject(session, projectId) }
}

/**
 * A project's scorecard lines, seeded with the standard set the first time it is opened. Seeding
 * here rather than at project creation means projects that existed before this tab also get it.
 */
export async function ensureMetrics(projectId: string): Promise<void> {
  const have = await db.projectMetric.count({ where: { projectId } })
  if (have > 0) return
  for (const [i, m] of STANDARD_METRICS.entries()) {
    // One at a time: createMany trips the pg adapter here (see the roles route).
    await db.projectMetric.create({
      data: {
        projectId,
        channel: m.channel,
        name: m.name,
        unit: m.unit,
        howTo: m.howTo,
        healthyMin: m.healthyMin ?? null,
        healthyMax: m.healthyMax ?? null,
        goodWhen: m.goodWhen ?? "UP",
        healthyNote: m.healthyNote ?? null,
        sortOrder: i * 10,
      },
    })
  }
}

/** The scorecard for one week, with the week before it alongside for the change column. */
export async function getBoard(
  projectId: string,
  session: Session,
  weekStartRaw?: string | null,
): Promise<MetricsBoard> {
  await ensureMetrics(projectId)
  const weekStart = weekStartRaw ? weekStartOf(weekStartRaw) : weekStartOf(new Date())
  const previous = shiftWeek(weekStart, -1)

  const metrics = await db.projectMetric.findMany({
    where: { projectId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      channel: true,
      name: true,
      unit: true,
      howTo: true,
      healthyMin: true,
      healthyMax: true,
      goodWhen: true,
      healthyNote: true,
      sortOrder: true,
      entries: {
        where: { weekStart: { in: [asDate(weekStart), asDate(previous)] } },
        select: { weekStart: true, value: true, note: true },
      },
    },
  })

  const rows: MetricRow[] = metrics.map((m) => {
    const cur = m.entries.find((e) => e.weekStart.toISOString().slice(0, 10) === weekStart)
    const prev = m.entries.find((e) => e.weekStart.toISOString().slice(0, 10) === previous)
    const { entries: _entries, ...rest } = m
    return { ...rest, current: cur?.value ?? null, previous: prev?.value ?? null, note: cur?.note ?? null }
  })

  const filled = await db.projectMetricEntry.findMany({
    where: { metric: { projectId }, value: { not: null } },
    distinct: ["weekStart"],
    orderBy: { weekStart: "desc" },
    select: { weekStart: true },
    take: 52,
  })

  return {
    weekStart,
    metrics: rows,
    canManage: (await metricsAccess(session, projectId)).canManage,
    filledWeeks: filled.map((f) => f.weekStart.toISOString().slice(0, 10)),
  }
}

export async function createMetric(projectId: string, input: CreateMetricInput) {
  const last = await db.projectMetric.findFirst({
    where: { projectId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  })
  return db.projectMetric.create({
    data: {
      projectId,
      channel: input.channel,
      name: input.name,
      unit: input.unit,
      howTo: input.howTo ?? null,
      healthyMin: input.healthyMin ?? null,
      healthyMax: input.healthyMax ?? null,
      goodWhen: input.goodWhen,
      healthyNote: input.healthyNote ?? null,
      sortOrder: input.sortOrder ?? (last?.sortOrder ?? 0) + 10,
    },
    select: { id: true },
  })
}

async function metricFor(projectId: string, metricId: string) {
  const m = await db.projectMetric.findFirst({ where: { id: metricId, projectId }, select: { id: true } })
  if (!m) throw new NotFoundError("Metric")
  return m
}

export async function updateMetric(projectId: string, metricId: string, input: UpdateMetricInput) {
  await metricFor(projectId, metricId)
  return db.projectMetric.update({
    where: { id: metricId },
    data: {
      ...(input.channel === undefined ? {} : { channel: input.channel }),
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.unit === undefined ? {} : { unit: input.unit }),
      ...(input.howTo === undefined ? {} : { howTo: input.howTo }),
      ...(input.healthyMin === undefined ? {} : { healthyMin: input.healthyMin }),
      ...(input.healthyMax === undefined ? {} : { healthyMax: input.healthyMax }),
      ...(input.goodWhen === undefined ? {} : { goodWhen: input.goodWhen }),
      ...(input.healthyNote === undefined ? {} : { healthyNote: input.healthyNote }),
      ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
    },
    select: { id: true },
  })
}

/** Soft delete: the line leaves the scorecard, past weeks keep their numbers. */
export async function removeMetric(projectId: string, metricId: string) {
  await metricFor(projectId, metricId)
  await db.projectMetric.update({ where: { id: metricId }, data: { isActive: false } })
}

/** Save one week. A cleared box deletes that number rather than storing a nought. */
export async function saveEntries(
  projectId: string,
  actorId: string,
  input: SaveEntriesInput,
): Promise<{ saved: number; cleared: number }> {
  const weekStart = asDate(weekStartOf(input.weekStart))
  const mine = await db.projectMetric.findMany({
    where: { projectId, id: { in: input.values.map((v) => v.metricId) } },
    select: { id: true },
  })
  const allowed = new Set(mine.map((m) => m.id))

  let saved = 0
  let cleared = 0
  for (const v of input.values) {
    if (!allowed.has(v.metricId)) continue
    const note = v.note?.trim() || null
    if (v.value == null && !note) {
      const gone = await db.projectMetricEntry.deleteMany({
        where: { metricId: v.metricId, weekStart },
      })
      cleared += gone.count
      continue
    }
    await db.projectMetricEntry.upsert({
      where: { metricId_weekStart: { metricId: v.metricId, weekStart } },
      create: { metricId: v.metricId, weekStart, value: v.value ?? null, note, enteredById: actorId },
      update: { value: v.value ?? null, note, enteredById: actorId },
    })
    saved++
  }
  return { saved, cleared }
}
