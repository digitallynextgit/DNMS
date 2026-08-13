import { NextRequest } from "next/server"
import { withSession } from "@/server/api-handler"
import { ok } from "@/lib/api-response"
import { getMyReferrals } from "@/features/referrals/server/referrals.queries"
import { submitReferral } from "@/features/referrals/server/referrals.service"
import type { Session } from "next-auth"

// The caller's OWN referrals. Self-scoped: the employee id comes from the
// session and is never read off the request, so nobody can list somebody else's.

// GET /api/referrals
export const GET = withSession(
  async (_req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) =>
    ok(await getMyReferrals(session.user.id)),
)

// POST /api/referrals - refer somebody for an open role.
export const POST = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) =>
    ok(await submitReferral(session.user.id, await req.json()), { status: 201 }),
)
