import "server-only"

import { db } from "@/server/db"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { ADHOC_LABEL } from "@/features/projects/lib/task-permissions"
import { VISIBLE_EMPLOYEE_FILTER } from "@/server/selects"
import { addDays, toDayKey, utilisation, weekCapacity } from "@/features/projects/lib/work-week"
import type { Session } from "next-auth"

// One week of logged hours per person vs. availability, all derived. Hours count on the task's
// DUE DATE (as the allocation sheet places them), not when the clock ran.

export type HoursScope = "self" | "team" | "all"

export interface WeeklyHoursDay {
  key: string
  off: "leave" | "holiday" | null
  hours: number
}

export interface WeeklyHoursPerson {
  id: string
  name: string
  days: WeeklyHoursDay[]
  logged: number
  allocated: number
  available: number
  /** Null when the whole week was leave - no expectation, not 0%. */
  utilisation: number | null
  focus: { client: string; hours: number; tasks: string[] }[]
}

export interface WeeklyHours {
  weekStart: string
  hoursPerDay: number
  scope: HoursScope
  people: WeeklyHoursPerson[]
  totals: { logged: number; allocated: number; available: number; utilisation: number | null }
}

/**
 * Whose hours this session may see: self; + teams they manage; + teams on projects they own (AM);
 * everyone with project:write. Derived from the session, never the request.
 */
export async function visiblePeople(
  session: Session,
): Promise<{ memberIds: string[]; scope: HoursScope }> {
  const me = session.user.id

  if (hasPermission(session, PERMISSIONS.PROJECT_WRITE)) {
    // The hours report is a user-facing roster, so admin_ stays out of it.
    const all = await db.employee.findMany({
      where: { isActive: true, ...VISIBLE_EMPLOYEE_FILTER },
      select: { id: true },
    })
    return { memberIds: all.map((e) => e.id), scope: "all" }
  }

  // ProjectTeamMember.projectId has no relation/FK, so resolve owned projects first and match on id.
  const ownedProjects = await db.project.findMany({
    where: { ownerId: me },
    select: { id: true },
  })
  const ownedProjectIds = ownedProjects.map((p) => p.id)

  const [teamMates, reports] = await Promise.all([
    db.projectTeamMember.findMany({
      where: {
        OR: [{ team: { managerId: me } }, { projectId: { in: ownedProjectIds } }],
        employee: { isActive: true },
      },
      select: { employeeId: true },
      distinct: ["employeeId"],
    }),
    // A line manager owns their reports' work wherever it sits, team or not.
    db.employee.findMany({ where: { managerId: me, isActive: true }, select: { id: true } }),
  ])

  const memberIds = [
    ...new Set([me, ...teamMates.map((m) => m.employeeId), ...reports.map((r) => r.id)]),
  ]
  return { memberIds, scope: memberIds.length > 1 ? "team" : "self" }
}

function dayKeysBetween(start: Date, end: Date): string[] {
  const out: string[] = []
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) out.push(toDayKey(d))
  return out
}

export async function getWeeklyHours(
  memberIds: string[],
  monday: Date,
  scope: HoursScope,
): Promise<WeeklyHours> {
  // Through Sunday, so a weekend due date still counts in the week's total.
  const rangeEnd = addDays(monday, 6)

  const [people, tasks, leaves, holidays, policy] = await Promise.all([
    db.employee.findMany({
      where: { id: { in: memberIds } },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    db.projectTask.findMany({
      where: { assigneeId: { in: memberIds }, dueDate: { gte: monday, lte: rangeEnd } },
      select: {
        title: true,
        assigneeId: true,
        dueDate: true,
        estimatedHours: true,
        loggedHours: true,
        inProgressSince: true,
        project: { select: { name: true } },
      },
    }),
    db.leaveRequest.findMany({
      where: {
        employeeId: { in: memberIds },
        status: "APPROVED",
        // Any overlap with the week, e.g. leave that began last month.
        startDate: { lte: rangeEnd },
        endDate: { gte: monday },
      },
      select: { employeeId: true, startDate: true, endDate: true },
    }),
    db.holiday.findMany({
      where: { date: { gte: monday, lte: rangeEnd }, isOptional: false },
      select: { date: true },
    }),
    db.attendancePolicy.findFirst({
      where: { isDefault: true },
      select: { workHoursPerDay: true },
    }),
  ])

  const hoursPerDay = policy?.workHoursPerDay ?? 8
  const holidayKeys = new Set(holidays.map((h) => toDayKey(h.date)))

  const leaveByPerson = new Map<string, Set<string>>()
  for (const l of leaves) {
    const set = leaveByPerson.get(l.employeeId) ?? new Set<string>()
    for (const k of dayKeysBetween(l.startDate, l.endDate)) set.add(k)
    leaveByPerson.set(l.employeeId, set)
  }

  // Banked + running time, undivided (parallel clocks each earn the full stretch), so a week CAN
  // exceed capacity: this is time-on-tasks, not hours-at-desk.
  const spent = (t: (typeof tasks)[number]) => {
    const live = t.inProgressSince
      ? Math.max(0, Date.now() - t.inProgressSince.getTime()) / 3_600_000
      : 0
    return (t.loggedHours ?? 0) + live
  }

  const rows: WeeklyHoursPerson[] = people.map((p) => {
    const mine = tasks.filter((t) => t.assigneeId === p.id)
    const capacity = weekCapacity({
      monday,
      hoursPerDay,
      leaveDayKeys: leaveByPerson.get(p.id) ?? new Set(),
      holidayKeys,
    })

    const byDay = new Map<string, number>()
    for (const t of mine) {
      if (!t.dueDate) continue
      const k = toDayKey(t.dueDate)
      byDay.set(k, (byDay.get(k) ?? 0) + spent(t))
    }

    // Per client, biggest first.
    const byClient = new Map<string, { hours: number; tasks: string[] }>()
    for (const t of mine) {
      const client = t.project?.name ?? ADHOC_LABEL
      const entry = byClient.get(client) ?? { hours: 0, tasks: [] }
      entry.hours += spent(t)
      entry.tasks.push(t.title)
      byClient.set(client, entry)
    }

    const logged = mine.reduce((s, t) => s + spent(t), 0)
    return {
      id: p.id,
      name: `${p.firstName} ${p.lastName}`.trim(),
      days: capacity.days.map((d) => ({ ...d, hours: byDay.get(d.key) ?? 0 })),
      logged,
      allocated: mine.reduce((s, t) => s + (t.estimatedHours ?? 0), 0),
      available: capacity.available,
      utilisation: utilisation(logged, capacity.available),
      focus: [...byClient.entries()]
        .map(([client, v]) => ({ client, hours: v.hours, tasks: v.tasks }))
        .sort((a, b) => b.hours - a.hours),
    }
  })

  const logged = rows.reduce((s, r) => s + r.logged, 0)
  const available = rows.reduce((s, r) => s + r.available, 0)

  return {
    weekStart: toDayKey(monday),
    hoursPerDay,
    scope,
    people: rows,
    totals: {
      logged,
      allocated: rows.reduce((s, r) => s + r.allocated, 0),
      available,
      utilisation: utilisation(logged, available),
    },
  }
}
