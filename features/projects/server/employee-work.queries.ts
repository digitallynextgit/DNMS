import "server-only"

import { db } from "@/server/db"
import {
  calendarProgress,
  type CalendarAssignment,
  type EmployeeWork,
  type OwnedCalendar,
  type OwnedService,
  type WorkCalendar,
  type WorkProject,
} from "../lib/employee-work"
import { isProjectService } from "../lib/project-services"
import type { WorkbookTeamStatus } from "../lib/workbook-team-progress"
import { parsePeriodMonth } from "./sheets.service"

const PROJECT_REF = { id: true, slug: true, name: true, shortName: true } as const

const PLAN_SELECT = {
  quantity: true,
  status: true,
  dueOn: true,
  links: true,
  team: { select: { name: true } },
  members: { select: { employeeId: true } },
  _count: { select: { attachments: true } },
} as const

const ymd = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)

/** Everything `employeeId` owns and owes on projects for `month` ("YYYY-MM"). */
export async function getEmployeeWork(employeeId: string, month: string): Promise<EmployeeWork> {
  const monthStart = parsePeriodMonth(month)!

  const [employee, ownerRows, projects] = await Promise.all([
    db.employee.findUniqueOrThrow({
      where: { id: employeeId },
      select: { id: true, firstName: true, lastName: true },
    }),
    db.projectServiceOwner.findMany({
      where: { employeeId },
      select: { service: true, project: { select: { ...PROJECT_REF, services: true } } },
    }),
    db.project.findMany({
      where: {
        OR: [{ ownerId: employeeId }, { teams: { some: { members: { some: { employeeId } } } } }],
      },
      orderBy: { name: "asc" },
      select: {
        ...PROJECT_REF,
        code: true,
        status: true,
        ownerId: true,
        owner: { select: { id: true, firstName: true, lastName: true } },
        teams: {
          where: { members: { some: { employeeId } } },
          select: { name: true, managerId: true },
        },
      },
    }),
  ])

  // An owner row for a service the project has since dropped means nothing.
  const owned = ownerRows.filter(
    (o) => isProjectService(o.service) && o.project.services.includes(o.service),
  )
  const ownsService = (projectId: string, service: string | null) =>
    !!service && owned.some((o) => o.project.id === projectId && o.service === service)

  // This month's calendars (and undated ones) that they own, work on, or own the service of.
  const books = await db.projectWorkbook.findMany({
    where: {
      OR: [{ periodMonth: monthStart }, { periodMonth: null }],
      AND: {
        OR: [
          { assignedToId: employeeId },
          { teams: { some: { members: { some: { employeeId } } } } },
          ...owned.map((o) => ({ projectId: o.project.id, service: o.service })),
        ],
      },
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      periodMonth: true,
      service: true,
      assignedToId: true,
      project: { select: PROJECT_REF },
      teams: { select: PLAN_SELECT },
    },
  })

  const toCalendar = (b: (typeof books)[number]): WorkCalendar => ({
    id: b.id,
    name: b.name,
    periodMonth: ymd(b.periodMonth),
    progress: calendarProgress(
      b.teams.map((t) => ({
        quantity: t.quantity,
        status: t.status,
        dueOn: ymd(t.dueOn),
        links: t.links,
        attachments: t._count.attachments,
      })),
    ),
  })

  // Somewhere to go for a service with no calendar this month: its newest month.
  const latest = owned.length
    ? await db.projectWorkbook.findMany({
        where: { OR: owned.map((o) => ({ projectId: o.project.id, service: o.service })) },
        orderBy: { periodMonth: "desc" },
        select: { id: true, projectId: true, service: true },
      })
    : []

  const ownedServices: OwnedService[] = owned.map((o) => {
    const book = books.find(
      (b) => b.project.id === o.project.id && b.service === o.service && b.periodMonth,
    )
    return {
      project: {
        id: o.project.id,
        slug: o.project.slug,
        name: o.project.name,
        shortName: o.project.shortName,
      },
      service: o.service,
      calendar: book ? toCalendar(book) : null,
      latestCalendarId:
        latest.find((w) => w.projectId === o.project.id && w.service === o.service)?.id ?? null,
    }
  })

  const ownedCalendars: OwnedCalendar[] = books
    .filter((b) => b.assignedToId === employeeId && !ownsService(b.project.id, b.service))
    .map((b) => ({ ...toCalendar(b), project: b.project }))

  const assignments: CalendarAssignment[] = books.flatMap((b) =>
    b.teams
      .filter((t) => t.members.some((m) => m.employeeId === employeeId))
      .map((t) => ({
        project: b.project,
        calendar: { id: b.id, name: b.name, periodMonth: ymd(b.periodMonth) },
        team: t.team.name,
        status: t.status as WorkbookTeamStatus,
        quantity: t.quantity,
        handedIn: t.links.length + t._count.attachments,
        dueOn: ymd(t.dueOn),
      })),
  )

  const workProjects: WorkProject[] = projects.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    shortName: p.shortName,
    code: p.code,
    status: p.status,
    accountManager: p.owner,
    isAccountManager: p.ownerId === employeeId,
    teams: p.teams.map((t) => ({ name: t.name, isManager: t.managerId === employeeId })),
  }))

  return {
    month,
    employee,
    ownedServices,
    ownedCalendars,
    assignments,
    projects: workProjects,
  }
}
