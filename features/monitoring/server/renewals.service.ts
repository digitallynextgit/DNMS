// Renewal register: reminders fire at fixed STAGES (not daily); past expiry it nags daily and
// escalates.

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

/** Already alerted today? The scheduler ticks hourly; per-asset timestamps keep "daily" daily. */
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

/** The smallest stage the asset is inside (20 days out -> 30), or null beyond the widest.
 *  Searched ascending - descending would always match 60. */
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

/** Nudge the owners of anything near expiry. `lastAlertStage` means an asset alerts again only
 *  on entering a tighter stage. */
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

    // Alert on entering a tighter stage; overdue (stage 0) repeats, at most once a day.
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

    // Auto-renew is not reassurance (it was on for the domain that lapsed), so the message says so.
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

  // Expiring payment methods: a dead card is the usual cause of a failed auto-renewal.
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
    // A fortnightly heads-up with its own timestamp, independent of the renewal alert above.
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
