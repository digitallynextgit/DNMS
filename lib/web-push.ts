import "server-only"

import webpush from "web-push"
import { db } from "@/server/db"
import { isPushDeliverable } from "@/lib/push-targets"

// =============================================================================
// Web Push delivery.
//
// The SSE stream (server/notification-stream.ts) only reaches a LIVE page. This
// module reaches the browser itself, so a notification still lands when every
// DNMS tab is closed. Both run together: SSE updates the in-app UI instantly,
// push covers the "not looking at the app" case.
// =============================================================================

let configured: boolean | null = null

function ensureConfigured(): boolean {
  if (configured !== null) return configured
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || "mailto:hr@digitallynext.com"
  if (!publicKey || !privateKey) {
    configured = false
    return false
  }
  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
  return true
}

export function isPushConfigured(): boolean {
  return ensureConfigured()
}

/**
 * The one site whose browser registrations may be pushed to.
 *
 * Everything else registered against this database - a developer running
 * localhost against the production DATABASE_URL, a preview deployment - is
 * skipped. Without this, one notification arrived twice: once from the deployed
 * site and once from a localhost service worker that is still installed in the
 * browser and wakes on push without ever contacting localhost, so stopping the
 * dev server did not stop it.
 *
 * Read from the environment rather than the app_settings table because this runs
 * on every notification, including from cron, and must not depend on a warmed
 * config cache. NEXT_PUBLIC_APP_URL is the canonical public address; NEXTAUTH_URL
 * is the fallback the rest of the app already uses.
 */
function appOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL
  if (!raw) return null
  try {
    return new URL(raw).origin
  } catch {
    return null
  }
}

export interface PushPayload {
  id?: string
  title: string
  message: string
  link?: string | null
}

/**
 * Fire-and-forget push to every browser this employee has subscribed. Dead
 * subscriptions (404/410 = the browser dropped it) are pruned so the table
 * doesn't accumulate garbage.
 */
export async function sendPushToEmployee(employeeId: string, payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) return

  // Filtered in JS rather than SQL: the rules in isPushDeliverable() handle a
  // NULL origin and an unknown app origin differently, which is awkward to
  // express as a Prisma where-clause and easy to get subtly wrong. A person has
  // a handful of registrations, so this costs nothing and is directly testable.
  const origin = appOrigin()
  const all = await db.pushSubscription.findMany({
    where: { employeeId },
    select: { id: true, endpoint: true, p256dh: true, auth: true, origin: true },
  })
  const subs = all.filter((s) => isPushDeliverable(s.origin, origin))
  if (subs.length === 0) return

  const body = JSON.stringify({
    id: payload.id,
    title: payload.title,
    message: payload.message,
    link: payload.link ?? "/dashboard",
  })

  const dead: string[] = []
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        )
      } catch (err) {
        const status = (err as { statusCode?: number })?.statusCode
        if (status === 404 || status === 410) dead.push(s.id)
        else console.error("[web-push] send failed:", status ?? err)
      }
    }),
  )

  if (dead.length > 0) {
    await db.pushSubscription.deleteMany({ where: { id: { in: dead } } }).catch(() => {})
  }
}
