// One person's project work for a month: what they own and what they owe. Shared by server and client.

import { teamProgress, type WorkbookTeamStatus } from "./workbook-team-progress"
import type { ProjectLeadRole } from "./project-leads"

export interface WorkProjectRef {
  id: string
  slug: string | null
  name: string
  shortName: string | null
}

/** A calendar month's team plan, rolled up. */
export interface CalendarProgress {
  /** Teams still owing something (Discarded ones left out). */
  teams: number
  teamsDone: number
  /** Items promised across those teams (0 = not quantified yet). */
  quantity: number
  /** Links + files handed in, capped per team at what that team promised. */
  handedIn: number
  /** The earliest due date of a team not yet Done ("YYYY-MM-DD"). */
  nextDue: string | null
}

export interface WorkCalendar {
  id: string
  name: string
  /** "YYYY-MM-01", or null for an undated calendar. */
  periodMonth: string | null
  progress: CalendarProgress
}

export interface OwnedService {
  project: WorkProjectRef
  service: string
  /** They cover it as the secondary owner rather than own it. */
  secondary: boolean
  /** The service's calendar for the month asked for, if it has one. */
  calendar: WorkCalendar | null
  /** Its newest month otherwise, so there is still somewhere to go. */
  latestCalendarId: string | null
}

export interface OwnedCalendar extends WorkCalendar {
  project: WorkProjectRef
}

/** A team plan row this person is named in. */
export interface CalendarAssignment {
  project: WorkProjectRef
  calendar: { id: string; name: string; periodMonth: string | null }
  team: string
  status: WorkbookTeamStatus
  quantity: number
  handedIn: number
  dueOn: string | null
}

export interface WorkProject extends WorkProjectRef {
  code: string
  status: string
  accountManager: { id: string; firstName: string; lastName: string }
  /** The PRIMARY Account Manager. */
  isAccountManager: boolean
  /** The Account Manager roles this person holds here (lib/project-leads.ts). */
  leadRoles: ProjectLeadRole[]
  /** The project's teams this person is on, and whether they manage it. */
  teams: { name: string; isManager: boolean }[]
}

export interface EmployeeWork {
  /** "YYYY-MM". */
  month: string
  employee: { id: string; firstName: string; lastName: string }
  ownedServices: OwnedService[]
  /** Calendars they own that are not a service of theirs (e.g. hand-made ones). */
  ownedCalendars: OwnedCalendar[]
  assignments: CalendarAssignment[]
  projects: WorkProject[]
}

interface PlanRow {
  quantity: number
  status: string
  dueOn: string | null
  links: readonly unknown[]
  attachments: number
}

/** Roll a calendar's team plan up into one line: teams done, items in, next due. */
export function calendarProgress(rows: readonly PlanRow[]): CalendarProgress {
  const live = rows.filter((r) => r.status !== "DISCARDED")
  let quantity = 0
  let handedIn = 0
  let nextDue: string | null = null
  for (const r of live) {
    const p = teamProgress({
      quantity: r.quantity,
      links: r.links,
      attachments: Array.from({ length: r.attachments }),
    })
    quantity += p.quantity
    handedIn += Math.min(p.handedIn, p.quantity)
    if (r.status !== "DONE" && r.dueOn && (!nextDue || r.dueOn < nextDue)) nextDue = r.dueOn
  }
  return {
    teams: live.length,
    teamsDone: live.filter((r) => r.status === "DONE").length,
    quantity,
    handedIn,
    nextDue,
  }
}

/** Still open (not Done or Discarded) and due within `days` of `today` - or already late. */
export function dueSoon(
  item: { status: string; dueOn: string | null },
  today: string,
  days = 7,
): boolean {
  if (!item.dueOn || item.status === "DONE" || item.status === "DISCARDED") return false
  const limit = new Date(`${today}T00:00:00Z`)
  limit.setUTCDate(limit.getUTCDate() + days)
  return item.dueOn <= limit.toISOString().slice(0, 10)
}
