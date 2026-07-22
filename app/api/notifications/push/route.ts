import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import type { Session } from "next-auth"

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

      const userAgent = req.headers.get("user-agent")?.slice(0, 300) ?? null

      await db.pushSubscription.upsert({
        where: { endpoint },
        create: { employeeId: session.user.id, endpoint, p256dh, auth, userAgent },
        update: { employeeId: session.user.id, p256dh, auth, userAgent },
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
