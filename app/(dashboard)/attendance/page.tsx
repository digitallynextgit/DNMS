import { redirect } from "next/navigation"
import { tenantPath } from "@/server/tenant-request"

// The HR attendance console moved to /attendance/attendance-directory; keep the
// bare /attendance URL working (bookmarks, the Attendance nav group).
export default async function AttendancePage() {
  redirect(await tenantPath("/attendance/attendance-directory"))
}
