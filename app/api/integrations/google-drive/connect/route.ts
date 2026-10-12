import { randomBytes } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withAuth } from "@/server/api-handler"
import { assertPlatformScope } from "@/server/platform-admin"
import { PERMISSIONS } from "@/lib/constants"
import {
  DRIVE_STATE_COOKIE,
  driveAuthUrl,
  driveRedirectUri,
  requestOrigin,
} from "@/lib/google-drive-oauth"

// "Connect Google account": off to Google's consent screen. The state cookie ties the callback to
// this browser, so a forged callback link can't attach someone else's Drive.
export const GET = withAuth(
  PERMISSIONS.SETTINGS_WRITE,
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    assertPlatformScope(session)
    const origin = requestOrigin(req)
    const state = randomBytes(24).toString("base64url")
    const url = await driveAuthUrl(driveRedirectUri(req), state)
    if (!url) {
      const reason = encodeURIComponent("Set the Google Drive client ID and secret first.")
      return NextResponse.redirect(`${origin}/admin/integrations?drive=error&reason=${reason}`)
    }
    const res = NextResponse.redirect(url)
    res.cookies.set(DRIVE_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: origin.startsWith("https://"),
      path: "/api/integrations/google-drive",
      maxAge: 600,
    })
    return res
  },
)
