import { redirect } from "next/navigation"
import { tenantPath } from "@/server/tenant-request"

// Old links land on the Leave Types & Policy tab.
export default async function LeavePolicyRedirect() {
  redirect(await tenantPath("/leave/types?tab=policy"))
}
