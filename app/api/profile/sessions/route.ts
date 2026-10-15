import { NextRequest, NextResponse } from "next/server"
import { withSession } from "@/server/api-handler"
import { listMyDevices, revokeMyOtherDevices } from "@/features/auth/server/sessions.service"
import type { Session } from "next-auth"

export const GET = withSession(async (_req: NextRequest, _ctx: unknown, session: Session) =>
  NextResponse.json({ data: await listMyDevices(session) }),
)

/** "Log out of all other devices". */
export const DELETE = withSession(async (_req: NextRequest, _ctx: unknown, session: Session) =>
  NextResponse.json({ data: { revoked: await revokeMyOtherDevices(session) } }),
)
