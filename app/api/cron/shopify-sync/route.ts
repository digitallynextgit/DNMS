import { withCron } from "@/server/cron-auth"
import { runShopifySweep } from "@/features/projects/server/shopify-sync.service"

// Manual / external-cron trigger; server/scheduler.ts also runs this job in-process every 15 minutes.

export const runtime = "nodejs"
export const maxDuration = 300

export const GET = withCron("shopify-sync", async () => runShopifySweep())
