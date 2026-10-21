import "server-only"

import { db } from "@/server/db"
import { calendarProgress, type CalendarProgress } from "../lib/employee-work"
import { teamProgress } from "../lib/workbook-team-progress"
import { monthPeriod, periodKey, planMonthPeriod } from "../lib/goal-periods"
import { sortProjectTeams } from "../lib/project-teams"

// A project's calendars for a month, for the Analytics tab: who owns each, which teams and people
// work on it and how far along they are, and how many rows each tab holds.

export interface CalendarTeamLine {
  teamName: string
  members: string[]
  status: string
  quantity: number
  handedIn: number
  dueOn: string | null
}

export interface CalendarOverview {
  id: string
  name: string
  service: string | null
  periodMonth: string | null
  owner: string | null
  secondary: string | null
  progress: CalendarProgress
  teams: CalendarTeamLine[]
  tabs: { name: string; rows: number }[]
  updatedAt: string
}

const ymd = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)
const nameOf = (p: { firstName: string; lastName: string | null } | null) =>
  p ? `${p.firstName} ${p.lastName ?? ""}`.trim() : null

const PERSON = { select: { firstName: true, lastName: true } } as const

export async function getCalendarOverview(
  projectId: string,
  month?: string | null,
): Promise<{ month: string; calendars: CalendarOverview[] }> {
  const period = monthPeriod(month) ?? planMonthPeriod()
  const books = await db.projectWorkbook.findMany({
    where: { projectId, OR: [{ periodMonth: period.start }, { periodMonth: null }] },
    orderBy: [{ name: "asc" }, { position: "asc" }],
    select: {
      id: true,
      name: true,
      service: true,
      periodMonth: true,
      updatedAt: true,
      assignedTo: PERSON,
      secondaryAssignedTo: PERSON,
      sheets: {
        orderBy: { position: "asc" },
        select: { name: true, _count: { select: { rows: true } } },
      },
      teams: {
        select: {
          quantity: true,
          status: true,
          dueOn: true,
          links: true,
          team: { select: { name: true } },
          members: { select: { employee: PERSON } },
          _count: { select: { attachments: true } },
        },
      },
    },
  })

  return {
    month: periodKey(period.start),
    calendars: books.map((b) => {
      const plan = b.teams.map((t) => ({
        quantity: t.quantity,
        status: t.status,
        dueOn: ymd(t.dueOn),
        links: t.links,
        attachments: t._count.attachments,
      }))
      const teams = sortProjectTeams(
        b.teams.map((t) => {
          const p = teamProgress({
            quantity: t.quantity,
            links: t.links,
            attachments: Array.from({ length: t._count.attachments }),
          })
          return {
            name: t.team.name,
            line: {
              teamName: t.team.name,
              members: t.members.map((m) => nameOf(m.employee)!),
              status: t.status,
              quantity: p.quantity,
              handedIn: Math.min(p.handedIn, p.quantity || p.handedIn),
              dueOn: ymd(t.dueOn),
            },
          }
        }),
      ).map((t) => t.line)
      return {
        id: b.id,
        name: b.name,
        service: b.service,
        periodMonth: ymd(b.periodMonth),
        owner: nameOf(b.assignedTo),
        secondary: nameOf(b.secondaryAssignedTo),
        progress: calendarProgress(plan),
        teams,
        tabs: b.sheets.map((s) => ({ name: s.name, rows: s._count.rows })),
        updatedAt: b.updatedAt.toISOString(),
      }
    }),
  }
}
