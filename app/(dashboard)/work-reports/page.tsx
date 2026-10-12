import { redirect } from "next/navigation"
import { tenantPath } from "@/server/tenant-request"

// The work report is now the "Progress report" button on Progress, using that page's filters.
export default async function WorkReportsPage() {
  redirect(await tenantPath("/projects/progress"))
}
