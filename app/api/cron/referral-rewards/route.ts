import { withCron } from "@/server/cron-auth"
import { runReferralEligibility } from "@/features/referrals/server/referrals.service"

// Daily, 30 4 * * * UTC (10:00 IST). Latched by rewardNotifiedAt, so catching up never repeats a notice.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const GET = withCron("referral-rewards", async () => {
  try {
    return await runReferralEligibility()
  } catch (error) {
    console.error("[CRON_REFERRAL_REWARDS]", error)
    throw error
  }
})
