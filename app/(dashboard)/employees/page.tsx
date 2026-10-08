import { redirect } from "next/navigation"
import { tenantPath } from "@/server/tenant-request"

// Keeps /employees working (bookmarks, old links).
export default async function EmployeesIndexPage() {
  redirect(await tenantPath("/employees/employee-directory"))
}
