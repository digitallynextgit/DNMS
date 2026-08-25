import { withCron } from "@/server/cron-auth"
import { runMonthlyAccrual } from "@/features/leave/server/leave-accrual.service"

// DEPRECATED alias of /api/cron/leave-accrual, kept for schedules that still
// point at the old path. Runs once per tenant (M4).
export const dynamic = "force-dynamic"

export const GET = withCron("el-accrual", async () => {
  const year = new Date().getFullYear()
  return { deprecated: true, year, ...(await runMonthlyAccrual(year)) }
})
