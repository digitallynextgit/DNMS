import { redirect } from "next/navigation"
import { tenantPath } from "@/server/tenant-request"

// The team approval queue is now part of the Leave Directory (Requests tab).
// Keep this route as a redirect so old links / bookmarks / notifications resolve.
export default async function TeamLeaveRedirect() {
  redirect(await tenantPath("/leave/leave-directory"))
}
