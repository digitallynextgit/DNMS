import { withCron } from "@/server/cron-auth"
import { sweepOverdueExits } from "@/features/hr-checklists/server/exit-sweep.service"

// Daily backstop: catches anyone past their last working day whose exit sign-off is still open,
// and tells HR.
export const dynamic = "force-dynamic"

export const GET = withCron("exit-deactivation", async () => sweepOverdueExits())
