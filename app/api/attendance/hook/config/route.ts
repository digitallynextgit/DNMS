import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { getConfig } from "@/server/app-config"
import { FOUNDING_TENANT_ID } from "@/server/tenant-context"
import type { Session } from "next-auth"

// The returned URL contains the hook secret (which can write attendance), so this stays behind
// ATTENDANCE_WRITE and must never be logged, cached or opened to a read-only role.
export const GET = withAuth(
  PERMISSIONS.ATTENDANCE_WRITE,
  async (_req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    // Falls back to the platform env secret for Digitally Next, whose terminal predates per-tenant secrets.
    const tenant = await db.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: { hookSecret: true },
    })
    const secret =
      tenant?.hookSecret ??
      (session.user.tenantId === FOUNDING_TENANT_ID
        ? (process.env.ATTENDANCE_HOOK_SECRET ?? "")
        : "")

    const base = ((await getConfig("APP_URL")) || process.env.NEXTAUTH_URL || "").replace(/\/$/, "")

    let host = ""
    try {
      host = base ? new URL(base).hostname : ""
    } catch {
      host = ""
    }

    // A LAN device can't reach localhost, and plain http on the public internet would leak the secret.
    const isLoopback = host === "localhost" || host === "127.0.0.1" || host === "::1"
    const isPrivate = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
    const isHttps = base.startsWith("https://")

    const devices = await db.hikvisionDevice.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        ipAddress: true,
        macAddress: true,
        lastSyncAt: true,
        lastPushAt: true,
      },
      orderBy: { name: "asc" },
    })

    return NextResponse.json({
      data: {
        secretConfigured: Boolean(secret),
        url: secret && base ? `${base}/api/attendance/hook/${encodeURIComponent(secret)}` : null,
        baseUrl: base || null,
        reachable: Boolean(base) && !isLoopback,
        isLoopback,
        isPrivate,
        isHttps,
        devices,
      },
    })
  },
)
