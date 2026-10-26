// The morning entry summary ("who is in by 9:30 / 10:00"), pure: shared by the job and its tests.

export const DEFAULT_SUMMARY_TIMES = ["09:30", "10:00"]
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

/** "9:02" in India for a check-in time. */
export function istClock(at: Date): string {
  const ist = new Date(at.getTime() + 5.5 * 3_600_000)
  return `${ist.getUTCHours()}:${String(ist.getUTCMinutes()).padStart(2, "0")}`
}

/** Every slot that has passed today, earliest first. */
export function dueSlots(times: string[], nowMinutes: number): string[] {
  return times.filter((t) => minutesOf(t) <= nowMinutes)
}

export interface EntryPerson {
  name: string
  /** "9:02", or null when not in. */
  checkIn: string | null
  /** Why they are not expected in: on leave, half day, or working from home. */
  away: "leave" | "half-day" | "wfh" | null
}

const names = (list: EntryPerson[]) => list.map((p) => p.name).join(", ")

/** The title and body of one summary. */
export function buildEntrySummary(
  slot: string,
  officeStart: string,
  people: EntryPerson[],
): { title: string; message: string } {
  const inSoFar = people
    .filter((p) => p.checkIn)
    .sort((a, b) => minutesOf(a.checkIn!.padStart(5, "0")) - minutesOf(b.checkIn!.padStart(5, "0")))
  const notIn = people.filter((p) => !p.checkIn && !p.away)
  const leave = people.filter((p) => !p.checkIn && p.away === "leave")
  const half = people.filter((p) => !p.checkIn && p.away === "half-day")
  const wfh = people.filter((p) => !p.checkIn && p.away === "wfh")
  const afterStart = minutesOf(slot) >= minutesOf(officeStart)

  const lines: string[] = []
  lines.push(
    inSoFar.length
      ? `In (${inSoFar.length}): ${inSoFar.map((p) => `${p.name} ${p.checkIn}`).join(", ")}`
      : "In: nobody yet",
  )
  if (notIn.length)
    lines.push(
      `${afterStart ? `Not in by ${officeStart}` : "Not in yet"} (${notIn.length}): ${names(notIn)}`,
    )
  if (wfh.length) lines.push(`WFH (${wfh.length}): ${names(wfh)}`)
  if (leave.length) lines.push(`On leave (${leave.length}): ${names(leave)}`)
  if (half.length) lines.push(`Half day (${half.length}): ${names(half)}`)

  const title = `Entries at ${slot} · ${inSoFar.length} in, ${notIn.length} ${afterStart ? "late" : "not yet"}`
  return { title, message: lines.join("\n") }
}
