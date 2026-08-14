// =============================================================================
// Project monitoring (staff side)
// =============================================================================
// Everything here is scoped to ONE project. The projectId is supplied by the
// route guard (withProjectManager), which has already proved the caller may
// manage that project and resolved a slug to a real id - it is never taken from
// a request body, so this surface cannot register a monitor or a renewal against
// some other project.
//
// Every update/delete filters on projectId AS WELL AS the row id. Without that,
// an id copied from another project would resolve and be editable from this
// project's screen.
// =============================================================================

import "server-only"

import { db } from "@/server/db"
import { createAuditLog } from "@/lib/audit"
import { ok, fail, runAction, serialize, type ActionResult } from "@/server/action-result"
import {
  assetSchema,
  monitorSchema,
  type AssetInput,
  type MonitorInput,
} from "../schemas/monitoring.schema"
import type { Session } from "next-auth"

const ASSET_SELECT = {
  id: true,
  kind: true,
  name: true,
  provider: true,
  url: true,
  expiresAt: true,
  autoRenew: true,
  paymentMethod: true,
  paymentExpiresAt: true,
  notes: true,
  lastAlertAt: true,
  owner: { select: { id: true, firstName: true, lastName: true } },
} as const

const MONITOR_SELECT = {
  id: true,
  url: true,
  label: true,
  isActive: true,
  state: true,
  lastCheckedAt: true,
  lastStatusCode: true,
  lastError: true,
  owner: { select: { id: true, firstName: true, lastName: true } },
  incidents: {
    where: { endedAt: null },
    select: {
      id: true,
      startedAt: true,
      detail: true,
      acknowledgedAt: true,
      escalationLevel: true,
      acknowledgedBy: { select: { firstName: true, lastName: true } },
    },
    take: 1,
    orderBy: { startedAt: "desc" },
  },
} as const

/** Everything this project's Monitoring tab needs, in one round trip. */
export async function getProjectMonitoring(projectId: string): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const [assets, monitors, recentIncidents] = await Promise.all([
      db.projectAsset.findMany({
        where: { projectId },
        select: ASSET_SELECT,
        orderBy: { expiresAt: "asc" },
      }),
      db.uptimeMonitor.findMany({
        where: { projectId },
        select: MONITOR_SELECT,
        orderBy: { url: "asc" },
      }),
      db.uptimeIncident.findMany({
        where: { endedAt: { not: null }, monitor: { projectId } },
        select: {
          id: true,
          startedAt: true,
          endedAt: true,
          detail: true,
          monitor: { select: { url: true, label: true } },
        },
        orderBy: { startedAt: "desc" },
        take: 10,
      }),
    ])

    return ok(serialize({ data: { assets, monitors, recentIncidents } }))
  })
}

// ─── Renewal register ───────────────────────────────────────────────────────

export async function createAsset(
  projectId: string,
  body: AssetInput,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const input = assetSchema.parse(body)

    const asset = await db.projectAsset.create({
      data: {
        projectId,
        kind: input.kind,
        name: input.name,
        provider: input.provider || null,
        url: input.url || null,
        expiresAt: new Date(input.expiresAt),
        autoRenew: input.autoRenew,
        paymentMethod: input.paymentMethod || null,
        paymentExpiresAt: input.paymentExpiresAt ? new Date(input.paymentExpiresAt) : null,
        ownerId: input.ownerId || null,
        notes: input.notes || null,
      },
      select: ASSET_SELECT,
    })

    await createAuditLog(session, {
      action: "asset:create",
      module: "project",
      entityType: "ProjectAsset",
      entityId: asset.id,
      changes: { projectId, ...input },
    })
    return ok(serialize({ data: asset }))
  })
}

