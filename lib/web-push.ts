import "server-only"

import webpush from "web-push"
import { db } from "@/server/db"

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

  const subs = await db.pushSubscription.findMany({
    where: { employeeId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  })
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
