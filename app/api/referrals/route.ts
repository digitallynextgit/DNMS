import { NextRequest } from "next/server"
import { withSession } from "@/server/api-handler"
import { ok } from "@/lib/api-response"
import { getMyReferrals } from "@/features/referrals/server/referrals.queries"
import { submitReferral } from "@/features/referrals/server/referrals.service"
import type { Session } from "next-auth"

// Self-scoped: the employee id comes from the session, never the request.

export const GET = withSession(
  async (_req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) =>
    ok(await getMyReferrals(session.user.id)),
)

export const POST = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) =>
    ok(await submitReferral(session.user.id, await req.json()), { status: 201 }),
)
