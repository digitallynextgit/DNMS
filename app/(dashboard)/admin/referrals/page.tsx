import { redirect } from "next/navigation"
import { tenantPath } from "@/server/tenant-request"

import { auth } from "@/server/auth"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { ReferralsAdmin } from "@/features/referrals"

export const metadata = {
  title: "Referrals",
  description: "Manage the employee referral program and its rewards.",
}

/** Gated on the server too: it shows candidate contacts and salary-derived reward amounts. */
export default async function AdminReferralsPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (!hasPermission(session, PERMISSIONS.RECRUITMENT_WRITE))
    redirect(await tenantPath("/dashboard"))

  return <ReferralsAdmin />
}
