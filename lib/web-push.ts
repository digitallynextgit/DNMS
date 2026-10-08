import "server-only"

import webpush from "web-push"
import { db } from "@/server/db"
import { isPushDeliverable } from "@/lib/push-targets"

// Web Push reaches the browser even with every tab closed; the SSE stream only reaches live pages.

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
 * The one site whose registrations get pushes (rules in lib/push-targets.ts). Read from env, not
 * app_settings, because it runs on every notification, including cron.
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

/** Fire-and-forget. Dead subscriptions (404/410) are pruned. */
export async function sendPushToEmployee(employeeId: string, payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) return

  // Filtered in JS: isPushDeliverable's NULL/unknown-origin rules are awkward in SQL, and a person has few registrations.
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
