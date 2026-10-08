import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { runUnscoped } from "@/server/tenant-context"
import type { Session } from "next-auth"

// SSRF guard: the endpoint comes from the request body and the server POSTs to it, so only the
// browsers' push services are allowed.
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

// Idempotent: re-subscribing an endpoint re-points it at the current user.
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

      // From the Origin header (not the body), so a dev server on the same DB can be told apart.
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

      // The endpoint may belong to another tenant's employee (same browser), which the scoped upsert
      // would miss and then hit P2002 - so delete it unscoped first, then create.
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
