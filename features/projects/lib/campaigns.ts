// Planner campaigns: pure rules shared by the cards, the API and the daily reminders.

import { daysFromTo } from "@/lib/dates"
import type { WorkbookTeamStatus } from "./workbook-team-progress"

export type CampaignState = "UPCOMING" | "DUE" | "LIVE" | "ENDED"

export interface CampaignTiming {
  state: CampaignState
  /** UPCOMING: days until it starts. DUE / LIVE: days left (0 = last day). ENDED: days since the deadline. */
  days: number
}

/** A running campaign is "due", not live, until a team has started (`started`). */
export function campaignTiming(
  c: { startDate: string; deadline: string },
  today: string,
  started = true,
): CampaignTiming {
  const toStart = daysFromTo(today, c.startDate)
  if (toStart > 0) return { state: "UPCOMING", days: toStart }
  const left = daysFromTo(today, c.deadline)
  if (left >= 0) return { state: started ? "LIVE" : "DUE", days: left }
  return { state: "ENDED", days: -left }
}

/** Work has begun once any team is In progress or Done (Stuck can be blocked before starting). */
export function campaignStarted(teams: readonly { status: WorkbookTeamStatus }[]): boolean {
  return teams.some((t) => t.status === "IN_PROGRESS" || t.status === "DONE")
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

export function campaignTimingLabel({ state, days }: CampaignTiming): string {
  if (state === "UPCOMING")
    return days === 1 ? "Starts tomorrow" : `Starts in ${plural(days, "day")}`
  if (state === "DUE") return days === 0 ? "Due today" : `Due in ${plural(days, "day")}`
  if (state === "LIVE") return days === 0 ? "Live - last day" : `Live - ${plural(days, "day")} left`
  return days === 0 ? "Ended today" : `Ended ${plural(days, "day")} ago`
}

/** A start date after the deadline (or a missing one) can't be a campaign. */
export function campaignDatesProblem(startDate: string, deadline: string): string | null {
  if (!startDate || !deadline) return "Pick a start date and a deadline"
  return deadline < startDate ? "The deadline can't be before the start date" : null
}

export interface PlanLike {
  status: WorkbookTeamStatus
  /** YYYY-MM-DD or null. */
  dueOn: string | null
}

const CLOSED: ReadonlySet<WorkbookTeamStatus> = new Set(["DONE", "DISCARDED"])

/** Team plans done out of those still owed (dropped ones don't count), and how many are late. */
export function planProgress(plans: readonly PlanLike[], today: string) {
  const owed = plans.filter((p) => p.status !== "DISCARDED")
  return {
    total: owed.length,
    done: owed.filter((p) => p.status === "DONE").length,
    stuck: owed.filter((p) => p.status === "STUCK").length,
    overdue: owed.filter((p) => !CLOSED.has(p.status) && !!p.dueOn && p.dueOn < today).length,
  }
}

/** A team plan's reminder starts this many days before it is due. */
export const SOON_DAYS = 3

export type ReminderStage = "SOON" | "DUE" | "OVERDUE"

/** Which reminder an open, dated team plan is at today, if any. */
export function reminderStage(plan: PlanLike, today: string): ReminderStage | null {
  if (!plan.dueOn || CLOSED.has(plan.status)) return null
  const left = daysFromTo(today, plan.dueOn)
  if (left < 0) return "OVERDUE"
  if (left === 0) return "DUE"
  return left <= SOON_DAYS ? "SOON" : null
}
