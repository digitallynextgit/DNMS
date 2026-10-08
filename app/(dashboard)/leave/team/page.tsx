import { redirect } from "next/navigation"
import { tenantPath } from "@/server/tenant-request"

// Old links, bookmarks and notifications land on the Leave Directory's Requests tab.
export default async function TeamLeaveRedirect() {
  redirect(await tenantPath("/leave/leave-directory"))
}
