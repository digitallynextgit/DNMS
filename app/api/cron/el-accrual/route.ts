import { withCron } from "@/server/cron-auth"
import { runMonthlyAccrual } from "@/features/leave/server/leave-accrual.service"

// Deprecated alias of /api/cron/leave-accrual, kept for schedules still on the old path.
export const dynamic = "force-dynamic"

export const GET = withCron("el-accrual", async () => {
  const year = new Date().getFullYear()
  return { deprecated: true, year, ...(await runMonthlyAccrual(year)) }
})
