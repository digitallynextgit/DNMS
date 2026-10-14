// Pure helpers for the Google Drive card and the nightly backup: the plan from the quota, usage
// warnings, the 2 AM IST clock and backup object names. No server imports, so tests run them directly.

const GB = 1024 ** 3

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  let n = bytes
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}

export interface DrivePlan {
  label: string
  tier: "free" | "paid" | "unlimited" | "custom"
}

// Google One sizes, in GB. Google reports the limit in bytes, a hair off the round number.
const PAID_GB: [number, string][] = [
  [100, "100 GB"],
  [200, "200 GB"],
  [2048, "2 TB"],
  [5120, "5 TB"],
  [10240, "10 TB"],
]

export function planFromLimit(limit: number | null): DrivePlan {
  if (limit == null) return { label: "Unlimited", tier: "unlimited" }
  const gb = limit / GB
  if (Math.abs(gb - 15) < 0.5) return { label: "Free · 15 GB", tier: "free" }
  for (const [size, label] of PAID_GB) {
    if (Math.abs(gb - size) / size < 0.02) return { label: `Google One · ${label}`, tier: "paid" }
  }
  return { label: formatBytes(limit), tier: "custom" }
}

export interface DriveWarning {
  level: "info" | "warn" | "critical"
  message: string
}

/** When to suggest the 100 GB plan: well before the free 15 GB runs out. */
export const UPGRADE_AT_BYTES = 10 * GB

export function storageWarnings(q: {
  limit: number | null
  usage: number
  usageInDriveTrash: number
}): DriveWarning[] {
  const out: DriveWarning[] = []
  const pct = q.limit ? (q.usage / q.limit) * 100 : 0
  if (pct >= 95) {
    out.push({
      level: "critical",
      message: `Drive is ${Math.floor(pct)}% full. Uploads will start failing - upgrade the plan or free up space now.`,
    })
  } else if (pct >= 80) {
    out.push({ level: "warn", message: `Drive is ${Math.floor(pct)}% full.` })
  }
  if (planFromLimit(q.limit).tier === "free" && q.usage >= UPGRADE_AT_BYTES && pct < 95) {
    out.push({
      level: "warn",
      message: "Usage has passed 10 GB. Time to upgrade to Google One 100 GB (₹130 a month).",
    })
  }
  if (q.usageInDriveTrash >= GB) {
    out.push({
      level: "info",
      message: `${formatBytes(q.usageInDriveTrash)} in Drive's trash still counts against the quota. Drive empties its trash after 30 days.`,
    })
  }
  return out
}

// India has no daylight saving, so IST is a fixed offset.
const IST_OFFSET_MS = 330 * 60_000

/** The hour the nightly backup may start, IST. */
export const BACKUP_HOUR_IST = 2

export function istParts(now: Date): { date: string; hour: number } {
  const ist = new Date(now.getTime() + IST_OFFSET_MS)
  return { date: ist.toISOString().slice(0, 10), hour: ist.getUTCHours() }
}

/** Hourly ticks run the backup once per IST day, at or after 2 AM. */
export function backupDue(now: Date, lastRunDate: string | null): boolean {
  const { date, hour } = istParts(now)
  return hour >= BACKUP_HOUR_IST && lastRunDate !== date
}

/** The next 2 AM IST the backup will run (today's if it hasn't run yet and it's before 2 AM). */
export function nextBackupAt(now: Date, lastRunDate: string | null): Date {
  const { date, hour } = istParts(now)
  const at = (day: string) =>
    new Date(Date.parse(`${day}T00:00:00Z`) + BACKUP_HOUR_IST * 3_600_000 - IST_OFFSET_MS)
  if (lastRunDate !== date) {
    // Past 2 AM and not run: the next hourly tick picks it up.
    return hour < BACKUP_HOUR_IST ? at(date) : now
  }
  const tomorrow = new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
  return at(tomorrow)
}

/** Google's own formats are exported to Office ones for the backup; other native types are skipped. */
export const NATIVE_EXPORTS: Record<string, { mimeType: string; ext: string }> = {
  "application/vnd.google-apps.document": {
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ext: ".docx",
  },
  "application/vnd.google-apps.spreadsheet": {
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ext: ".xlsx",
  },
  "application/vnd.google-apps.presentation": {
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ext: ".pptx",
  },
  "application/vnd.google-apps.drawing": { mimeType: "application/pdf", ext: ".pdf" },
}

export const BACKUP_PREFIX = "drive-backup/"

/** One object per Drive file, named so the bucket is readable without DNMS. */
export function backupKey(input: {
  tenantSlug: string
  projectId: string | null
  driveFileId: string
  name: string
  /** Forced extension for exported Google files. */
  ext?: string
}): string {
  const dot = input.name.lastIndexOf(".")
  const hasExt = dot > 0 && dot >= input.name.length - 8
  const base = (hasExt ? input.name.slice(0, dot) : input.name)
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60)
  const ext = input.ext ?? (hasExt ? input.name.slice(dot).toLowerCase() : "")
  return `${BACKUP_PREFIX}${input.tenantSlug}/${input.projectId ?? "unfiled"}/${input.driveFileId}-${base || "file"}${ext}`
}

/** New, or changed in Drive since its last copy. */
export function needsBackup(
  modifiedTime: string | null,
  prev: { sourceModifiedAt: Date } | null,
): boolean {
  if (!prev) return true
  return !!modifiedTime && Date.parse(modifiedTime) > prev.sourceModifiedAt.getTime()
}

/** Backups of files deleted from Drive are kept this long, so a mistaken delete can be recovered. */
export const DELETED_RETENTION_DAYS = 30
