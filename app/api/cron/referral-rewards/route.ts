import { withCron } from "@/server/cron-auth"
import { runReferralEligibility } from "@/features/referrals/server/referrals.service"

// Tells a referrer their reward is payable once the person they referred has
// completed a year.
//
// Run DAILY. The check is a date comparison, so a missed day only delays the
// notification - and it is latched (rewardNotifiedAt), so catching up cannot
// send the same person the same news twice.
//
//   30 4 * * *  (10:00 IST - the server runs on UTC)
//
// Auth: Authorization: Bearer <CRON_SECRET>

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const GET = withCron("referral-rewards", async () => {
  try {
    return await runReferralEligibility()
  } catch (error) {
    console.error("[CRON_REFERRAL_REWARDS]", error)
    // Rethrown so forEachTenant records it against this tenant and continues.
    throw error
  }
})
