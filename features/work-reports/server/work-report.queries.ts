import "server-only"

import { db } from "@/server/db"
import { ADHOC_LABEL } from "@/features/projects/lib/task-permissions"
import {
  attendanceWindow,
  computeTaskHours,
  istDayKey,
  istInstant,
  round1,
  type ClockPeriod,
  type DayWindow,
} from "../lib/work-hours"
import {
  cleanTitle,
  daysOf,
  isWeekendKey,
  projectNamedIn,
  type ReportPeriod,
} from "../lib/report-format"
import type {
  CappedClock,
  DayLine,
  DayRow,
  ImpactCard,
  OpenItem,
  PersonReport,
  WorkReport,
} from "../types"

// =============================================================================
// Everything a work report shows, read once for every person in it. Renderers
// get plain data and never touch the database.
// =============================================================================

const OPEN_STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW", "ON_HOLD"] as const
type OpenStatus = (typeof OPEN_STATUSES)[number]
const MADE_STATUSES = ["DELIVERED", "ACCEPTED"] as const
const PRESENT = new Set(["PRESENT", "HALF_DAY", "LATE"])
const MAX_OPEN_ITEMS = 8
const MAX_IMPACT_CARDS = 6
const MS_PER_DAY = 86_400_000

/** DATE columns hold the calendar day as a UTC midnight. */
const dateKey = (d: Date) => d.toISOString().slice(0, 10)
const fullName = (e: { firstName: string; lastName: string }) =>
  `${e.firstName} ${e.lastName}`.trim()
const isOpen = (s: string): s is OpenStatus => (OPEN_STATUSES as readonly string[]).includes(s)

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`
}

/** "A", "A and B", "A, B and C". */
export function listing(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ""
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`
}

export interface LoadWorkReportInput {
  employeeIds: string[]
  period: ReportPeriod
  requesterId: string
  now?: Date
}

