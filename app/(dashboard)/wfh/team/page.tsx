import { redirect } from "next/navigation"
import { tenantPath } from "@/server/tenant-request"

// Old links land on the Work From Home page's "WFH Requests" tab.
export default async function TeamWfhRedirect() {
  redirect(await tenantPath("/wfh"))
}
