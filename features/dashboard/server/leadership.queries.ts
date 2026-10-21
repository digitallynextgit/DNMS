import "server-only"

import type { Session } from "next-auth"
import { db } from "@/server/db"
import { VISIBLE_EMPLOYEE_FILTER } from "@/server/selects"
import { getAttendanceDirectory } from "@/features/attendance/server/attendance-directory.queries"
import { getAwayDaysForMany } from "@/features/leave/server/day-status.queries"
import { getGoalsPortfolio } from "@/features/projects/server/goals-portfolio.queries"
import { getDeliveryScores } from "@/features/projects/server/delivery-score.queries"
import { TASK_NOT_OVERDUE_STATUSES } from "@/features/projects/lib/task-overdue"
import { OPEN_STATUSES } from "@/features/projects/lib/deliverable-lifecycle"
import type { DeliveryScore } from "@/features/projects/lib/delivery-score"

// The admin's home page: the company today (who is in, away, working from home), what is waiting
// on a decision, which projects need a look, how delivery is going, and the people and money
// numbers worth a glance. Admins aren't regular employees, so none of it is their own work.

export interface LeadPerson {
  id: string
  name: string
  profilePhoto: string | null
  department: string | null
  /** Why they are listed: "On leave", "Half day", "Birthday"... */
  note?: string
}

export interface ProjectAttention {
  id: string
  name: string
  slug: string | null
  accountManager: string | null
  goalsProgress: number | null
  /** At risk, slipping or past target. */
  goalsNeedingAttention: number
  overdueTasks: number
  lateDeliverables: number
}

export interface ScoredLead {
  id: string
  name: string
  designation: string | null
  score: DeliveryScore
}

export interface LeadershipDashboard {
  /** yyyy-MM-dd, India time. */
  today: string
  people: {
    working: number
    holiday: string | null
    away: LeadPerson[]
    wfh: LeadPerson[]
    birthdays: LeadPerson[]
  }
  attendance: {
    /** Working people not away today - who should be in. */
    expected: number
    in: number
    halfDay: number
    notIn: LeadPerson[]
  }
  approvals: { leave: number; wfh: number; resignations: number }
  projects: {
    active: number
    overdueTasks: number
    lateDeliverables: number
    goals: { total: number; done: number; needAttention: number }
    attention: ProjectAttention[]
  }
  performance: {
    month: string
    average: number | null
    scored: number
    top: ScoredLead[]
    needsSupport: ScoredLead[]
  }
  hr: {
    newJoinersThisMonth: number
    servingNotice: number
    onboarding: number
    openJobs: number
    applicantsThisMonth: number
    payroll: { net: number; count: number; period: string } | null
  }
}

/** Today's date where the company works. */
function indiaToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)
}

const name = (e: { firstName: string; lastName: string | null }) =>
  `${e.firstName} ${e.lastName ?? ""}`.trim()

/** Fewer scored items than this and a score says more about luck than delivery. */
const MIN_ITEMS_TO_RANK = 3

