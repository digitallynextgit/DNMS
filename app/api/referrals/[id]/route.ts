import { NextRequest } from "next/server"
import { withAuth } from "@/server/api-handler"
import { ok } from "@/lib/api-response"
import { fail } from "@/lib/api-response"
import { PERMISSIONS } from "@/lib/constants"
import {
  linkReferralHire,
  markReferralRewardPaid,
} from "@/features/referrals/server/referrals.service"

// HR actions: linking a hire starts the one-year reward clock; mark-paid records money going out.
export const PATCH = withAuth(
  PERMISSIONS.RECRUITMENT_WRITE,
  async (req: NextRequest, ctx: { params: Record<string, string> }) => {
    const body = (await req.json()) as { action?: string } & Record<string, unknown>

    switch (body.action) {
      case "link-hire":
        return ok(await linkReferralHire(ctx.params.id, body))
      case "mark-paid":
        return ok(await markReferralRewardPaid(ctx.params.id, body))
      default:
        return fail("BAD_REQUEST", "Unknown action.", 400)
    }
  },
)