export async function updateAsset(
  projectId: string,
  assetId: string,
  body: AssetInput,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const input = assetSchema.parse(body)

    const existing = await db.projectAsset.findFirst({
      where: { id: assetId, projectId },
      select: { id: true, expiresAt: true },
    })
    if (!existing) return fail("Asset not found", undefined, 404)

    const nextExpiry = new Date(input.expiresAt)
    // Moving the date forward (i.e. it was renewed) resets the reminder ladder,
    // so next year's 60-day warning fires instead of being suppressed by last
    // year's "already alerted at stage 0".
    const renewed = nextExpiry.getTime() > existing.expiresAt.getTime()

    const asset = await db.projectAsset.update({
      where: { id: assetId },
      data: {
        kind: input.kind,
        name: input.name,
        provider: input.provider || null,
        url: input.url || null,
        expiresAt: nextExpiry,
        autoRenew: input.autoRenew,
        paymentMethod: input.paymentMethod || null,
        paymentExpiresAt: input.paymentExpiresAt ? new Date(input.paymentExpiresAt) : null,
        ownerId: input.ownerId || null,
        notes: input.notes || null,
        ...(renewed ? { lastAlertStage: null, lastAlertAt: null, lastCardAlertAt: null } : {}),
      },
      select: ASSET_SELECT,
    })

    await createAuditLog(session, {
      action: "asset:update",
      module: "project",
      entityType: "ProjectAsset",
      entityId: assetId,
      changes: input,
    })
    return ok(serialize({ data: asset }))
  })
}

export async function deleteAsset(
  projectId: string,
  assetId: string,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const existing = await db.projectAsset.findFirst({
      where: { id: assetId, projectId },
      select: { id: true },
    })
    if (!existing) return fail("Asset not found", undefined, 404)

    await db.projectAsset.delete({ where: { id: assetId } })
    await createAuditLog(session, {
      action: "asset:delete",
      module: "project",
      entityType: "ProjectAsset",
      entityId: assetId,
    })
    return ok(serialize({ data: { id: assetId } }))
  })
}

// ─── Uptime monitors ────────────────────────────────────────────────────────

export async function createMonitor(
  projectId: string,
  body: MonitorInput,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const input = monitorSchema.parse(body)

    const clash = await db.uptimeMonitor.findFirst({
      where: { projectId, url: input.url },
      select: { id: true },
    })
    if (clash) return fail("That URL is already being watched on this project", undefined, 409)

    const monitor = await db.uptimeMonitor.create({
      data: {
        projectId,
        url: input.url,
        label: input.label || null,
        ownerId: input.ownerId || null,
        isActive: input.isActive ?? true,
      },
      select: MONITOR_SELECT,
    })

    await createAuditLog(session, {
      action: "monitor:create",
      module: "project",
      entityType: "UptimeMonitor",
      entityId: monitor.id,
      changes: { projectId, ...input },
    })
    return ok(serialize({ data: monitor }))
  })
}

export async function updateMonitor(
  projectId: string,
  monitorId: string,
  body: MonitorInput,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const input = monitorSchema.parse(body)

    const existing = await db.uptimeMonitor.findFirst({
      where: { id: monitorId, projectId },
      select: { id: true },
    })
    if (!existing) return fail("Monitor not found", undefined, 404)

    const monitor = await db.uptimeMonitor.update({
      where: { id: monitorId },
      data: {
        url: input.url,
        label: input.label || null,
        ownerId: input.ownerId || null,
        isActive: input.isActive ?? true,
      },
      select: MONITOR_SELECT,
    })

    await createAuditLog(session, {
      action: "monitor:update",
      module: "project",
      entityType: "UptimeMonitor",
      entityId: monitorId,
      changes: input,
    })
    return ok(serialize({ data: monitor }))
  })
}

export async function deleteMonitor(
  projectId: string,
  monitorId: string,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const existing = await db.uptimeMonitor.findFirst({
      where: { id: monitorId, projectId },
      select: { id: true },
    })
    if (!existing) return fail("Monitor not found", undefined, 404)

    await db.uptimeMonitor.delete({ where: { id: monitorId } })
    await createAuditLog(session, {
      action: "monitor:delete",
      module: "project",
      entityType: "UptimeMonitor",
      entityId: monitorId,
    })
    return ok(serialize({ data: { id: monitorId } }))
  })
}

/** Acknowledge an open incident: freezes the escalation ladder. */
export async function ackIncident(
  projectId: string,
  incidentId: string,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    // The incident must belong to a monitor on THIS project - an id from another
    // project must not be acknowledgeable from here.
    const incident = await db.uptimeIncident.findFirst({
      where: { id: incidentId, monitor: { projectId } },
      select: { id: true },
    })
    if (!incident) return fail("Incident not found", undefined, 404)

    const { acknowledgeIncident } = await import("./uptime.service")
    await acknowledgeIncident(incidentId, session.user.id)

    await createAuditLog(session, {
      action: "incident:acknowledge",
      module: "project",
      entityType: "UptimeIncident",
      entityId: incidentId,
    })
    return ok(serialize({ data: { id: incidentId } }))
  })
}
