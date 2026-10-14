import { redirect } from "next/navigation"
import { tenantPath } from "@/server/tenant-request"

// My Tasks is now the Tasks tab of My Work; old links and notifications still land there.
export default async function MyTasksPage() {
  redirect(await tenantPath("/projects/my-work"))
}
