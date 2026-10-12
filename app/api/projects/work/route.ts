import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withSession } from "@/server/api-handler"
import { ForbiddenError, ValidationError } from "@/lib/errors"
import { getEmployeeWork } from "@/features/projects/server/employee-work.queries"
import { currentPlanMonth } from "@/features/projects/lib/calendar-months"
import { resolveWorkReportScope } from "@/features/work-reports/server/work-report.scope"

// ?month=YYYY-MM (default this month) &employeeId= (default you). Someone else's work follows the
// work-report rule: admin/HR see anyone, a manager their reporting line.
export const GET = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    const month = req.nextUrl.searchParams.get("month") || currentPlanMonth()
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new ValidationError("month must be YYYY-MM")

    const employeeId = req.nextUrl.searchParams.get("employeeId") || session.user.id
    if (employeeId !== session.user.id) {
      const scope = await resolveWorkReportScope(session)
      if (scope.allowedIds && !scope.allowedIds.includes(employeeId)) {
        throw new ForbiddenError("You can only see your own work and your team's")
      }
    }

    return NextResponse.json({ data: await getEmployeeWork(employeeId, month) })
  },
)
