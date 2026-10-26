// The morning entry summary ("who is in by 9:30 / 10:00 / 11:00"), pure: shared by the job and
// its tests.

export const DEFAULT_SUMMARY_TIMES = ["09:30", "10:00", "11:00"]
export const DEFAULT_OFFICE_START = "10:00"

const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/

/** "09:30, 10:00" -> ["09:30", "10:00"]; anything unreadable falls back to the default. */
export function parseTimes(raw: string | undefined | null): string[] {
  const times = (raw ?? "")
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter((t) => HHMM.test(t))
    .map((t) => t.padStart(5, "0"))
  const unique = [...new Set(times)].sort()
  return unique.length ? unique : DEFAULT_SUMMARY_TIMES
}

export function minutesOf(hhmm: string): number {
  const m = HHMM.exec(hhmm)
  if (!m) return 0
  return Number(m[1]) * 60 + Number(m[2])
}

/** Minutes since midnight in India for a moment in time. */
export function istMinutes(now: Date): number {
  const ist = new Date(now.getTime() + 5.5 * 3_600_000)
  return ist.getUTCHours() * 60 + ist.getUTCMinutes()
}

/** "09:02" in India for a check-in time. */
export function istClock(at: Date): string {
  const ist = new Date(at.getTime() + 5.5 * 3_600_000)
  return `${String(ist.getUTCHours()).padStart(2, "0")}:${String(ist.getUTCMinutes()).padStart(2, "0")}`
}

/** Every slot that has passed today, earliest first. */
export function dueSlots(times: string[], nowMinutes: number): string[] {
  return times.filter((t) => minutesOf(t) <= nowMinutes)
}

export interface EntryPerson {
  name: string
  /** "09:02", or null when not in. */
  checkIn: string | null
  /** Why they are not expected in: on leave, half day, or working from home. */
  away: "leave" | "half-day" | "wfh" | null
}

export interface SummaryOptions {
  /** The day's last slot: a present / absent list, not "not in yet". */
  final?: boolean
  /** A weekend or holiday ("weekend", "holiday: Diwali"): only who came in is worth saying. */
  offDay?: string | null
}

/** One block per group: a heading with the count, then one person per line (time first). */
function block(heading: string, list: EntryPerson[], withTime = false): string | null {
  if (list.length === 0) return null
  const rows = list.map((p) => (withTime ? `${p.checkIn}  ${p.name}` : p.name))
  return [`${heading} (${list.length})`, ...rows].join("\n")
}

/** The title and body of one summary. */
export function buildEntrySummary(
  slot: string,
  officeStart: string,
  people: EntryPerson[],
  opts: SummaryOptions = {},
): { title: string; message: string } {
  const inSoFar = people
    .filter((p) => p.checkIn)
    .sort((a, b) => minutesOf(a.checkIn!) - minutesOf(b.checkIn!) || a.name.localeCompare(b.name))
  const byName = (list: EntryPerson[]) => [...list].sort((a, b) => a.name.localeCompare(b.name))

  if (opts.offDay) {
    return {
      title: `Entries at ${slot} (${opts.offDay}) · ${inSoFar.length} in`,
      message: block("✅ In", inSoFar, true) ?? "In: nobody",
    }
  }

  const notIn = byName(people.filter((p) => !p.checkIn && !p.away))
  const leave = byName(people.filter((p) => !p.checkIn && p.away === "leave"))
  const half = byName(people.filter((p) => !p.checkIn && p.away === "half-day"))
  const wfh = byName(people.filter((p) => !p.checkIn && p.away === "wfh"))
  const afterStart = minutesOf(slot) >= minutesOf(officeStart)

  const blocks = opts.final
    ? [block("✅ Present", inSoFar, true) ?? "Present: nobody", block("❌ Absent", notIn)]
    : [
        block("✅ In", inSoFar, true) ?? "In: nobody yet",
        block(afterStart ? `⏰ Not in by ${officeStart}` : "⏳ Not in yet", notIn),
      ]
  blocks.push(block("🏠 WFH", wfh), block("🌴 On leave", leave), block("🌗 Half day", half))

  const title = opts.final
    ? `Attendance at ${slot} · ${inSoFar.length} present, ${notIn.length} absent`
    : `Entries at ${slot} · ${inSoFar.length} in, ${notIn.length} ${afterStart ? "late" : "not yet"}`
  return { title, message: blocks.filter((b): b is string => !!b).join("\n\n") }
}
