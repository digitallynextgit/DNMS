import { redirect } from "next/navigation"

// The HR attendance console moved to /attendance/attendance-directory; keep the
// bare /attendance URL working (bookmarks, the Attendance nav group).
export default function AttendancePage() {
  redirect("/attendance/attendance-directory")
}
