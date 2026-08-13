import { NextRequest } from "next/server"
import { withAuth } from "@/server/api-handler"
import { ok } from "@/lib/api-response"
import { PERMISSIONS } from "@/lib/constants"
import { getAllReferrals } from "@/features/referrals/server/referrals.queries"

// GET /api/referrals/admin - every referral in the business, for HR's queue.
// Gated on recruitment:write because this exposes candidate contact details and
// reward amounts derived from a new joiner's salary.
export const GET = withAuth(PERMISSIONS.RECRUITMENT_WRITE, async (_req: NextRequest) =>
  ok(await getAllReferrals()),
)
