// Full & Final settlement rules, pure so the table, the API and the reminders agree.

import { daysFromTo, indiaToday } from "@/lib/dates"

export const NOTICE_PERIODS = ["SERVED", "NOT_SERVED", "COMPANY_EXIT"] as const
export type NoticePeriod = (typeof NOTICE_PERIODS)[number]

export const NOTICE_LABEL: Record<NoticePeriod, string> = {
  SERVED: "Served",
  NOT_SERVED: "Not served",
  COMPANY_EXIT: "Company exit",
}

/** FnF is due this many calendar months after the last working day. */
export const FNF_MONTHS = 2
/** "Due soon" (and the HR reminder) starts this many days before the due date. */
export const DUE_SOON_DAYS = 7

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/
const pad = (n: number) => String(n).padStart(2, "0")

function parts(date: string): [number, number, number] {
  const m = DAY.exec(date)
  if (!m) throw new Error(`Not a YYYY-MM-DD date: ${date}`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

/** Last working day + two months; a month too short for the day ends on its last day (31 Dec -> 28 Feb). */
export function fnfDueDate(lastWorkingDate: string): string {
  const [y, m, d] = parts(lastWorkingDate)
  const month0 = m - 1 + FNF_MONTHS
  const year = y + Math.floor(month0 / 12)
  const month = (month0 % 12) + 1
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${year}-${pad(month)}-${pad(Math.min(d, lastDay))}`
}

/** Whole days from `a` to `b` (positive when b is later). */
export const daysFrom = daysFromTo

export type FnfState = "RELEASED" | "RELEASED_LATE" | "OVERDUE" | "DUE_SOON" | "PENDING"

export interface FnfStatus {
  state: FnfState
  /** Days late (RELEASED_LATE, OVERDUE) or days left (DUE_SOON, PENDING); 0 for RELEASED. */
  days: number
}

export function fnfStatus(
  row: { dueDate: string; releasedOn: string | null },
  today: string,
): FnfStatus {
  if (row.releasedOn) {
    const late = daysFrom(row.dueDate, row.releasedOn)
    return late > 0 ? { state: "RELEASED_LATE", days: late } : { state: "RELEASED", days: 0 }
  }
  const left = daysFrom(today, row.dueDate)
  if (left < 0) return { state: "OVERDUE", days: -left }
  return { state: left <= DUE_SOON_DAYS ? "DUE_SOON" : "PENDING", days: left }
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

export function fnfStatusLabel({ state, days }: FnfStatus): string {
  switch (state) {
    case "RELEASED":
      return "Released on time"
    case "RELEASED_LATE":
      return `Released ${plural(days, "day")} late`
    case "OVERDUE":
      return `Overdue by ${plural(days, "day")}`
    case "DUE_SOON":
      return days === 0 ? "Due today" : `Due in ${plural(days, "day")}`
    case "PENDING":
      return `Due in ${plural(days, "day")}`
  }
}

export { indiaToday }
