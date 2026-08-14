// =============================================================================
// Renewal register
// =============================================================================
// What expires, when, and whose job it is. The 14 Aug outage had six days of
// warning from the registrar; what was missing was a named person with a date.
//
// Reminders fire at fixed STAGES rather than daily, so the 60-day heads-up and
// the "expires tomorrow" alarm feel different. Past expiry it nags every day and
// escalates, because at that point silence has already cost something.
// =============================================================================

import "server-only"

import { db } from "@/server/db"
import { notifyAudience, projectMonitoringLink, type EscalationLevel } from "./escalation"

/** Days-before-expiry at which a reminder is sent. 0 = expiry day or later. */
const STAGES = [60, 30, 14, 7, 3, 1, 0] as const

/** Overdue, or this close, escalates past the owner. */
const ESCALATE_WITHIN_DAYS = 3

function daysUntil(date: Date): number {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - start.getTime()) / 86_400_000)
}

/**
 * Already said this today?
 *
 * This sweep runs on the in-process scheduler, which ticks hourly rather than
 * once a day, so "alert daily while overdue" has to mean daily and not hourly.
 * Per-asset timestamps are what enforce that, and they survive a restart -
 * a module-level "last run" flag would not.
 */
function alertedToday(last: Date | null): boolean {
  if (!last) return false
  const a = new Date(last)
  const b = new Date()
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/**
 * The tightest stage this asset has reached, or null when it's still beyond the
 * widest one.
 *
 * "Tightest" = the SMALLEST stage the asset is still inside, so 20 days out
 * reports 30 (not 60) and only reports 14 once it crosses that line. Searching
 * ascending is what gets that - searching the descending STAGES would match 60
 * first and the asset would never progress.
 */
function stageFor(days: number): number | null {
  if (days <= 0) return 0
  const ascending = [...STAGES].sort((a, b) => a - b)
  return ascending.find((s) => days <= s) ?? null
}

export interface RenewalSweepSummary {
  scanned: number
  notified: number
  escalated: number
  overdue: number
}

/**
 * Walk the register and nudge whoever owns anything approaching expiry.
 *
 * `lastAlertStage` is what makes this safe to run daily: an asset only alerts
 * again once it crosses into a TIGHTER stage, so 60 days out you hear once, not
 * thirty times.
 */
export async function runRenewalSweep(): Promise<RenewalSweepSummary> {
  const horizon = new Date()
  horizon.setDate(horizon.getDate() + STAGES[0])

  const assets = await db.projectAsset.findMany({
    where: { expiresAt: { lte: horizon } },
    select: {
      id: true,
      name: true,
      kind: true,
      provider: true,
      expiresAt: true,
      autoRenew: true,
      paymentMethod: true,
      paymentExpiresAt: true,
      ownerId: true,
      projectId: true,
      lastAlertStage: true,
      lastAlertAt: true,
      project: { select: { name: true, slug: true } },
    },
  })

  const summary: RenewalSweepSummary = {
    scanned: assets.length,
    notified: 0,
    escalated: 0,
    overdue: 0,
  }

  for (const asset of assets) {
    const days = daysUntil(asset.expiresAt)
    const stage = stageFor(days)
    if (stage === null) continue

    if (days < 0) summary.overdue++

    // Alert on entering a TIGHTER stage. Overdue (stage 0) is the exception -
    // it repeats daily, because by then it is actively costing money - but only
    // once a day, however often the scheduler ticks.
    const tightened = asset.lastAlertStage === null || stage < asset.lastAlertStage
    if (!tightened) {
      if (stage !== 0) continue
      if (alertedToday(asset.lastAlertAt)) continue
    }

    const level: EscalationLevel = days < 0 ? 2 : days <= ESCALATE_WITHIN_DAYS ? 1 : 0
    const assetLink = projectMonitoringLink(asset.project.slug, asset.projectId)

    const when =
      days < 0
        ? `EXPIRED ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`
        : days === 0
          ? "expires TODAY"
          : `expires in ${days} day${days === 1 ? "" : "s"}`

    // Auto-renew being on is explicitly NOT reassurance - it was on for the
    // domain that lapsed. The message says so, so nobody reads "auto" and skips.
    const renewNote = asset.autoRenew
      ? "Auto-renew is on, which is not a guarantee - confirm the payment actually went through."
      : "Auto-renew is OFF - this will not renew itself."

    const payment = asset.paymentMethod
      ? ` Paid by ${asset.paymentMethod}${
          asset.paymentExpiresAt
            ? ` (card expires ${new Date(asset.paymentExpiresAt).toDateString()})`
            : ""
        }.`
      : ""

    await notifyAudience({
      level,
      ownerId: asset.ownerId,
      projectId: asset.projectId,
      title: `${asset.kind === "DOMAIN" ? "Domain" : asset.kind.toLowerCase()} ${when}`,
      message: `${asset.name} (${asset.project.name}${asset.provider ? ` · ${asset.provider}` : ""}) ${when}. ${renewNote}${payment}`,
      type: days <= 7 ? "error" : "warning",
      link: assetLink,
    })

    await db.projectAsset.update({
      where: { id: asset.id },
      data: { lastAlertStage: stage, lastAlertAt: new Date() },
    })

    summary.notified++
    if (level > 0) summary.escalated++
  }

  // ── Payment methods expiring ─────────────────────────────────────────────
  // The root cause of a failed auto-renewal is usually a dead card, and that
  // fails silently well before any domain does.
  const cardHorizon = new Date()
  cardHorizon.setDate(cardHorizon.getDate() + 30)
  const expiringCards = await db.projectAsset.findMany({
    where: { paymentExpiresAt: { not: null, lte: cardHorizon } },
    select: {
      id: true,
      name: true,
      paymentMethod: true,
      paymentExpiresAt: true,
      ownerId: true,
      projectId: true,
      lastCardAlertAt: true,
      project: { select: { name: true, slug: true } },
    },
  })

  for (const card of expiringCards) {
    if (!card.paymentExpiresAt) continue
    const days = daysUntil(card.paymentExpiresAt)
    // A fortnightly heads-up, not an outage siren - and its OWN timestamp, so it
    // neither suppresses nor is suppressed by the renewal alert above.
    if (days > 30) continue
    if (days > 0 && days % 14 !== 0) continue
    if (alertedToday(card.lastCardAlertAt)) continue

    const cardLink = projectMonitoringLink(card.project.slug, card.projectId)
    await notifyAudience({
      level: days <= 0 ? 1 : 0,
      ownerId: card.ownerId,
      projectId: card.projectId,
      title: "Payment method expiring",
      message: `${card.paymentMethod ?? "The card"} paying for ${card.name} (${card.project.name}) ${days <= 0 ? "has EXPIRED" : `expires in ${days} days`}. Renewals on it will start failing - this is exactly how a domain lapses with auto-renew switched on.`,
      type: "warning",
      severity: "warning",
      link: cardLink,
    })
    await db.projectAsset.update({
      where: { id: card.id },
      data: { lastCardAlertAt: new Date() },
    })
    summary.notified++
  }

  return summary
}
