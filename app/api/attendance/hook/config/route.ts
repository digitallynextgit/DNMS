import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { getConfig } from "@/server/app-config"
import { FOUNDING_TENANT_ID } from "@/server/tenant-context"
import type { Session } from "next-auth"

/**
 * GET /api/attendance/hook/config
 *
 * Everything the Devices page needs to set up (and verify) the realtime push
 * path, in one call.
 *
 * The terminal sits on a private LAN, so a hosted DNMS can never pull from it.
 * The live path is the other direction: the device POSTs each punch outbound to
 * /api/attendance/hook/<secret>. This endpoint hands back the exact URL to paste
 * into the device, plus enough state to tell the admin whether it is actually
 * working rather than leaving them to guess.
 *
 * ── Why this is ATTENDANCE_WRITE ──────────────────────────────────────────────
 * The returned URL CONTAINS the shared secret, and that secret authorises
 * writing attendance - which is what people are paid on. Anyone who can already
 * write attendance loses nothing by seeing it; nobody else may. It is therefore
 * behind the same permission as the Devices page itself, and must never be
 * logged, cached, or widened to a read-only role.
 */
export const GET = withAuth(
  PERMISSIONS.ATTENDANCE_WRITE,
  async (_req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    // This tenant's OWN secret (M4), falling back to the platform-wide
    // environment variable for Digitally Next, whose terminal was configured
    // with it before per-tenant secrets existed. A tenant with neither has no
    // push set up, and the UI says so rather than showing a URL that cannot work.
    const tenant = await db.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: { hookSecret: true },
    })
    const secret =
      tenant?.hookSecret ??
      (session.user.tenantId === FOUNDING_TENANT_ID
        ? (process.env.ATTENDANCE_HOOK_SECRET ?? "")
        : "")

    // Same resolution order the email layer uses: an explicitly configured
    // APP_URL wins, otherwise the auth origin.
    const base = ((await getConfig("APP_URL")) || process.env.NEXTAUTH_URL || "").replace(/\/$/, "")

    let host = ""
    try {
      host = base ? new URL(base).hostname : ""
    } catch {
      host = ""
    }

    // A device on the office LAN cannot POST to localhost / 127.0.0.1 - that
    // would just be the terminal talking to itself. Nor to a bare http:// origin
    // on the public internet, where the secret would cross the wire in clear.
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
        // Only built when there is a secret AND somewhere reachable to send it.
        url: secret && base ? `${base}/api/attendance/hook/${encodeURIComponent(secret)}` : null,
        baseUrl: base || null,
        // Surfaced so the UI can explain the problem instead of showing a URL
        // that will silently never receive anything.
        reachable: Boolean(base) && !isLoopback,
        isLoopback,
        isPrivate,
        isHttps,
        devices,
      },
    })
  },
)
