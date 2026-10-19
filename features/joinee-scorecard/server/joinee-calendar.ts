import "server-only"

import { db } from "@/server/db"
import { toDateOnly } from "@/lib/dates"
import type { LeaveSpan } from "../lib/scorecard"

/**
 * Company holidays and the joinee's approved leave over a stretch of days, for dayStatus(). Read
 * live, so leave approved after the card started still shows. Floating holidays count as working.
 */
export async function calendarFor(employeeId: string, from: Date, to: Date) {
  const [holidays, leaves] = await Promise.all([
    db.holiday.findMany({
      where: { isOptional: false, date: { gte: from, lte: to } },
      select: { date: true, name: true },
    }),
    db.leaveRequest.findMany({
      where: { employeeId, status: "APPROVED", startDate: { lte: to }, endDate: { gte: from } },
      select: {
        startDate: true,
        endDate: true,
        totalDays: true,
        leaveType: { select: { name: true } },
      },
    }),
  ])
  return {
    holidays: new Map(holidays.map((h) => [toDateOnly(h.date), h.name])),
    leaves: leaves.map(
      (l): LeaveSpan => ({
        start: l.startDate,
        end: l.endDate,
        totalDays: l.totalDays,
        type: l.leaveType.name,
      }),
    ),
  }
}
