import { redirect } from "next/navigation"
import { tenantPath } from "@/server/tenant-request"

// Pairing lives on the profile's Security tab now; old links and help pages still land there.
export default async function PairPhonePage() {
  redirect(await tenantPath("/profile?tab=security"))
}
