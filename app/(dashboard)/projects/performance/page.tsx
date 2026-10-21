import { redirect } from "next/navigation"
import { tenantPath } from "@/server/tenant-request"

// Team Performance is now a tab of Progress & Performance; old links and bookmarks land there.
export default async function TeamPerformanceRedirect() {
  redirect(await tenantPath("/projects/progress?tab=performance"))
}
