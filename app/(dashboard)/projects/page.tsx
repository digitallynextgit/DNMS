import { redirect } from "next/navigation"
import { tenantPath } from "@/server/tenant-request"

// The projects board now lives at /projects/my-projects.
export default async function ProjectsPage() {
  redirect(await tenantPath("/projects/my-projects"))
}
