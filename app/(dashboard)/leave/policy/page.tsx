import { redirect } from "next/navigation"
import { tenantPath } from "@/server/tenant-request"

// Leave Policy has been merged into Leave Types & Policy. Keep this route as a
// redirect so old links / bookmarks still land on the right tab.
export default async function LeavePolicyRedirect() {
  redirect(await tenantPath("/leave/types?tab=policy"))
}
