import { withCron } from "@/server/cron-auth"
import { sweepOverdueExits } from "@/features/hr-checklists/server/exit-sweep.service"

// Daily backstop for the notice period. Resignation approval no longer closes
// the account - HR's exit sign-off does - so this catches anyone whose last
// working day has passed while their clearance sits unfinished, and tells HR
// the process was not followed. Runs once per tenant (M4).
export const dynamic = "force-dynamic"

export const GET = withCron("exit-deactivation", async () => sweepOverdueExits())
