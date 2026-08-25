import { redirect } from "next/navigation"
import { tenantPath } from "@/server/tenant-request"

// The employee directory listing now lives at /employees/employee-directory.
// Keep /employees working (bookmarks, old links) by redirecting to it.
export default async function EmployeesIndexPage() {
  redirect(await tenantPath("/employees/employee-directory"))
}
