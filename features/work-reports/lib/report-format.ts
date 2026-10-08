// Pure helpers for the work report period and text, shared by the loader and every renderer.

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

export interface ReportPeriod {
  /** "YYYY-MM" */
  month: string
  /** First and last calendar day, "YYYY-MM-DD". */
  from: string
  to: string
  /** "September 2026" */
  label: string
}

/** The period for a "YYYY-MM" month, or null when the string is not one. */
export function parseReportMonth(month: string): ReportPeriod | null {
  if (!MONTH_RE.test(month)) return null
  const [y, m] = month.split("-").map(Number) as [number, number]
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return {
    month,
    from: `${month}-01`,
    to: `${month}-${String(last).padStart(2, "0")}`,
    label: `${MONTH_NAMES[m - 1]} ${y}`,
  }
}

/** "YYYY-MM" of the month before the one `now` falls in (IST). */
export function previousMonth(now: Date): string {
  const ist = new Date(now.getTime() + 5.5 * 3_600_000)
  const d = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() - 1, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

/** "YYYY-MM" shifted by `by` months. */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number]
  const d = new Date(Date.UTC(y, m - 1 + by, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

/** Every calendar day of the period, "YYYY-MM-DD". */
export function daysOf(period: ReportPeriod): string[] {
  const out: string[] = []
  for (
    let t = Date.parse(`${period.from}T00:00:00Z`);
    t <= Date.parse(`${period.to}T00:00:00Z`);
    t += 86_400_000
  ) {
    out.push(new Date(t).toISOString().slice(0, 10))
  }
  return out
}

export function isWeekendKey(day: string): boolean {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay()
  return dow === 0 || dow === 6
}

/** { dm: "01 Sep", dow: "Tue" } for a "YYYY-MM-DD" day. */
export function dayLabel(day: string): { dm: string; dow: string } {
  const d = new Date(`${day}T00:00:00Z`)
  return {
    dm: `${String(d.getUTCDate()).padStart(2, "0")} ${MONTH_NAMES[d.getUTCMonth()]!.slice(0, 3)}`,
    dow: DOW[d.getUTCDay()]!,
  }
}

/** A task title for the report: no leftover "1. 1." numbering, stray whitespace or trailing
 *  punctuation, and a capital first letter. */
export function cleanTitle(title: string): string {
  const t = title
    .replace(/^\s*(\d+\s*[.)]\s*)+/, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,;:.])/g, "$1")
    .trim()
    .replace(/[\s,;:.-]+$/, "")
  return t ? t[0]!.toUpperCase() + t.slice(1) : title.trim()
}

/** The project an ad-hoc task's title names ("Skelmet - Shiprocket setup" -> SKELMET): whole
 *  name or code, 3+ chars, case-insensitive, longest match wins. Null if none. */
export function projectNamedIn(
  title: string,
  projects: { name: string; code: string | null }[],
): string | null {
  const haystack = ` ${title.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `
  let best: { name: string; len: number } | null = null
  for (const p of projects) {
    for (const term of [p.name, p.code]) {
      if (!term) continue
      const needle = term
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
      if (needle.length < 3) continue
      // "happyganga" names HAPPY GANGA as surely as "happy ganga" does.
      const squashed = needle.replace(/ /g, "")
      const hit = haystack.includes(` ${needle} `) || haystack.includes(` ${squashed} `)
      if (hit && (!best || needle.length > best.len)) best = { name: p.name, len: needle.length }
    }
  }
  return best?.name ?? null
}

/** "8.5 h"; never "0.0 h" for time that did register. */
export function formatHoursShort(h: number): string {
  if (h <= 0) return "-"
  return `${Math.max(h, 0.1).toFixed(1)} h`
}

/** "437 h" */
export function formatHoursRound(h: number): string {
  return `${Math.round(h)} h`
}

/** "WorkReport-September-2026-Diwakar-Jha.pptx" style, ASCII only. */
export function reportFilename(label: string, who: string, ext: string): string {
  const slug = (s: string) =>
    s
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
  return `Work-Report-${slug(label)}-${slug(who)}.${ext}`
}
