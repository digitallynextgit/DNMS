import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withSession } from "@/server/api-handler"
import { ForbiddenError } from "@/lib/errors"
import { SYSTEM_ROLES } from "@/lib/constants"
import { getLeadershipDashboard } from "@/features/dashboard/server/leadership.queries"

// The admin home page: the company today, what waits on a decision, projects needing a look,
// delivery, and the people and money numbers. Admin and admin_ only.
export const dynamic = "force-dynamic"

export const GET = withSession(async (_req: NextRequest, _ctx: unknown, session: Session) => {
  const roles = session.user.roles ?? []
  if (!roles.includes(SYSTEM_ROLES.ADMIN) && !roles.includes(SYSTEM_ROLES.ADMIN_)) {
    throw new ForbiddenError("The leadership dashboard is for admins.")
  }
  return NextResponse.json({ data: await getLeadershipDashboard(session) })
})
