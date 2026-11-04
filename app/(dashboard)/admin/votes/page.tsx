import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { tenantPath } from "@/server/tenant-request"

import { auth } from "@/server/auth"
import { isAdmin_ } from "@/lib/permissions"
import { VOTE_MANAGER_ROLES } from "@/lib/constants"
import { VotesAdmin } from "@/features/votes"

export const metadata: Metadata = {
  title: "Votes & Events",
  description: "Run voting events and see the live results.",
}

/** Admins and the HR team only; the API refuses everyone else as well. */
export default async function AdminVotesPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const allowed =
    isAdmin_(session) || session.user.roles.some((r) => VOTE_MANAGER_ROLES.includes(r))
  if (!allowed) redirect(await tenantPath("/votes"))

  return <VotesAdmin />
}
