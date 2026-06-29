import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, formatDistanceToNow } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string | null | undefined, fmt = "dd/MM/yyyy"): string {
  if (!date) return "-"
  return format(new Date(date), fmt)
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "-"
  return format(new Date(date), "dd/MM/yyyy HH:mm")
}

export function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return "-"
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Decimal hours → "Xh Ym" (e.g. 8.58 → "8h 35m"); drops minutes when zero. */
export function formatWorkHours(hours: number): string {
  const totalMinutes = Math.round(hours * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function generateEmployeeNo(sequence: number, year = new Date().getFullYear()): string {
  return `EMP-${year}-${String(sequence).padStart(4, "0")}`
}

// Human-readable profile URL slug: "<employeeCode>-<first>-<last>", e.g.
// "8-diwakar-jha". The employee code stays verbatim (it's the unique lookup key);
// the name is slugified for readability. getEmployee() resolves this back to an id.
export function employeeSlug(employeeNo: string, firstName: string, lastName: string): string {
  const name = `${firstName} ${lastName}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return name ? `${employeeNo}-${name}` : employeeNo
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

export function truncate(text: string, length: number): string {
  if (text.length <= length) return text
  return `${text.substring(0, length)}...`
}

// Deterministic color from name for avatar backgrounds
export function getAvatarColor(name: string): string {
  const colors = [
    "bg-blue-500",
    "bg-violet-500",
    "bg-green-500",
    "bg-amber-500",
    "bg-rose-500",
    "bg-teal-500",
    "bg-indigo-500",
    "bg-orange-500",
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}
