import { redirect } from "next/navigation"

import { auth } from "@/server/auth"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { ReferralsAdmin } from "@/features/referrals"

export const metadata = { title: "Referrals" }

/**
 * HR's referral queue. Gated on the server as well as by the API: this page
 * shows candidate contact details and reward amounts derived from a new
 * joiner's salary, so it must not render at all for the wrong person.
 */
export default async function AdminReferralsPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (!hasPermission(session, PERMISSIONS.RECRUITMENT_WRITE)) redirect("/dashboard")

  return <ReferralsAdmin />
}