export async function loadWorkReport(input: LoadWorkReportInput): Promise<WorkReport> {
  const now = input.now ?? new Date()
  const { period, employeeIds: ids } = input
  // Instants bounding the IST month, for timestamp columns...
  const rangeStart = istInstant(period.from, 0)
  const rangeEnd = new Date(istInstant(period.to, 0).getTime() + MS_PER_DAY)
  // ...and the same days as DATE-column values.
  const fromDate = new Date(`${period.from}T00:00:00.000Z`)
  const toDate = new Date(`${period.to}T00:00:00.000Z`)

  const [
    employees,
    requester,
    fixedHolidays,
    floating,
    logs,
    leaves,
    wfhRequests,
    tasks,
    projects,
    deliverables,
  ] = await Promise.all([
    db.employee.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        designation: { select: { title: true } },
        department: { select: { name: true } },
      },
    }),
    db.employee.findUnique({
      where: { id: input.requesterId },
      select: { firstName: true, lastName: true, designation: { select: { title: true } } },
    }),
    db.holiday.findMany({
      where: { isOptional: false, date: { gte: fromDate, lte: toDate } },
      select: { date: true, name: true },
    }),
    db.floatingHolidaySelection.findMany({
      where: {
        employeeId: { in: ids },
        status: "APPROVED",
        holiday: { date: { gte: fromDate, lte: toDate } },
      },
      select: { employeeId: true, holiday: { select: { date: true, name: true } } },
    }),
    db.attendanceLog.findMany({
      where: { employeeId: { in: ids }, date: { gte: fromDate, lte: toDate } },
      select: {
        employeeId: true,
        date: true,
        checkIn: true,
        checkOut: true,
        workHours: true,
        status: true,
      },
    }),
    db.leaveRequest.findMany({
      where: {
        employeeId: { in: ids },
        status: "APPROVED",
        startDate: { lte: toDate },
        endDate: { gte: fromDate },
      },
      select: {
        employeeId: true,
        startDate: true,
        endDate: true,
        totalDays: true,
        leaveType: { select: { name: true } },
      },
    }),
    db.wfhRequest.findMany({
      where: {
        employeeId: { in: ids },
        status: "APPROVED",
        date: { lte: toDate },
        endDate: { gte: fromDate },
      },
      select: { employeeId: true, date: true, endDate: true },
    }),
    db.projectTask.findMany({
      where: {
        assigneeId: { in: ids },
        approvalStatus: { not: "REJECTED" },
        OR: [
          {
            statusPeriods: {
              some: { status: "IN_PROGRESS", startedAt: { gte: rangeStart, lt: rangeEnd } },
            },
          },
          { completedAt: { gte: rangeStart, lt: rangeEnd } },
          { status: { in: [...OPEN_STATUSES] }, dueDate: { gte: fromDate, lte: toDate } },
          { status: "IN_PROGRESS" },
        ],
      },
      select: {
        id: true,
        title: true,
        status: true,
        estimatedHours: true,
        completedAt: true,
        dueDate: true,
        assigneeId: true,
        project: { select: { name: true } },
        _count: { select: { resumeTasks: true } },
        statusPeriods: {
          where: { status: "IN_PROGRESS", startedAt: { gte: rangeStart, lt: rangeEnd } },
          select: { startedAt: true, endedAt: true },
        },
      },
    }),
    db.project.findMany({ select: { name: true, code: true } }),
    db.projectDeliverable.findMany({
      where: {
        employeeId: { in: ids },
        status: { in: [...MADE_STATUSES] },
        completedOn: { gte: fromDate, lte: toDate },
      },
      select: { type: true, quantity: true, project: { select: { name: true } } },
    }),
  ])

  // One label per task: its project, else the project its title names, else ADHOC.
  const projectOf = new Map<string, string>()
  const titleOf = new Map<string, string>()
  for (const t of tasks) {
    projectOf.set(t.id, t.project?.name ?? projectNamedIn(t.title, projects) ?? ADHOC_LABEL)
    titleOf.set(t.id, cleanTitle(t.title))
  }

  const fixedByDay = new Map(fixedHolidays.map((h) => [dateKey(h.date), h.name]))
  const allDays = daysOf(period)

  const people: PersonReport[] = []
  for (const emp of employees.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))) {
    const myTasks = tasks.filter((t) => t.assigneeId === emp.id)

    const holidays = new Map(fixedByDay)
    for (const f of floating) {
      if (f.employeeId === emp.id) holidays.set(dateKey(f.holiday.date), f.holiday.name)
    }
    const calendar = allDays.filter((d) => !isWeekendKey(d) && !holidays.has(d))
    const onCalendar = new Set(calendar)

    const leaveByDay = new Map<string, { type: string; half: boolean }>()
    for (const lv of leaves) {
      if (lv.employeeId !== emp.id) continue
      const single = dateKey(lv.startDate) === dateKey(lv.endDate)
      for (let t = lv.startDate.getTime(); t <= lv.endDate.getTime(); t += MS_PER_DAY) {
        const d = dateKey(new Date(t))
        if (onCalendar.has(d)) {
          leaveByDay.set(d, { type: lv.leaveType.name, half: single && lv.totalDays < 1 })
        }
      }
    }

    const wfhDays = new Set<string>()
    for (const w of wfhRequests) {
      if (w.employeeId !== emp.id) continue
      for (let t = w.date.getTime(); t <= w.endDate.getTime(); t += MS_PER_DAY) {
        const d = dateKey(new Date(t))
        if (onCalendar.has(d)) wfhDays.add(d)
      }
    }

    const myLogs = new Map(
      logs.filter((l) => l.employeeId === emp.id).map((l) => [dateKey(l.date), l]),
    )
    const windows = new Map<string, DayWindow>()
    for (const [d, l] of myLogs) windows.set(d, attendanceWindow(d, l))

    const clockDays = new Set(
      calendar.filter((d) => !(leaveByDay.get(d) && !leaveByDay.get(d)!.half)),
    )
    const periods: ClockPeriod[] = myTasks.flatMap((t) =>
      t.statusPeriods.map((p) => ({ taskId: t.id, startedAt: p.startedAt, endedAt: p.endedAt })),
    )
    const { byDay, capped } = computeTaskHours({
      periods,
      estimates: new Map(myTasks.map((t) => [t.id, t.estimatedHours])),
      workingDays: clockDays,
      windows,
      now,
    })

    const doneInRange = myTasks.filter(
      (t) => t.completedAt && t.completedAt >= rangeStart && t.completedAt < rangeEnd,
    )
    const taskHours = new Map<string, number>()
    const projectHours = new Map<string, number>()
    const days: DayRow[] = []

    for (const day of calendar) {
      const leave = leaveByDay.get(day)
      if (leave && !leave.half) {
        days.push({
          date: day,
          kind: "leave",
          label: leave.type,
          wfh: false,
          halfDayLeave: false,
          hours: 0,
          lines: [],
        })
        continue
      }
      const worked = new Map(byDay.get(day) ?? [])
      // A task closed today without its clock ever running still happened today.
      for (const t of doneInRange) {
        if (istDayKey(t.completedAt!) === day && !worked.has(t.id)) worked.set(t.id, 0)
      }
      if (worked.size === 0) {
        if (myLogs.has(day) || wfhDays.has(day)) {
          days.push({
            date: day,
            kind: "idle",
            wfh: wfhDays.has(day),
            halfDayLeave: !!leave,
            label: leave ? `Half-day ${leave.type}` : undefined,
            hours: 0,
            lines: [],
          })
        }
        continue
      }

      const byProject = new Map<string, { hours: number; titles: string[] }>()
      for (const [taskId, h] of worked) {
        taskHours.set(taskId, (taskHours.get(taskId) ?? 0) + h)
        const project = projectOf.get(taskId)!
        projectHours.set(project, (projectHours.get(project) ?? 0) + h)
        const entry = byProject.get(project) ?? { hours: 0, titles: [] }
        entry.hours += h
        const title = titleOf.get(taskId)!
        if (!entry.titles.includes(title)) entry.titles.push(title)
        byProject.set(project, entry)
      }
      const lines: DayLine[] = Array.from(byProject, ([project, e]) => ({
        project,
        hours: round1(e.hours),
        text: e.titles.join("; "),
      })).sort((a, b) => b.hours - a.hours)
      days.push({
        date: day,
        kind: "work",
        wfh: wfhDays.has(day),
        halfDayLeave: !!leave,
        label: leave ? `Half-day ${leave.type}` : undefined,
        hours: round1(Array.from(worked.values()).reduce((s, h) => s + h, 0)),
        lines,
      })
    }

    const ranked = Array.from(projectHours, ([project, hours]) => ({
      project,
      hours: round1(hours),
    }))
      .filter((p) => p.hours > 0)
      .sort((a, b) => b.hours - a.hours)
    const totalHours = round1(Array.from(projectHours.values()).reduce((s, h) => s + h, 0))

    const highlights = ranked.slice(0, 4).map(({ project }) => {
      const mine = myTasks.filter((t) => projectOf.get(t.id) === project)
      const done = mine
        .filter((t) => doneInRange.includes(t))
        .sort((a, b) => (taskHours.get(b.id) ?? 0) - (taskHours.get(a.id) ?? 0))
      const pick = (done.length ? done : mine.filter((t) => (taskHours.get(t.id) ?? 0) > 0))
        .map((t) => titleOf.get(t.id)!)
        .filter((v, i, a) => a.indexOf(v) === i)
      const more = pick.length > 3 ? ` and ${pick.length - 3} more` : ""
      return truncate(
        `${project}: ${done.length ? "" : "worked on "}${pick.slice(0, 3).join("; ")}${more}`,
        170,
      )
    })

    const openItems: OpenItem[] = myTasks
      .filter(
        (t) =>
          isOpen(t.status) &&
          // A hold that spawned a follow-up is represented by the follow-up.
          !(t.status === "ON_HOLD" && t._count.resumeTasks > 0) &&
          (t.status === "IN_PROGRESS" ||
            (t.dueDate && t.dueDate >= fromDate && t.dueDate <= toDate)),
      )
      .sort(
        (a, b) =>
          Number(b.status === "IN_PROGRESS") - Number(a.status === "IN_PROGRESS") ||
          (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0),
      )
      .slice(0, MAX_OPEN_ITEMS)
      .map((t) => ({
        project: projectOf.get(t.id)!,
        text: titleOf.get(t.id)!,
        status: t.status as OpenStatus,
        due: t.dueDate ? dateKey(t.dueDate) : null,
      }))

    const cappedClocks: CappedClock[] = capped.map((c) => ({
      date: c.day,
      project: projectOf.get(c.taskId)!,
      task: titleOf.get(c.taskId)!,
      leftRunningHours: c.leftRunningHours,
      countedHours: c.countedHours,
    }))

    const officeLogs = calendar
      .map((d) => myLogs.get(d))
      .filter((l) => l && l.checkIn && PRESENT.has(l.status))

    people.push({
      id: emp.id,
      name: fullName(emp),
      designation: emp.designation?.title ?? null,
      department: emp.department?.name ?? null,
      totalHours,
      projectHours: ranked,
      workingDays: days.filter((d) => d.kind !== "leave").length,
      wfhDays: wfhDays.size,
      leaveDays: Array.from(leaveByDay, ([date, l]) => ({
        date,
        type: l.type,
        days: l.half ? 0.5 : 1,
      })),
      officeDays: officeLogs.length,
      officeHours: round1(officeLogs.reduce((s, l) => s + (l!.workHours ?? 0), 0)),
      tasksWorked: Array.from(taskHours.values()).filter((h) => h > 0).length,
      tasksDone: doneInRange.length,
      highlights,
      focus: listing(ranked.slice(0, 3).map((p) => p.project)),
      days,
      openItems,
      capped: cappedClocks,
    })
  }

  // ── Team roll-up ──────────────────────────────────────────────────────────
  const teamProjects = new Map<string, { total: number; byPerson: Record<string, number> }>()
  for (const p of people) {
    for (const { project, hours } of p.projectHours) {
      const e = teamProjects.get(project) ?? { total: 0, byPerson: {} }
      e.total = round1(e.total + hours)
      e.byPerson[p.id] = hours
      teamProjects.set(project, e)
    }
  }
  const projectsRanked = Array.from(teamProjects, ([project, e]) => ({ project, ...e })).sort(
    (a, b) => b.total - a.total,
  )

  const deliveredBy = new Map<string, Map<string, number>>()
  for (const d of deliverables) {
    const perType = deliveredBy.get(d.project.name) ?? new Map<string, number>()
    perType.set(d.type, (perType.get(d.type) ?? 0) + d.quantity)
    deliveredBy.set(d.project.name, perType)
  }

  // Ad-hoc work stays in the hours, but "what was delivered" is about clients.
  const deliveredProjects = projectsRanked.filter((p) => p.project !== ADHOC_LABEL)
  const impact: ImpactCard[] = deliveredProjects.slice(0, MAX_IMPACT_CARDS).map((p) => {
    const projectTasks = tasks.filter((t) => projectOf.get(t.id) === p.project)
    const done = projectTasks.filter(
      (t) => t.completedAt && t.completedAt >= rangeStart && t.completedAt < rangeEnd,
    )
    const titles = done.map((t) => titleOf.get(t.id)!).filter((v, i, a) => a.indexOf(v) === i)
    const bullets = [
      `${done.length} task${done.length === 1 ? "" : "s"} completed, ${round1(p.total)} h logged`,
    ]
    if (titles.length) bullets.push(truncate(`Completed: ${titles.slice(0, 3).join("; ")}`, 170))
    const made = deliveredBy.get(p.project)
    if (made?.size) {
      bullets.push(`Delivered: ${listing(Array.from(made, ([type, n]) => `${n} ${type}`))}`)
    }
    return {
      project: p.project,
      owners: Object.entries(p.byPerson)
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => id),
      hours: p.total,
      bullets,
    }
  })

  const departments = Array.from(new Set(people.map((p) => p.department).filter(Boolean)))
  const title =
    people.length === 1
      ? people[0]!.name
      : departments.length === 1
        ? `${departments[0]} Team`
        : "Team report"

  const holidayNames = new Map(fixedByDay)
  for (const f of floating) holidayNames.set(dateKey(f.holiday.date), f.holiday.name)

  return {
    period,
    title,
    preparedBy: {
      name: requester ? fullName(requester) : "",
      designation: requester?.designation?.title ?? null,
    },
    generatedAt: now.toISOString(),
    holidays: Array.from(holidayNames, ([date, name]) => ({ date, name })).sort((a, b) =>
      a.date.localeCompare(b.date),
    ),
    people,
    team: {
      totalHours: round1(people.reduce((s, p) => s + p.totalHours, 0)),
      tasksDone: people.reduce((s, p) => s + p.tasksDone, 0),
      projects: projectsRanked,
      adhocHours: teamProjects.get(ADHOC_LABEL)?.total ?? 0,
    },
    impact,
    aiPolished: false,
  }
}
