import { NextRequest } from "next/server"
import { withAuth } from "@/server/api-handler"
import { ok } from "@/lib/api-response"
import { PERMISSIONS } from "@/lib/constants"
import { getAllReferrals } from "@/features/referrals/server/referrals.queries"

// recruitment:write: exposes candidate contact details and salary-derived reward amounts.
export const GET = withAuth(PERMISSIONS.RECRUITMENT_WRITE, async (_req: NextRequest) =>
  ok(await getAllReferrals()),
)
