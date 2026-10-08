import { redirect } from "next/navigation"
import { tenantPath } from "@/server/tenant-request"

// Keeps the bare /attendance URL working (bookmarks, the nav group).
export default async function AttendancePage() {
  redirect(await tenantPath("/attendance/attendance-directory"))
}
