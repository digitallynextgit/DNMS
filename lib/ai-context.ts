import "server-only"

import { db } from "@/server/db"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS, SYSTEM_ROLES } from "@/lib/constants"
import type { Session } from "next-auth"

// =============================================================================
// Context snapshot for the AI assistant.
//
// SECURITY: the assistant can only ever see what THIS user is allowed to see.
// We assemble a bounded snapshot here rather than letting the model query the
// database, so there is no path to arbitrary reads.
//
// Deliberately EXCLUDED for everyone (never sent to the model):
//   • payroll / salary / bank details        • personal contact (phone, address, DOB)
//   • credentials, API keys, app settings    • documents & their contents
// Those stay in the app behind their own permission gates.
// =============================================================================

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

  // ── Who is asking ──────────────────────────────────────────────────────────
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
    `ASKING USER: ${me?.firstName ?? ""} ${me?.lastName ?? ""} (${me?.employeeNo ?? "-"}) — ` +
      `${me?.jobRole?.name ?? me?.designation?.title ?? "-"}, ${me?.department?.name ?? "-"}` +
      `${me?.manager ? `, reports to ${me.manager.firstName} ${me.manager.lastName}` : ""}`,
  )
  out.push(`ACCESS: ${isAdmin ? "admin" : roles.join(", ") || "employee"}`)
  out.push("")

  // ── People (directory-level only; no contact/payroll details) ─────────────
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
    out.push(`PEOPLE (${people.length}) — name [employeeNo] | role | department | manager:`)
    for (const p of people) {
      out.push(
        `- ${p.firstName} ${p.lastName} [${p.employeeNo}] | ${p.jobRole?.name ?? p.designation?.title ?? "-"} | ` +
          `${p.department?.name ?? "-"} | ${p.manager ? `${p.manager.firstName} ${p.manager.lastName}` : "-"}`,
      )
    }
    out.push("")
  }

  // ── Projects (name/code/status/goal) ──────────────────────────────────────
  const projectWhere = canSeeAllProjects
    ? {}
    : {
        OR: [
          { ownerId: userId },
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
        `${fmt(p.startDate)}→${fmt(p.endDate)} | owner ${p.owner ? `${p.owner.firstName} ${p.owner.lastName}` : "-"}`,
    )
    if (p.description) out.push(`  goal: ${p.description.slice(0, 400)}`)
  }
  out.push("")

  // ── Tasks (scoped the same way the performance page is) ───────────────────
  const taskWhere = canSeeAllProjects
    ? {}
    : {
        OR: [
          { team: { managerId: userId } },
          { project: { ownerId: userId } },
          { assigneeId: userId },
        ],
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

  // Always label people with their employee number - two employees can share a
  // display name, so names alone are NOT a safe identifier.
  const who = (t: (typeof tasks)[number]) =>
    t.assignee
      ? `${t.assignee.firstName} ${t.assignee.lastName} [${t.assignee.employeeNo}]`
      : "Unassigned"
  const active = (t: (typeof tasks)[number]) => t.status !== "DONE" && t.status !== "DISCARDED"

  // Per-person tallies
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

  // The asking user's OWN tasks, matched on employee id (never on name - other
  // employees can share the same display name).
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

  // ── Performance evaluations (own + managed; all if HR/admin) ──────────────
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
  out.push(
    "NOTE: payroll/salary, bank details, personal contact info, documents and credentials are NOT included in this context and must not be guessed.",
  )

  return out.join("\n")
}
