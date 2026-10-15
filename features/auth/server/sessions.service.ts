import "server-only"

import type { Session } from "next-auth"
import { db } from "@/server/db"
import { runUnscoped } from "@/server/tenant-context"
import { revokeAllForUser, revokeSessionById } from "@/server/mobile-auth"
import { NotFoundError } from "@/lib/errors"

// The "signed-in devices" list: browser sign-ins (web_sessions) and the phone app (mobile_sessions).

/** Browser tokens live 7 days, so a row older than that is dead even if nobody signed out. */
const WEB_SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export interface SignedInDevice {
  id: string
  kind: "web" | "mobile"
  /** "Chrome on Windows", "iPhone (DNMS app)". */
  label: string
  /** desktop | phone | tablet, for the icon. */
  form: "desktop" | "phone" | "tablet"
  ip: string | null
  signedInAt: Date
  lastSeenAt: Date | null
  current: boolean
}

/** A short "Browser on OS" from a user-agent string; good enough to tell devices apart. */
export function describeUserAgent(ua: string | null | undefined): {
  label: string
  form: SignedInDevice["form"]
} {
  const s = ua ?? ""
  const browser = /Edg\//.test(s)
    ? "Edge"
    : /OPR\//.test(s)
      ? "Opera"
      : /Firefox\//.test(s)
        ? "Firefox"
        : /Chrome\//.test(s)
          ? "Chrome"
          : /Safari\//.test(s)
            ? "Safari"
            : "Browser"
  const os = /iPhone|iPod/.test(s)
    ? "iPhone"
    : /iPad/.test(s)
      ? "iPad"
      : /Android/.test(s)
        ? "Android"
        : /Windows/.test(s)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(s)
            ? "macOS"
            : /CrOS/.test(s)
              ? "ChromeOS"
              : /Linux/.test(s)
                ? "Linux"
                : "unknown device"
  const form: SignedInDevice["form"] = /iPad|Tablet/.test(s)
    ? "tablet"
    : /iPhone|iPod|Android.*Mobile|Mobile/.test(s)
      ? "phone"
      : "desktop"
  return { label: `${browser} on ${os}`, form }
}

export async function listMyDevices(session: Session): Promise<SignedInDevice[]> {
  const userId = session.user.userId
  const current = session.user.sessionId
  const since = new Date(Date.now() - WEB_SESSION_MAX_AGE_MS)

  const web = await db.webSession.findMany({
    where: { userId, revokedAt: null, lastSeenAt: { gte: since } },
    orderBy: { lastSeenAt: "desc" },
  })
  // Phone sessions are tenant rows, but this person's devices span every company they are in.
  const mobile = await runUnscoped("profile: listing the person's own phone sessions", () =>
    db.mobileSession.findMany({
      where: { userId, revokedAt: null },
      orderBy: { lastSeenAt: "desc" },
      select: { id: true, platform: true, deviceName: true, createdAt: true, lastSeenAt: true },
    }),
  )

  const devices: SignedInDevice[] = [
    ...web.map((w) => {
      const { label, form } = describeUserAgent(w.userAgent)
      return {
        id: w.id,
        kind: "web" as const,
        label,
        form,
        ip: w.ip,
        signedInAt: w.createdAt,
        lastSeenAt: w.lastSeenAt,
        current: w.id === current,
      }
    }),
    ...mobile.map((m) => ({
      id: m.id,
      kind: "mobile" as const,
      label: `${m.deviceName?.trim() || (m.platform === "ios" ? "iPhone" : "Android phone")} (DNMS app)`,
      form: "phone" as const,
      ip: null,
      signedInAt: m.createdAt,
      lastSeenAt: m.lastSeenAt,
      current: false,
    })),
  ]
  // This device first, then most recently active.
  return devices.sort(
    (a, b) =>
      Number(b.current) - Number(a.current) ||
      (b.lastSeenAt?.getTime() ?? 0) - (a.lastSeenAt?.getTime() ?? 0),
  )
}

/** Signs one of the person's own devices out. The current browser can't be removed here. */
export async function revokeMyDevice(session: Session, id: string): Promise<void> {
  const userId = session.user.userId
  if (id === session.user.sessionId) throw new NotFoundError("Device")

  const web = await db.webSession.updateMany({
    where: { id, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  if (web.count > 0) return

  const mobile = await runUnscoped("profile: signing out the person's own phone", () =>
    db.mobileSession.findFirst({ where: { id, userId, revokedAt: null }, select: { id: true } }),
  )
  if (!mobile) throw new NotFoundError("Device")
  await revokeSessionById(mobile.id, "signed_out_from_profile")
}

/** Every device except this browser: other browsers and every phone. */
export async function revokeMyOtherDevices(session: Session): Promise<number> {
  const userId = session.user.userId
  const web = await db.webSession.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(session.user.sessionId ? { id: { not: session.user.sessionId } } : {}),
    },
    data: { revokedAt: new Date() },
  })
  const phones = await revokeAllForUser(userId, "signed_out_from_profile")
  return web.count + phones
}