export async function getLeadershipDashboard(session: Session): Promise<LeadershipDashboard> {
  const today = indiaToday()
  const todayDate = new Date(`${today}T00:00:00.000Z`)
  const monthStart = new Date(`${today.slice(0, 7)}-01T00:00:00.000Z`)
  const prevMonth = new Date(Date.UTC(todayDate.getUTCFullYear(), todayDate.getUTCMonth() - 1, 1))

  const people = await db.employee.findMany({
    where: { isActive: true, status: "ACTIVE", ...VISIBLE_EMPLOYEE_FILTER },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      profilePhoto: true,
      dateOfBirth: true,
      department: { select: { name: true } },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  })
  const ids = people.map((p) => p.id)
  const lead = (p: (typeof people)[number], note?: string): LeadPerson => ({
    id: p.id,
    name: name(p),
    profilePhoto: p.profilePhoto,
    department: p.department?.name ?? null,
    note,
  })

  const [
    awayDays,
    wfhToday,
    attendance,
    pendingLeave,
    pendingWfh,
    pendingResignations,
    servingNotice,
    onboarding,
    newJoiners,
    openJobs,
    applicants,
    payroll,
    activeProjects,
    overdueByProject,
    lateByProject,
    portfolio,
    scores,
  ] = await Promise.all([
    getAwayDaysForMany(ids, today, today),
    db.wfhRequest.findMany({
      where: { status: "APPROVED", date: { lte: todayDate }, endDate: { gte: todayDate } },
      select: { employeeId: true },
    }),
    getAttendanceDirectory(today, today),
    db.leaveRequest.count({ where: { status: "PENDING" } }),
    db.wfhRequest.count({ where: { status: "PENDING" } }),
    db.resignation.count({ where: { status: "PENDING" } }),
    db.resignation.count({ where: { status: "APPROVED", employee: { isActive: true } } }),
    db.checklistInstance.count({ where: { kind: "ONBOARDING", status: "IN_PROGRESS" } }),
    db.employee.count({
      where: { isActive: true, dateOfJoining: { gte: monthStart }, ...VISIBLE_EMPLOYEE_FILTER },
    }),
    db.jobPosting.count({ where: { status: "OPEN" } }),
    db.applicant.count({ where: { createdAt: { gte: monthStart } } }),
    db.payrollRecord.aggregate({
      where: { month: prevMonth.getUTCMonth() + 1, year: prevMonth.getUTCFullYear() },
      _sum: { netSalary: true },
      _count: { id: true },
    }),
    db.project.count({ where: { status: "ACTIVE" } }),
    db.projectTask.groupBy({
      by: ["projectId"],
      where: {
        projectId: { not: null },
        project: { status: "ACTIVE" },
        status: { notIn: [...TASK_NOT_OVERDUE_STATUSES] },
        dueDate: { lt: todayDate },
      },
      _count: { _all: true },
    }),
    db.projectDeliverable.groupBy({
      by: ["projectId"],
      where: {
        project: { status: "ACTIVE" },
        status: { in: [...OPEN_STATUSES] },
        dueOn: { lt: todayDate },
      },
      _count: { _all: true },
    }),
    getGoalsPortfolio(session),
    getDeliveryScores(session, { month: today.slice(0, 7) }),
  ])

  // --- People today ---
  const byId = new Map(people.map((p) => [p.id, p]))
  let holiday: string | null = null
  const away: LeadPerson[] = []
  const awayIds = new Set<string>()
  for (const [id, days] of Object.entries(awayDays)) {
    const day = days[0]
    const p = byId.get(id)
    if (!day || !p) continue
    if (day.status === "holiday") {
      holiday = day.label
      awayIds.add(id)
      continue
    }
    if (day.status === "leave" || day.status === "half-day" || day.status === "birthday") {
      away.push(lead(p, day.label))
      if (day.status !== "half-day") awayIds.add(id)
    }
  }
  const wfhIds = new Set(wfhToday.map((w) => w.employeeId))
  const wfh = people.filter((p) => wfhIds.has(p.id)).map((p) => lead(p, "Working from home"))
  const md = today.slice(5)
  const birthdays = people
    .filter((p) => p.dateOfBirth && p.dateOfBirth.toISOString().slice(5, 10) === md)
    .map((p) => lead(p, "Birthday"))

  // --- Attendance: who is in, among those expected ---
  const rows = attendance.ok ? attendance.data.rows : []
  const expectedRows = rows.filter((r) => !awayIds.has(r.employeeId))
  const came = (s: string) => s === "PRESENT" || s === "ON_DUTY" || s === "MISSING_PUNCH"
  const notIn = expectedRows
    .filter((r) => !came(r.status) && r.status !== "HALF_DAY" && !wfhIds.has(r.employeeId))
    .map((r) => {
      const p = byId.get(r.employeeId)
      return p ? lead(p) : null
    })
    .filter((p): p is LeadPerson => p !== null)

  // --- Projects needing a look ---
  const attention = new Map<string, Omit<ProjectAttention, "name" | "slug" | "accountManager">>()
  const at = (id: string) => {
    const a = attention.get(id) ?? {
      id,
      goalsProgress: null,
      goalsNeedingAttention: 0,
      overdueTasks: 0,
      lateDeliverables: 0,
    }
    attention.set(id, a)
    return a
  }
  for (const r of overdueByProject) if (r.projectId) at(r.projectId).overdueTasks = r._count._all
  for (const r of lateByProject) at(r.projectId).lateDeliverables = r._count._all
  let goalsNeedingAttention = 0
  for (const g of portfolio.projects) {
    const n = g.atRiskGoals + g.slippingGoals + g.overdueGoals
    goalsNeedingAttention += n
    if (n > 0 || attention.has(g.projectId)) {
      const a = at(g.projectId)
      a.goalsNeedingAttention = n
      a.goalsProgress = g.totalGoals > 0 ? g.overallProgress : null
    }
  }
  const projectRows = attention.size
    ? await db.project.findMany({
        where: { id: { in: [...attention.keys()] }, status: "ACTIVE" },
        select: {
          id: true,
          name: true,
          slug: true,
          owner: { select: { firstName: true, lastName: true } },
        },
      })
    : []
  const weight = (a: {
    goalsNeedingAttention: number
    lateDeliverables: number
    overdueTasks: number
  }) => a.goalsNeedingAttention * 3 + a.lateDeliverables * 2 + a.overdueTasks
  const projectsNeedingAttention = projectRows
    .map((p) => ({
      ...attention.get(p.id)!,
      name: p.name,
      slug: p.slug,
      accountManager: p.owner ? name(p.owner) : null,
    }))
    .filter((a) => weight(a) > 0)
    .sort((a, b) => weight(b) - weight(a))
    .slice(0, 8)

  // --- Delivery ---
  const ranked = scores.people.filter(
    (p) => p.score.score !== null && p.score.basedOn >= MIN_ITEMS_TO_RANK,
  )
  const average = ranked.length
    ? Math.round(ranked.reduce((s, p) => s + (p.score.score ?? 0), 0) / ranked.length)
    : null
  const toLead = (p: (typeof ranked)[number]): ScoredLead => ({
    id: p.id,
    name: p.name,
    designation: p.designation,
    score: p.score,
  })

  return {
    today,
    people: { working: people.length, holiday, away, wfh, birthdays },
    attendance: {
      expected: expectedRows.length,
      in: expectedRows.filter((r) => came(r.status)).length,
      halfDay: expectedRows.filter((r) => r.status === "HALF_DAY").length,
      notIn,
    },
    approvals: { leave: pendingLeave, wfh: pendingWfh, resignations: pendingResignations },
    projects: {
      active: activeProjects,
      overdueTasks: overdueByProject.reduce((s, r) => s + r._count._all, 0),
      lateDeliverables: lateByProject.reduce((s, r) => s + r._count._all, 0),
      goals: {
        total: portfolio.totals.totalGoals,
        done: portfolio.totals.doneGoals,
        needAttention: goalsNeedingAttention,
      },
      attention: projectsNeedingAttention,
    },
    performance: {
      month: scores.month,
      average,
      scored: ranked.length,
      top: ranked.slice(0, 5).map(toLead),
      // Lowest first, and never someone already in the top list.
      needsSupport: ranked.slice(5).slice(-5).reverse().map(toLead),
    },
    hr: {
      newJoinersThisMonth: newJoiners,
      servingNotice,
      onboarding,
      openJobs,
      applicantsThisMonth: applicants,
      payroll:
        payroll._count.id > 0
          ? {
              net: payroll._sum.netSalary ?? 0,
              count: payroll._count.id,
              period: prevMonth.toLocaleString("en-IN", {
                month: "short",
                year: "numeric",
                timeZone: "UTC",
              }),
            }
          : null,
    },
  }
}
