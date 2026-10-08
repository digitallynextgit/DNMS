import { redirect } from "next/navigation"
import { tenantPath } from "@/server/tenant-request"

export default async function PerformancePage() {
  redirect(await tenantPath("/performance/evaluations"))
}
