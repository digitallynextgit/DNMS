// Sales leads: stages and the small rules the table, the API and the reminders share.

import { daysFromTo } from "@/lib/dates"

export const STAGES = [
  "NEW",
  "CONTACTED",
  "INTERESTED",
  "VISIT",
  "QUOTATION",
  "WON",
  "LOST",
] as const
export type Stage = (typeof STAGES)[number]

export const STAGE_LABEL: Record<Stage, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  INTERESTED: "Interested",
  VISIT: "Site visit / demo",
  QUOTATION: "Quotation sent",
  WON: "Won",
  LOST: "Lost",
}

export const STAGE_CLASS: Record<Stage, string> = {
  NEW: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  CONTACTED: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  INTERESTED: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  VISIT: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  QUOTATION: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  WON: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  LOST: "bg-muted text-muted-foreground",
}

export const isStage = (v: unknown): v is Stage =>
  typeof v === "string" && (STAGES as readonly string[]).includes(v)

/** Still being worked: follow-ups and reminders apply. */
export const isOpenStage = (s: string) => s !== "WON" && s !== "LOST"

export const ACTIVITY_KINDS = ["CALL", "WHATSAPP", "EMAIL", "VISIT", "NOTE"] as const
export type ActivityKind = (typeof ACTIVITY_KINDS)[number]

export const ACTIVITY_LABEL: Record<ActivityKind | "STAGE" | "CREATED", string> = {
  CALL: "Call",
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
  VISIT: "Visit",
  NOTE: "Note",
  STAGE: "Stage",
  CREATED: "Added",
}

/**
 * The phone as international digits for tel:/WhatsApp and duplicate checks. Indian numbers come in
 * every shape (+91 98..., 098..., 98...); a bare 10-digit number is taken as Indian.
 */
export function phoneDigits(raw: string | null | undefined): string | null {
  if (!raw) return null
  let d = raw.replace(/\D/g, "")
  if (d.startsWith("00")) d = d.slice(2)
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1)
  if (d.length === 10) d = `91${d}`
  return d.length >= 8 ? d : null
}

export function whatsappLink(phone: string | null | undefined, text?: string): string | null {
  const d = phoneDigits(phone)
  if (!d) return null
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ""}`
}

export function telLink(phone: string | null | undefined): string | null {
  const d = phoneDigits(phone)
  return d ? `tel:+${d}` : null
}

/** Same lead twice: the same phone, or (without one) the same business in the same area. */
export function duplicateKey(lead: {
  business: string
  phone?: string | null
  area?: string | null
}): string {
  const digits = phoneDigits(lead.phone)
  if (digits) return `p:${digits}`
  const norm = (v: string | null | undefined) =>
    (v ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
  return `b:${norm(lead.business)}|${norm(lead.area)}`
}

export type FollowUpState = "OVERDUE" | "TODAY" | "UPCOMING"

export function followUpState(date: string | null, today: string): FollowUpState | null {
  if (!date) return null
  const d = daysFromTo(today, date)
  return d < 0 ? "OVERDUE" : d === 0 ? "TODAY" : "UPCOMING"
}
