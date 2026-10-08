import { redirect } from "next/navigation"
import { tenantPath } from "@/server/tenant-request"

export default async function ProjectsPage() {
  redirect(await tenantPath("/projects/my-projects"))
}
