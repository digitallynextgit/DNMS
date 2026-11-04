import type { VoteEventStatus } from "./types"

export const VOTE_STATUS_LABELS: Record<VoteEventStatus, string> = {
  DRAFT: "Draft",
  UPCOMING: "Opens soon",
  OPEN: "Voting open",
  CLOSED: "Closed",
}

export const VOTE_STATUS_COLORS: Record<VoteEventStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  UPCOMING: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  OPEN: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  CLOSED: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
}

/** Option photos: what the upload accepts and how large it may be. */
export const OPTION_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const
export const OPTION_PHOTO_MAX_BYTES = 10 * 1024 * 1024
