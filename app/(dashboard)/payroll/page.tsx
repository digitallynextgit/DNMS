import { redirect } from "next/navigation"
import { tenantPath } from "@/server/tenant-request"

// Keeps the bare /payroll URL working (bookmarks, the nav group).
export default async function PayrollPage() {
  redirect(await tenantPath("/payroll/payroll-directory"))
}
