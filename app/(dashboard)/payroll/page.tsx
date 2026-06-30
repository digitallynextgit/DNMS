import { redirect } from "next/navigation"

// The payroll console moved to /payroll/payroll-directory; keep the bare /payroll
// URL working (bookmarks, the Payroll nav group) by forwarding to it.
export default function PayrollPage() {
  redirect("/payroll/payroll-directory")
}
