import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { runUnscoped } from "@/server/tenant-context"
import type { Session } from "next-auth"

/**
 * Hosts the server will POST push messages to. The endpoint is an arbitrary
 * URL from the request body, and lib/web-push.ts later delivers to it from the
 * server - without this allow-list any signed-in employee could register an
 * internal URL and turn the notification sender into an SSRF proxy. These are
 * the push services of every browser engine that supports Web Push.
 */
const PUSH_HOSTS = [
  "fcm.googleapis.com", // Chrome / Chromium / Edge (FCM)
  ".push.apple.com", // Safari (e.g. web.push.apple.com)
  ".notify.windows.com", // legacy Edge (WNS)
  "push.services.mozilla.com", // Firefox (autopush)
]

function isKnownPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint)
    if (url.protocol !== "https:") return false
    return PUSH_HOSTS.some((h) =>
      h.startsWith(".")
        ? url.hostname.endsWith(h)
        : url.hostname === h || url.hostname.endsWith(`.${h}`),
    )
  } catch {
    return false
  }
}

// POST /api/notifications/push   { endpoint, keys: { p256dh, auth } }
// Register this browser for Web Push. Idempotent - re-subscribing the same
// endpoint just re-points it at the current user (e.g. after a device is shared
// or a different person logs in on it).
export const POST = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const body = (await req.json().catch(() => null)) as {
        endpoint?: string
        keys?: { p256dh?: string; auth?: string }
      } | null

      const endpoint = body?.endpoint
      const p256dh = body?.keys?.p256dh
      const auth = body?.keys?.auth
      if (!endpoint || !p256dh || !auth) {
        return NextResponse.json({ error: "Invalid subscription" }, { status: 400 })
      }
      if (!isKnownPushEndpoint(endpoint)) {
        return NextResponse.json({ error: "Unrecognised push service" }, { status: 400 })
      }

      const userAgent = req.headers.get("user-agent")?.slice(0, 300) ?? null

      // Which SITE is registering. Taken from the Origin header, never from the
      // body: the browser sets it and a caller cannot forge it, and the whole
      // point is to tell a real registration from a dev server pointed at this
      // same database. Falls back to the Referer's origin for the rare client
      // that omits Origin on a same-origin POST.
      const origin = (() => {
        const header = req.headers.get("origin")
        if (header) return header
        const referer = req.headers.get("referer")
        if (!referer) return null
        try {
          return new URL(referer).origin
        } catch {
          return null
        }
      })()

      // The endpoint identifies a BROWSER and is globally unique - but its row
      // may belong to an employee of ANOTHER tenant (same person, two
      // workspaces, one browser). The tenant guard scopes the upsert's lookup,
      // so it would miss that row and the create would then hit the unique
      // index (P2002). Delete the endpoint unscoped, then create the row for
      // the current user - which also stops the previous owner's notifications
      // from reaching this browser.
      await runUnscoped(
        "push endpoint is device-global: re-pointing it to the signing-in user must cross tenants",
        () => db.pushSubscription.deleteMany({ where: { endpoint } }),
      )
      await db.pushSubscription.create({
        data: { employeeId: session.user.id, endpoint, p256dh, auth, userAgent, origin },
      })

      return NextResponse.json({ data: { ok: true } })
    } catch (error) {
      console.error("[notifications/push] POST error:", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

// DELETE /api/notifications/push?endpoint=...  - unsubscribe this browser.
export const DELETE = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const endpoint = req.nextUrl.searchParams.get("endpoint")
      if (!endpoint) return NextResponse.json({ error: "endpoint required" }, { status: 400 })
      await db.pushSubscription.deleteMany({
        where: { endpoint, employeeId: session.user.id },
      })
      return NextResponse.json({ data: { ok: true } })
    } catch (error) {
      console.error("[notifications/push] DELETE error:", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
