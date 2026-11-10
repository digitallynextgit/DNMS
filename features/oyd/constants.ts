import type { OydCategory, OydStatus } from "./types"

/** The OYD framework from HR's policy mail. A fifth active flag stays at level 4. */
export const OYD_LEVELS = [
  {
    level: 1,
    emoji: "🟡",
    label: "Flag 1",
    action: "Feedback and coaching by your Reporting Manager",
    color: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
  },
  {
    level: 2,
    emoji: "🟠",
    label: "Flag 2",
    action: "Strict monitoring by your Reporting Manager and HR",
    color: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  },
  {
    level: 3,
    emoji: "🔴",
    label: "Flag 3",
    action: "Performance Improvement Plan (PIP)",
    color: "bg-red-500/15 text-red-700 dark:text-red-300",
  },
  {
    level: 4,
    emoji: "⚫",
    label: "Flag 4",
    action: "Management review, which may lead to separation",
    color: "bg-foreground text-background",
  },
] as const

export type OydLevel = (typeof OYD_LEVELS)[number]

export const OYD_CATEGORIES: Record<OydCategory, { label: string; hint: string }> = {
  MISSED_DEADLINE: {
    label: "Missed deadline",
    hint: "Missed a deadline without telling anyone first",
  },
  DELAYED_HANDOVER: {
    label: "Delayed handover",
    hint: "A late handover held up someone else's work",
  },
  BLOCKER_NOT_SHARED: {
    label: "Blocker not shared",
    hint: "Didn't raise a blocker in time",
  },
  REPEATED_DELAYS: {
    label: "Repeated delays",
    hint: "Repeated delays or lack of ownership hurting delivery",
  },
}

export const OYD_CATEGORY_KEYS = Object.keys(OYD_CATEGORIES) as OydCategory[]

export const OYD_STATUS_LABELS: Record<OydStatus | "REMOVED", string> = {
  PENDING: "Waiting to be confirmed",
  CONFIRMED: "Confirmed",
  REJECTED: "Not confirmed",
  REMOVED: "Removed",
}

export const OYD_STATUS_COLORS: Record<OydStatus | "REMOVED", string> = {
  PENDING: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  CONFIRMED: "bg-red-500/10 text-red-600 dark:text-red-400",
  REJECTED: "bg-muted text-muted-foreground",
  REMOVED: "bg-muted text-muted-foreground",
}

export const OYD_NOTE_MAX = 2000
