import "server-only"

import { db } from "@/server/db"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS, SYSTEM_ROLES } from "@/lib/constants"
import { getAwayDaysForMany } from "@/features/leave/server/day-status.queries"
import { leadConditions, ledBy } from "@/features/projects/lib/project-leads"
import type { Session } from "next-auth"

// A bounded snapshot of what THIS user may see, for the AI assistant (the model never queries the DB).
// Never included: payroll/bank, personal contact details, credentials/settings, document contents.

const MAX_ROWS = 60

const fmt = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "-")

export async function buildAiContext(session: Session): Promise<string> {
  const userId = session.user.id
  const roles = session.user.roles ?? []
  const canReadEmployees = hasPermission(session, PERMISSIONS.EMPLOYEE_READ)
  const canSeeAllProjects = hasPermission(session, PERMISSIONS.PROJECT_WRITE)
  const canReviewPerf = hasPermission(session, PERMISSIONS.PERFORMANCE_REVIEW)
  const isAdmin = roles.includes(SYSTEM_ROLES.ADMIN) || roles.includes(SYSTEM_ROLES.ADMIN_)

  const out: string[] = []
  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setUTCHours(0, 0, 0, 0)
  const weekEnd = new Date(todayStart)
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)

  const me = await db.employee.findUnique({
    where: { id: userId },
    select: {
      firstName: true,
      lastName: true,
      employeeNo: true,
      department: { select: { name: true } },
      jobRole: { select: { name: true } },
      designation: { select: { title: true } },
      manager: { select: { firstName: true, lastName: true } },
    },
  })
  out.push(`TODAY: ${fmt(now)}`)
  out.push(
    `ASKING USER: ${me?.firstName ?? ""} ${me?.lastName ?? ""} (${me?.employeeNo ?? "-"}) - ` +
      `${me?.jobRole?.name ?? me?.designation?.title ?? "-"}, ${me?.department?.name ?? "-"}` +
      `${me?.manager ? `, reports to ${me.manager.firstName} ${me.manager.lastName}` : ""}`,
  )
  out.push(`ACCESS: ${isAdmin ? "admin" : roles.join(", ") || "employee"}`)
  out.push("")

  if (canReadEmployees) {
    const people = await db.employee.findMany({
      where: { isActive: true, status: "ACTIVE" },
      select: {
        firstName: true,
        lastName: true,
        employeeNo: true,
        department: { select: { name: true } },
        jobRole: { select: { name: true } },
        designation: { select: { title: true } },
        manager: { select: { firstName: true, lastName: true } },
      },
      take: 200,
      orderBy: { firstName: "asc" },
    })
    out.push(`PEOPLE (${people.length}) - name [employeeNo] | role | department | manager:`)
    for (const p of people) {
      out.push(
        `- ${p.firstName} ${p.lastName} [${p.employeeNo}] | ${p.jobRole?.name ?? p.designation?.title ?? "-"} | ` +
          `${p.department?.name ?? "-"} | ${p.manager ? `${p.manager.firstName} ${p.manager.lastName}` : "-"}`,
      )
    }
    out.push("")
  }

  const projectWhere = canSeeAllProjects
    ? {}
    : {
        OR: [
          ...leadConditions(userId),
          { members: { some: { employeeId: userId } } },
          { teams: { some: { managerId: userId } } },
        ],
      }
  const projects = await db.project.findMany({
    where: projectWhere,
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
      priority: true,
      startDate: true,
      endDate: true,
      description: true,
      owner: { select: { firstName: true, lastName: true } },
    },
    take: MAX_ROWS,
    orderBy: { createdAt: "desc" },
  })
  out.push(`PROJECTS (${projects.length}):`)
  for (const p of projects) {
    out.push(
      `- ${p.name} (${p.code}) | status ${p.status} | priority ${p.priority} | ` +
        `${fmt(p.startDate)}→${fmt(p.endDate)} | account manager ${p.owner ? `${p.owner.firstName} ${p.owner.lastName}` : "-"}`,
    )
    if (p.description) out.push(`  goal: ${p.description.slice(0, 400)}`)
  }
  out.push("")

  const taskWhere = canSeeAllProjects
    ? {}
    : {
        OR: [{ team: { managerId: userId } }, { project: ledBy(userId) }, { assigneeId: userId }],
      }
  const tasks = await db.projectTask.findMany({
    where: taskWhere,
    select: {
      title: true,
      status: true,
      priority: true,
      dueDate: true,
      completedAt: true,
      holdReason: true,
      holdExpectedDate: true,
      assigneeId: true,
      assignee: { select: { id: true, firstName: true, lastName: true, employeeNo: true } },
      project: { select: { name: true } },
    },
    take: 400,
    orderBy: { createdAt: "desc" },
  })

  // Label people with their employee number - display names aren't unique.
  const who = (t: (typeof tasks)[number]) =>
    t.assignee
      ? `${t.assignee.firstName} ${t.assignee.lastName} [${t.assignee.employeeNo}]`
      : "Unassigned"
  const active = (t: (typeof tasks)[number]) => t.status !== "DONE" && t.status !== "DISCARDED"

  const per = new Map<string, { assigned: number; done: number; overdue: number; onHold: number }>()
  for (const t of tasks) {
    const k = who(t)
    const p = per.get(k) ?? { assigned: 0, done: 0, overdue: 0, onHold: 0 }
    p.assigned++
    if (t.status === "DONE") p.done++
    else if (t.status === "ON_HOLD") p.onHold++
    else if (t.dueDate && new Date(t.dueDate) < todayStart) p.overdue++
    per.set(k, p)
  }
  out.push(`TASK TOTALS: ${tasks.length} tasks in scope.`)
  out.push("PER PERSON (assigned / done / overdue / on-hold):")
  for (const [name, p] of [...per.entries()].sort((a, b) => b[1].assigned - a[1].assigned)) {
    out.push(`- ${name}: ${p.assigned} / ${p.done} / ${p.overdue} / ${p.onHold}`)
  }
  out.push("")

  const myTasks = tasks.filter((t) => t.assigneeId === userId)
  out.push(`TASKS ASSIGNED TO THE ASKING USER (${myTasks.length}):`)
  if (myTasks.length === 0) {
    out.push("- None. The asking user has no tasks assigned to them.")
  } else {
    for (const t of myTasks.slice(0, MAX_ROWS)) {
      out.push(
        `- "${t.title}" | ${t.project?.name ?? "-"} | ${t.status} | ${t.priority} | due ${fmt(t.dueDate)}`,
      )
    }
  }
  out.push("")

  const overdue = tasks.filter((t) => active(t) && t.dueDate && new Date(t.dueDate) < todayStart)
  const dueSoon = tasks.filter(
    (t) =>
      active(t) && t.dueDate && new Date(t.dueDate) >= todayStart && new Date(t.dueDate) < weekEnd,
  )
  const onHold = tasks.filter((t) => t.status === "ON_HOLD")
  const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS")

  const listTasks = (
    label: string,
    rows: typeof tasks,
    extra?: (t: (typeof tasks)[number]) => string,
  ) => {
    out.push(`${label} (${rows.length}):`)
    for (const t of rows.slice(0, MAX_ROWS)) {
      out.push(
        `- "${t.title}" | ${who(t)} | ${t.project?.name ?? "-"} | ${t.status} | ${t.priority} | due ${fmt(t.dueDate)}` +
          (extra ? ` | ${extra(t)}` : ""),
      )
    }
    out.push("")
  }
  listTasks("OVERDUE TASKS", overdue)
  listTasks("DUE IN THE NEXT 7 DAYS", dueSoon)
  listTasks(
    "ON HOLD",
    onHold,
    (t) => `reason: ${t.holdReason ?? "-"}; expected ${fmt(t.holdExpectedDate)}`,
  )
  listTasks("IN PROGRESS", inProgress)

  const evalWhere = canReviewPerf
    ? {}
    : { OR: [{ employeeId: userId }, { managerId: userId }, { controllerId: userId }] }
  const evals = await db.evaluation.findMany({
    where: evalWhere,
    select: {
      periodLabel: true,
      status: true,
      finalScore: true,
      selfSubmittedAt: true,
      managerSubmittedAt: true,
      employee: { select: { firstName: true, lastName: true, employeeNo: true } },
      manager: { select: { firstName: true, lastName: true } },
    },
    take: MAX_ROWS,
    orderBy: { createdAt: "desc" },
  })
  out.push(`PERFORMANCE EVALUATIONS (${evals.length}):`)
  for (const e of evals) {
    out.push(
      `- ${e.employee.firstName} ${e.employee.lastName} [${e.employee.employeeNo}] | ${e.periodLabel} | ${e.status} | ` +
        `score ${e.finalScore ?? "-"} | self ${e.selfSubmittedAt ? "done" : "pending"} | ` +
        `manager ${e.managerSubmittedAt ? "done" : "pending"}` +
        `${e.manager ? ` | reviewer ${e.manager.firstName} ${e.manager.lastName}` : ""}`,
    )
  }
  out.push("")

  // Leave, WFH, holidays and attendance: what people ask about most. Other people's absences use
  // the neutral away-day labels (never the leave type).
  const year = now.getUTCFullYear()
  const balances = await db.leaveBalance.findMany({
    where: { employeeId: userId, year },
    select: {
      allocated: true,
      carried: true,
      used: true,
      pending: true,
      leaveType: { select: { name: true } },
    },
  })
  out.push(`MY LEAVE BALANCES ${year} - type | total | used | pending | available:`)
  if (balances.length === 0) out.push("- No leave balances allocated yet.")
  for (const b of balances) {
    const total = b.allocated + b.carried
    out.push(
      `- ${b.leaveType.name} | ${total} | ${b.used} | ${b.pending} | ${total - b.used - b.pending}`,
    )
  }
  const myLeaves = await db.leaveRequest.findMany({
    where: { employeeId: userId, startDate: { gte: new Date(Date.UTC(year, 0, 1)) } },
    select: {
      startDate: true,
      endDate: true,
      totalDays: true,
      status: true,
      leaveType: { select: { name: true } },
    },
    orderBy: { startDate: "desc" },
    take: 10,
  })
  out.push(`MY LEAVE REQUESTS ${year} (latest ${myLeaves.length}) - dates | days | type | status:`)
  if (myLeaves.length === 0) out.push("- None.")
  for (const r of myLeaves) {
    out.push(
      `- ${fmt(r.startDate)} to ${fmt(r.endDate)} | ${r.totalDays} | ${r.leaveType.name} | ${r.status}`,
    )
  }
  const myWfh = await db.wfhRequest.findMany({
    where: { employeeId: userId },
    select: { date: true, endDate: true, totalDays: true, status: true, isEmergency: true },
    orderBy: { date: "desc" },
    take: 5,
  })
  out.push(`MY WFH REQUESTS (latest ${myWfh.length}) - dates | days | status:`)
  if (myWfh.length === 0) out.push("- None.")
  for (const r of myWfh) {
    out.push(
      `- ${fmt(r.date)} to ${fmt(r.endDate)} | ${r.totalDays} | ${r.status}${r.isEmergency ? " (emergency)" : ""}`,
    )
  }
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const attendance = await db.attendanceLog.groupBy({
    by: ["status"],
    where: { employeeId: userId, date: { gte: monthStart } },
    _count: { _all: true },
  })
  out.push(
    `MY ATTENDANCE THIS MONTH: ${
      attendance
        .map((a) => `${a.status.toLowerCase().replace(/_/g, " ")} ${a._count._all}`)
        .join(", ") || "no records yet"
    }`,
  )
  out.push("")

  // Approvals waiting on the asking user. HR (approve permission) sees the whole queue; a manager
  // only what is routed to them.
  const pendingLeave = await db.leaveRequest.findMany({
    where: {
      status: "PENDING",
      ...(hasPermission(session, PERMISSIONS.LEAVE_APPROVE) ? {} : { currentApproverId: userId }),
    },
    select: {
      startDate: true,
      endDate: true,
      totalDays: true,
      leaveType: { select: { name: true } },
      employee: { select: { firstName: true, lastName: true, employeeNo: true } },
    },
    orderBy: { startDate: "asc" },
    take: MAX_ROWS,
  })
  const pendingWfh = await db.wfhRequest.findMany({
    where: {
      status: "PENDING",
      ...(hasPermission(session, PERMISSIONS.WFH_APPROVE)
        ? {}
        : { employee: { managerId: userId } }),
    },
    select: {
      date: true,
      endDate: true,
      totalDays: true,
      isEmergency: true,
      employee: { select: { firstName: true, lastName: true, employeeNo: true } },
    },
    orderBy: { date: "asc" },
    take: MAX_ROWS,
  })
  out.push(
    `PENDING APPROVALS WAITING ON THE ASKING USER (${pendingLeave.length + pendingWfh.length}):`,
  )
  if (pendingLeave.length + pendingWfh.length === 0) out.push("- None.")
  for (const r of pendingLeave) {
    out.push(
      `- Leave: ${r.employee.firstName} ${r.employee.lastName} [${r.employee.employeeNo}] | ${fmt(r.startDate)} to ${fmt(r.endDate)} | ${r.totalDays} day(s) | ${r.leaveType.name}`,
    )
  }
  for (const r of pendingWfh) {
    out.push(
      `- WFH: ${r.employee.firstName} ${r.employee.lastName} [${r.employee.employeeNo}] | ${fmt(r.date)} to ${fmt(r.endDate)} | ${r.totalDays} day(s)${r.isEmergency ? " | emergency" : ""}`,
    )
  }
  out.push("")

  const holidayEnd = new Date(todayStart)
  holidayEnd.setUTCDate(holidayEnd.getUTCDate() + 90)
  const holidays = await db.holiday.findMany({
    where: { date: { gte: todayStart, lte: holidayEnd } },
    select: { name: true, date: true, isOptional: true },
    orderBy: { date: "asc" },
  })
  out.push(`UPCOMING HOLIDAYS (next 90 days, ${holidays.length}):`)
  if (holidays.length === 0) out.push("- None.")
  for (const h of holidays) {
    out.push(`- ${fmt(h.date)} | ${h.name}${h.isOptional ? " (optional / floating)" : ""}`)
  }
  out.push("")

  // Who is away this week: everyone the user may see, or just their own circle. Company-wide
  // holidays are listed above, so per person only leave, half days and approved optional days.
  const publicHolidays = new Set(holidays.filter((h) => !h.isOptional).map((h) => h.name))
  const circle = canReadEmployees
    ? await db.employee.findMany({
        where: { isActive: true, status: "ACTIVE" },
        select: { id: true, firstName: true, lastName: true },
        take: 150,
      })
    : await db.employee.findMany({
        where: {
          isActive: true,
          OR: [{ id: userId }, { managerId: userId }, { subordinates: { some: { id: userId } } }],
        },
        select: { id: true, firstName: true, lastName: true },
      })
  const away = await getAwayDaysForMany(
    circle.map((e) => e.id),
    todayStart.toISOString().slice(0, 10),
    weekEnd.toISOString().slice(0, 10),
  )
  const awayLines = circle
    .map((e) => {
      const days = (away[e.id] ?? []).filter(
        (d) => d.status !== "birthday" && !(d.status === "holiday" && publicHolidays.has(d.label)),
      )
      if (days.length === 0) return null
      const who = e.id === userId ? "You" : `${e.firstName} ${e.lastName}`
      return `- ${who}: ${days.map((d) => `${d.date} ${d.label}`).join(", ")}`
    })
    .filter((l): l is string => l !== null)
  out.push(`AWAY THIS WEEK (${fmt(todayStart)} to ${fmt(weekEnd)}):`)
  out.push(...(awayLines.length ? awayLines : ["- Nobody."]))
  out.push("")

  // Metadata only; the chat route pulls the text of the relevant ones.
  const docs = await listAccessibleDocuments(session)
  out.push(`DOCUMENTS / FILES (${docs.length}) - title | file | category | owner:`)
  if (docs.length === 0) {
    out.push("- None accessible.")
  } else {
    for (const d of docs.slice(0, 80)) {
      out.push(`- ${d.title} | ${d.fileName} | ${d.category} | ${d.ownerName ?? "Company"}`)
    }
  }
  out.push("")
  out.push(
    "NOTE: payroll/salary, bank details, personal contact info and credentials are NOT included and must not be guessed. You can read a document's TEXT only when it appears in a FILE CONTENTS block.",
  )

  return out.join("\n")
}

