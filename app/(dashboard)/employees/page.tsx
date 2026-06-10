import { redirect } from "next/navigation"

// The employee directory listing now lives at /employees/employee-directory.
// Keep /employees working (bookmarks, old links) by redirecting to it.
export default function EmployeesIndexPage() {
  redirect("/employees/employee-directory")
}
