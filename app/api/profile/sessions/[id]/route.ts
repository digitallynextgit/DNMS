import { NextRequest, NextResponse } from "next/server"
import { withSession } from "@/server/api-handler"
import { revokeMyDevice } from "@/features/auth/server/sessions.service"
import type { Session } from "next-auth"

export const DELETE = withSession(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    await revokeMyDevice(session, ctx.params.id!)
    return NextResponse.json({ data: { ok: true } })
  },
)