export interface AccessibleDoc {
  id: string
  title: string
  fileName: string
  category: string
  mimeType: string
  objectKey: string
  fileSize: number
  ownerName: string | null
}

/** Company docs are visible to all; employee docs only to their owner, or anyone with employee:read. */
export async function listAccessibleDocuments(session: Session): Promise<AccessibleDoc[]> {
  const userId = session.user.id
  const canReadAll = hasPermission(session, PERMISSIONS.EMPLOYEE_READ)

  const [companyDocs, employeeDocs] = await Promise.all([
    db.document.findMany({
      where: canReadAll ? {} : { OR: [{ isCompanyDoc: true }, { employeeId: userId }] },
      select: {
        id: true,
        title: true,
        fileName: true,
        category: true,
        mimeType: true,
        objectKey: true,
        fileSize: true,
        isCompanyDoc: true,
        employee: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.employeeDocument.findMany({
      where: canReadAll ? {} : { employeeId: userId },
      select: {
        id: true,
        title: true,
        fileName: true,
        category: true,
        mimeType: true,
        objectKey: true,
        fileSize: true,
        employee: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ])

  const fromCompany: AccessibleDoc[] = companyDocs.map((d) => ({
    id: d.id,
    title: d.title,
    fileName: d.fileName,
    category: String(d.category),
    mimeType: d.mimeType,
    objectKey: d.objectKey,
    fileSize: d.fileSize,
    ownerName: d.isCompanyDoc
      ? null
      : d.employee
        ? `${d.employee.firstName} ${d.employee.lastName}`
        : null,
  }))
  const fromEmployee: AccessibleDoc[] = employeeDocs.map((d) => ({
    id: d.id,
    title: d.title,
    fileName: d.fileName,
    category: String(d.category),
    mimeType: d.mimeType,
    objectKey: d.objectKey,
    fileSize: d.fileSize,
    ownerName: d.employee ? `${d.employee.firstName} ${d.employee.lastName}` : null,
  }))
  return [...fromCompany, ...fromEmployee]
}
