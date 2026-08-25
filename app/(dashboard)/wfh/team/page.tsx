import { redirect } from "next/navigation"
import { tenantPath } from "@/server/tenant-request"

// WFH approvals are now part of the single Work From Home page (the "WFH Requests"
// tab, shown to managers/HR). Keep this route as a redirect for old links.
export default async function TeamWfhRedirect() {
  redirect(await tenantPath("/wfh"))
}
