import { redirect } from "next/navigation"
import { tenantPath } from "@/server/tenant-request"

// The Performance module is the self + manager evaluation scorecard.
export default async function PerformancePage() {
  redirect(await tenantPath("/performance/evaluations"))
}
