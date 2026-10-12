import { timingSafeEqual } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withAuth } from "@/server/api-handler"
import { assertPlatformScope } from "@/server/platform-admin"
import { PERMISSIONS } from "@/lib/constants"
import { createAuditLog, isAdmin_Session } from "@/lib/audit"
import {
  DRIVE_STATE_COOKIE,
  connectedDriveAccount,
  driveRedirectUri,
  exchangeDriveCode,
  requestOrigin,
  revokeDriveToken,
  saveDriveConnection,
} from "@/lib/google-drive-oauth"

function sameState(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

// Google sends the admin back here after the consent screen. Always ends on the Integrations page,
// with ?drive=connected or ?drive=error&reason=... for the card to show.
export const GET = withAuth(
  PERMISSIONS.SETTINGS_WRITE,
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    assertPlatformScope(session)
    const origin = requestOrigin(req)
    const back = (query: string) => {
      const res = NextResponse.redirect(`${origin}/admin/integrations?${query}`)
      res.cookies.set(DRIVE_STATE_COOKIE, "", { path: "/api/integrations/google-drive", maxAge: 0 })
      return res
    }
    const fail = (reason: string) => back(`drive=error&reason=${encodeURIComponent(reason)}`)

    const params = req.nextUrl.searchParams
    if (params.get("error")) return fail("Google sign-in was cancelled.")
    const code = params.get("code")
    const state = params.get("state")
    const expected = req.cookies.get(DRIVE_STATE_COOKIE)?.value
    if (!code || !state || !expected || !sameState(state, expected)) {
      return fail("The sign-in link expired. Click Connect Google account again.")
    }

    try {
      const { refreshToken, account } = await exchangeDriveCode(code, driveRedirectUri(req))
      // Files DNMS made in one account are invisible to another, so a silent swap would hide them all.
      const current = await connectedDriveAccount()
      if (current && current.email.toLowerCase() !== account.email.toLowerCase()) {
        await revokeDriveToken(refreshToken)
        return fail(
          `DNMS is connected to ${current.email}. Sign in with that account, or disconnect it first.`,
        )
      }
      await saveDriveConnection(
        refreshToken,
        account,
        isAdmin_Session(session) ? null : (session.user.name ?? null),
      )
      await createAuditLog(session, {
        action: "SETTINGS_UPDATE",
        module: "admin",
        entityType: "AppSetting",
        entityId: "GOOGLE_DRIVE_ACCOUNT",
        changes: { googleDrive: "connected", account: account.email },
      })
      return back("drive=connected")
    } catch (e) {
      console.error("[google-drive] connect failed", e)
      return fail(e instanceof Error ? e.message : "Could not connect the Google account.")
    }
  },
)
