// =============================================================================
// Uptime monitor
// =============================================================================
// Answers "is this site serving right now", every few minutes, so an outage is
// measured in minutes rather than in however long it takes someone to notice the
// orders stopped.
//
// Two rules keep it from becoming noise people learn to ignore:
//
//   1. FLAP GUARD. A single failed request means nothing - networks blip. The
//      state only flips to DOWN after FAILURES_TO_OPEN consecutive failures, and
//      only back to UP after SUCCESSES_TO_CLOSE consecutive successes.
//   2. ALERT ON CHANGE. Notifications fire when the state CHANGES or when an
//      open incident escalates - never once per tick. The same lesson the SEO
//      monitor already learned.
// =============================================================================

import "server-only"

import { db } from "@/server/db"
import {
  notifyAudience,
  projectMonitoringLink,
  shouldEscalate,
  type EscalationLevel,
} from "./escalation"

/** Consecutive failures before we call it an outage. */
const FAILURES_TO_OPEN = 2
/** Consecutive successes before we call it recovered. */
const SUCCESSES_TO_CLOSE = 1
/** Per-request timeout. Slower than this is, for our purposes, down. */
const REQUEST_TIMEOUT_MS = 15_000

export interface ProbeResult {
  ok: boolean
  statusCode?: number
  error?: string
}

/**
 * One HTTP probe. Any 2xx/3xx counts as up: a redirect to https, or to a
 * country storefront, is still a site that is serving.
 */
export async function probe(url: string): Promise<ProbeResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "DNMS-UptimeMonitor/1.0" },
      cache: "no-store",
    })
    if (res.status >= 200 && res.status < 400) return { ok: true, statusCode: res.status }
    return { ok: false, statusCode: res.status, error: `HTTP ${res.status}` }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      error: controller.signal.aborted ? `No response in ${REQUEST_TIMEOUT_MS / 1000}s` : message,
    }
  } finally {
    clearTimeout(timer)
  }
}

export interface SweepSummary {
  checked: number
  up: number
  down: number
  opened: number
  recovered: number
  escalated: number
}

/**
 * Probe every active monitor and reconcile state, incidents and alerts.
 *
 * Safe to call as often as you like: it is idempotent per tick, and everything
 * it emits is gated on a state change or an escalation deadline.
 */
export async function runUptimeSweep(): Promise<SweepSummary> {
  const monitors = await db.uptimeMonitor.findMany({
    where: { isActive: true },
    select: {
      id: true,
      projectId: true,
      url: true,
      label: true,
      state: true,
      ownerId: true,
      consecutiveFailures: true,
      consecutiveSuccesses: true,
      project: { select: { name: true, slug: true } },
    },
  })

  const summary: SweepSummary = {
    checked: 0,
    up: 0,
    down: 0,
    opened: 0,
    recovered: 0,
    escalated: 0,
  }

  // Probes run in parallel - one slow site must not delay the rest of the sweep.
  const results = await Promise.all(
    monitors.map(async (m) => ({ monitor: m, result: await probe(m.url) })),
  )

  for (const { monitor, result } of results) {
    summary.checked++
    if (result.ok) summary.up++
    else summary.down++

    const failures = result.ok ? 0 : monitor.consecutiveFailures + 1
    const successes = result.ok ? monitor.consecutiveSuccesses + 1 : 0
    const name = monitor.label || monitor.url
    const monitorLink = projectMonitoringLink(monitor.project.slug, monitor.projectId)

    let nextState = monitor.state
    if (!result.ok && failures >= FAILURES_TO_OPEN) nextState = "DOWN"
    else if (result.ok && successes >= SUCCESSES_TO_CLOSE) nextState = "UP"

    await db.uptimeMonitor.update({
      where: { id: monitor.id },
      data: {
        state: nextState,
        lastCheckedAt: new Date(),
        lastStatusCode: result.statusCode ?? null,
        lastError: result.error ?? null,
        consecutiveFailures: failures,
        consecutiveSuccesses: successes,
      },
    })

    const openIncident = await db.uptimeIncident.findFirst({
      where: { monitorId: monitor.id, endedAt: null },
      orderBy: { startedAt: "desc" },
    })

    // ── Went down ────────────────────────────────────────────────────────────
    if (nextState === "DOWN" && !openIncident) {
      const incident = await db.uptimeIncident.create({
        data: {
          monitorId: monitor.id,
          statusCode: result.statusCode ?? null,
          detail: result.error ?? "Unreachable",
          escalationLevel: 0,
          lastEscalatedAt: new Date(),
        },
        select: { id: true },
      })
      summary.opened++
      await notifyAudience({
        level: 0,
        ownerId: monitor.ownerId,
        projectId: monitor.projectId,
        title: `${monitor.project.name} is DOWN`,
        message: `${name} stopped responding (${result.error ?? "unreachable"}). Acknowledge it in Monitoring once you're on it.`,
        type: "error",
        link: monitorLink,
      })
      void incident
      continue
    }

    // ── Came back ────────────────────────────────────────────────────────────
    if (nextState === "UP" && openIncident) {
      const endedAt = new Date()
      const downMinutes = Math.max(
        1,
        Math.round((endedAt.getTime() - openIncident.startedAt.getTime()) / 60_000),
      )
      await db.uptimeIncident.update({
        where: { id: openIncident.id },
        data: { endedAt },
      })
      summary.recovered++
      await notifyAudience({
        // Recovery goes to whoever was told about the outage, so an escalated
        // incident doesn't leave the manager wondering how it ended.
        level: openIncident.escalationLevel as EscalationLevel,
        ownerId: monitor.ownerId,
        projectId: monitor.projectId,
        title: `${monitor.project.name} is back up`,
        message: `${name} is responding again after about ${downMinutes} minute${downMinutes === 1 ? "" : "s"}.`,
        type: "success",
        link: monitorLink,
      })
      continue
    }

    // ── Still down: climb the ladder until somebody acknowledges ─────────────
    if (nextState === "DOWN" && openIncident && !openIncident.acknowledgedAt) {
      if (shouldEscalate(openIncident.lastEscalatedAt, openIncident.escalationLevel)) {
        const level = Math.min(2, openIncident.escalationLevel + 1) as EscalationLevel
        const downMinutes = Math.max(
          1,
          Math.round((Date.now() - openIncident.startedAt.getTime()) / 60_000),
        )
        await db.uptimeIncident.update({
          where: { id: openIncident.id },
          data: { escalationLevel: level, lastEscalatedAt: new Date() },
        })
        summary.escalated++
        await notifyAudience({
          level,
          ownerId: monitor.ownerId,
          projectId: monitor.projectId,
          title: `${monitor.project.name} still DOWN`,
          message: `${name} has been down for about ${downMinutes} minutes and nobody has acknowledged it.`,
          type: "error",
          link: monitorLink,
        })
      }
    }
  }

  return summary
}

/** Acknowledge the open incident on a monitor - stops the escalation ladder. */
export async function acknowledgeIncident(
  incidentId: string,
  employeeId: string,
): Promise<{ ok: boolean }> {
  await db.uptimeIncident.updateMany({
    where: { id: incidentId, acknowledgedAt: null },
    data: { acknowledgedAt: new Date(), acknowledgedById: employeeId },
  })
  return { ok: true }
}
