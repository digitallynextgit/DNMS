import { redirect } from "next/navigation"
import { tenantPath } from "@/server/tenant-request"

// The payroll console moved to /payroll/payroll-directory; keep the bare /payroll
// URL working (bookmarks, the Payroll nav group) by forwarding to it.
export default async function PayrollPage() {
  redirect(await tenantPath("/payroll/payroll-directory"))
}
