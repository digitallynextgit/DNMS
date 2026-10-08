// An "instant" is ms since 1970 (UTC), like Date.now(); a wall time is what clocks in one zone show.

export interface DateParts {
  year: number
  /** 1-12 */
  month: number
  day: number
}

export interface WallTime extends DateParts {
  hour: number
  minute: number
}

const HOUR = 3_600_000
const DAY = 24 * HOUR

const partFormatters = new Map<string, Intl.DateTimeFormat>()

function partsFormatter(zone: string): Intl.DateTimeFormat {
  let f = partFormatters.get(zone)
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    })
    partFormatters.set(zone, f)
  }
  return f
}

export function wallTimeIn(zone: string, instant: number): WallTime & { second: number } {
  const parts = partsFormatter(zone).formatToParts(new Date(instant))
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0)
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    // Some engines say "24" for midnight even in 23-hour mode.
    hour: get("hour") % 24,
    minute: get("minute"),
    second: get("second"),
  }
}

/** How many minutes `zone` is ahead of UTC at `instant`: India 330, New York in winter -300. */
export function zoneOffsetMinutes(zone: string, instant: number): number {
  const w = wallTimeIn(zone, instant)
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second)
  return Math.round((asUtc - Math.floor(instant / 1000) * 1000) / 60_000)
}

/** 330 -> "GMT+5:30", -240 -> "GMT-4", 0 -> "GMT" */
export function formatOffset(minutes: number): string {
  if (minutes === 0) return "GMT"
  const abs = Math.abs(minutes)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `GMT${minutes > 0 ? "+" : "-"}${h}${m ? `:${String(m).padStart(2, "0")}` : ""}`
}

function sameWall(a: WallTime, b: WallTime): boolean {
  return (
    a.year === b.year &&
    a.month === b.month &&
    a.day === b.day &&
    a.hour === b.hour &&
    a.minute === b.minute
  )
}

/**
 * When clocks go back, a time that happens twice gives the first; when they go forward, a
 * missing time moves on by the gap (2:30 AM becomes 3:30 AM), as a clock would.
 */
export function wallTimeToInstant(wall: WallTime, zone: string): number {
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute)
  // The zone's offset a day either side covers both sides of any change.
  const offsets = new Set([asUtc - DAY, asUtc, asUtc + DAY].map((t) => zoneOffsetMinutes(zone, t)))
  const candidates = [...offsets].map((off) => asUtc - off * 60_000).sort((a, b) => a - b)
  const exact = candidates.find((t) => sameWall(wallTimeIn(zone, t), wall))
  return exact ?? Math.max(...candidates)
}

/** "2026-10-08" -> { year: 2026, month: 10, day: 8 } */
export function parseDate(s: string): DateParts | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const d = new Date(Date.UTC(year, month - 1, day))
  return d.getUTCMonth() === month - 1 && d.getUTCDate() === day ? { year, month, day } : null
}

/** "15:30" -> { hour: 15, minute: 30 } */
export function parseTime(s: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s)
  if (!m) return null
  const hour = Number(m[1])
  const minute = Number(m[2])
  return hour < 24 && minute < 60 ? { hour, minute } : null
}

export function toDateString(d: DateParts): string {
  return `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`
}

export function toTimeString(t: { hour: number; minute: number }): string {
  return `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`
}

/** Calendar days from `a` to `b`: 1 means b is the next day. */
export function dayDiff(a: DateParts, b: DateParts): number {
  return Math.round(
    (Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / DAY,
  )
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** { hour: 15, minute: 0 } -> "3:00 PM" */
export function formatClock(t: { hour: number; minute: number }): string {
  const h = t.hour % 12 || 12
  return `${h}:${String(t.minute).padStart(2, "0")} ${t.hour < 12 ? "AM" : "PM"}`
}

/** -> "Fri 9 Oct" */
export function formatDay(d: DateParts): string {
  const weekday = new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay()
  return `${WEEKDAYS[weekday]} ${d.day} ${MONTHS[d.month - 1]}`
}

export function weekdayName(d: DateParts): string {
  return WEEKDAYS[new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay()] ?? ""
}

/** Minutes after midnight -> "9am", "12pm", "5:30pm" - for the narrow planner cells. */
export function shortClock(minutes: number): string {
  const hour = Math.floor(minutes / 60) % 24
  const minute = minutes % 60
  const h = hour % 12 || 12
  return `${h}${minute ? `:${String(minute).padStart(2, "0")}` : ""}${hour < 12 ? "am" : "pm"}`
}

/** Old names browsers still report (Chrome: "Asia/Calcutta") - only to spot two names for one place. */
const ALIASES: Record<string, string> = {
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Asia/Rangoon": "Asia/Yangon",
  "Asia/Dacca": "Asia/Dhaka",
  "Asia/Thimbu": "Asia/Thimphu",
  "Asia/Ulan_Bator": "Asia/Ulaanbaatar",
  "Asia/Macao": "Asia/Macau",
  "Europe/Kiev": "Europe/Kyiv",
  "America/Buenos_Aires": "America/Argentina/Buenos_Aires",
  "America/Godthab": "America/Nuuk",
  "Pacific/Enderbury": "Pacific/Kanton",
  "Atlantic/Faeroe": "Atlantic/Faroe",
  "Etc/UTC": "UTC",
  "Etc/GMT": "UTC",
  GMT: "UTC",
}

export function zoneKey(zone: string): string {
  return ALIASES[zone] ?? zone
}

export function sameZone(a: string, b: string): boolean {
  return zoneKey(a) === zoneKey(b)
}

interface KnownZone {
  city: string
  country: string
  also?: string
}

/** Friendly names and search words for the places our clients usually are. */
const KNOWN: Record<string, KnownZone> = {
  UTC: { city: "UTC", country: "Universal time", also: "gmt zulu coordinated" },
  "Asia/Kolkata": {
    city: "Kolkata",
    country: "India",
    also: "ist mumbai delhi bengaluru bangalore chennai hyderabad pune calcutta",
  },
  "America/New_York": {
    city: "New York",
    country: "USA",
    also: "us eastern est edt washington boston miami atlanta philadelphia",
  },
  "America/Chicago": { city: "Chicago", country: "USA", also: "us central cst cdt dallas houston" },
  "America/Denver": { city: "Denver", country: "USA", also: "us mountain mst mdt" },
  "America/Phoenix": { city: "Phoenix", country: "USA", also: "arizona" },
  "America/Los_Angeles": {
    city: "Los Angeles",
    country: "USA",
    also: "us pacific pst pdt san francisco seattle california las vegas",
  },
  "America/Anchorage": { city: "Anchorage", country: "USA", also: "alaska" },
  "Pacific/Honolulu": { city: "Honolulu", country: "USA", also: "hawaii" },
  "America/Toronto": { city: "Toronto", country: "Canada", also: "ottawa montreal eastern" },
  "America/Vancouver": { city: "Vancouver", country: "Canada", also: "pacific" },
  "America/Mexico_City": { city: "Mexico City", country: "Mexico" },
  "America/Sao_Paulo": { city: "São Paulo", country: "Brazil", also: "rio" },
  "America/Argentina/Buenos_Aires": { city: "Buenos Aires", country: "Argentina" },
  "America/Bogota": { city: "Bogotá", country: "Colombia" },
  "America/Lima": { city: "Lima", country: "Peru" },
  "America/Santiago": { city: "Santiago", country: "Chile" },
  "Europe/London": {
    city: "London",
    country: "United Kingdom",
    also: "uk britain england gmt bst manchester edinburgh",
  },
  "Europe/Dublin": { city: "Dublin", country: "Ireland" },
  "Europe/Lisbon": { city: "Lisbon", country: "Portugal" },
  "Europe/Paris": { city: "Paris", country: "France", also: "cet" },
  "Europe/Berlin": { city: "Berlin", country: "Germany", also: "frankfurt munich cet" },
  "Europe/Amsterdam": { city: "Amsterdam", country: "Netherlands", also: "holland" },
  "Europe/Brussels": { city: "Brussels", country: "Belgium" },
  "Europe/Zurich": { city: "Zurich", country: "Switzerland", also: "geneva" },
  "Europe/Madrid": { city: "Madrid", country: "Spain", also: "barcelona" },
  "Europe/Rome": { city: "Rome", country: "Italy", also: "milan" },
  "Europe/Vienna": { city: "Vienna", country: "Austria" },
  "Europe/Stockholm": { city: "Stockholm", country: "Sweden" },
  "Europe/Oslo": { city: "Oslo", country: "Norway" },
  "Europe/Copenhagen": { city: "Copenhagen", country: "Denmark" },
  "Europe/Helsinki": { city: "Helsinki", country: "Finland" },
  "Europe/Warsaw": { city: "Warsaw", country: "Poland" },
  "Europe/Prague": { city: "Prague", country: "Czechia", also: "czech republic" },
  "Europe/Athens": { city: "Athens", country: "Greece" },
  "Europe/Istanbul": { city: "Istanbul", country: "Turkey", also: "türkiye turkiye ankara" },
  "Europe/Moscow": { city: "Moscow", country: "Russia" },
  "Europe/Kyiv": { city: "Kyiv", country: "Ukraine", also: "kiev" },
  "Africa/Cairo": { city: "Cairo", country: "Egypt" },
  "Africa/Johannesburg": { city: "Johannesburg", country: "South Africa", also: "cape town" },
  "Africa/Lagos": { city: "Lagos", country: "Nigeria" },
  "Africa/Nairobi": { city: "Nairobi", country: "Kenya" },
  "Asia/Dubai": {
    city: "Dubai",
    country: "United Arab Emirates",
    also: "uae abu dhabi sharjah gulf",
  },
  "Asia/Muscat": { city: "Muscat", country: "Oman" },
  "Asia/Qatar": { city: "Doha", country: "Qatar" },
  "Asia/Riyadh": { city: "Riyadh", country: "Saudi Arabia", also: "ksa jeddah" },
  "Asia/Kuwait": { city: "Kuwait City", country: "Kuwait" },
  "Asia/Bahrain": { city: "Manama", country: "Bahrain" },
  "Asia/Tehran": { city: "Tehran", country: "Iran" },
  "Asia/Karachi": { city: "Karachi", country: "Pakistan", also: "lahore islamabad" },
  "Asia/Kathmandu": { city: "Kathmandu", country: "Nepal" },
  "Asia/Dhaka": { city: "Dhaka", country: "Bangladesh" },
  "Asia/Colombo": { city: "Colombo", country: "Sri Lanka" },
  "Asia/Thimphu": { city: "Thimphu", country: "Bhutan" },
  "Asia/Yangon": { city: "Yangon", country: "Myanmar", also: "rangoon" },
  "Asia/Bangkok": { city: "Bangkok", country: "Thailand" },
  "Asia/Jakarta": { city: "Jakarta", country: "Indonesia" },
  "Asia/Ho_Chi_Minh": { city: "Ho Chi Minh City", country: "Vietnam", also: "saigon hanoi" },
  "Asia/Kuala_Lumpur": { city: "Kuala Lumpur", country: "Malaysia" },
  "Asia/Singapore": { city: "Singapore", country: "Singapore" },
  "Asia/Manila": { city: "Manila", country: "Philippines" },
  "Asia/Hong_Kong": { city: "Hong Kong", country: "Hong Kong" },
  "Asia/Shanghai": { city: "Shanghai", country: "China", also: "beijing shenzhen" },
  "Asia/Taipei": { city: "Taipei", country: "Taiwan" },
  "Asia/Seoul": { city: "Seoul", country: "South Korea", also: "korea" },
  "Asia/Tokyo": { city: "Tokyo", country: "Japan", also: "jst osaka" },
  "Australia/Perth": { city: "Perth", country: "Australia" },
  "Australia/Adelaide": { city: "Adelaide", country: "Australia" },
  "Australia/Brisbane": { city: "Brisbane", country: "Australia" },
  "Australia/Sydney": { city: "Sydney", country: "Australia", also: "aest aedt canberra" },
  "Australia/Melbourne": { city: "Melbourne", country: "Australia" },
  "Pacific/Auckland": { city: "Auckland", country: "New Zealand", also: "nz wellington" },
}

/** "America/Port_of_Spain" -> { city: "Port of Spain", country: "America" } */
export function zoneInfo(zone: string): { city: string; country: string } {
  const known = KNOWN[zoneKey(zone)]
  if (known) return { city: known.city, country: known.country }
  const parts = zone.split("/")
  return {
    city: (parts[parts.length - 1] ?? zone).replace(/_/g, " "),
    country: parts.length > 1 ? (parts[0] ?? "").replace(/_/g, " ") : "",
  }
}

export function isValidZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone })
    return true
  } catch {
    return false
  }
}

export interface ZoneOption {
  zone: string
  city: string
  country: string
}

let zoneCache: (ZoneOption & { search: string })[] | null = null

/** "São Paulo" -> "sao paulo" */
function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
}

/** Every place the browser knows, one entry per zone (no "Etc/GMT+5"-style codes). */
export function allZones(): (ZoneOption & { search: string })[] {
  if (zoneCache) return zoneCache
  let ids: string[]
  try {
    ids = Intl.supportedValuesOf("timeZone")
  } catch {
    ids = Object.keys(KNOWN)
  }
  const seen = new Set<string>()
  const out: (ZoneOption & { search: string })[] = []
  for (const zone of ["UTC", ...ids]) {
    if (zone !== "UTC" && (!zone.includes("/") || zone.startsWith("Etc/"))) continue
    const key = zoneKey(zone)
    if (seen.has(key)) continue
    seen.add(key)
    const info = zoneInfo(zone)
    const also = KNOWN[key]?.also ?? ""
    out.push({ zone, ...info, search: fold(`${info.city} ${info.country} ${also} ${zone}`) })
  }
  zoneCache = out
  return out
}

/** Places matching what's typed - city names first, then countries and other words. */
export function searchZones(query: string, limit = 30): ZoneOption[] {
  const q = fold(query.trim())
  if (!q) return []
  const scored: { option: ZoneOption; score: number }[] = []
  for (const z of allZones()) {
    const city = fold(z.city)
    const score = city.startsWith(q)
      ? 0
      : city.split(/[\s-]/).some((w) => w.startsWith(q))
        ? 1
        : z.search.split(/[\s/_]+/).some((w) => w.startsWith(q))
          ? 2
          : z.search.includes(q)
            ? 3
            : -1
    if (score >= 0)
      scored.push({ option: { zone: z.zone, city: z.city, country: z.country }, score })
  }
  return scored
    .sort((a, b) => a.score - b.score || a.option.city.localeCompare(b.option.city))
    .slice(0, limit)
    .map((s) => s.option)
}

export const DEFAULT_CITIES: readonly string[] = [
  "America/New_York",
  "Europe/London",
  "Asia/Dubai",
  "Asia/Singapore",
  "Australia/Sydney",
]
export const MAX_CITIES = 12

export function parseSavedZones(raw: string | null): string[] | null {
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value)) return null
    const zones: string[] = []
    for (const z of value)
      if (typeof z === "string" && isValidZone(z) && !zones.some((s) => sameZone(s, z)))
        zones.push(z)
    return zones.slice(0, MAX_CITIES)
  } catch {
    return null
  }
}

export const WORK_START = 9 * 60
export const WORK_END = 18 * 60

/** Does the hour starting `minutes` after midnight sit fully inside 9 AM-6 PM? */
export function isWorkHour(minutes: number): boolean {
  return minutes >= WORK_START && minutes + 60 <= WORK_END
}

export interface PlannerCell {
  instant: number
  date: DateParts
  /** Local minutes after midnight. */
  minutes: number
  work: boolean
}

export interface DayPlan {
  /** The 24 hours of the day in `fromZone`, as instants. */
  hours: number[]
  rows: PlannerCell[][]
  /** Hours that are inside work hours everywhere. */
  everyone: boolean[]
}

export function planDay(date: DateParts, fromZone: string, zones: readonly string[]): DayPlan {
  const start = wallTimeToInstant({ ...date, hour: 0, minute: 0 }, fromZone)
  const hours = Array.from({ length: 24 }, (_, i) => start + i * HOUR)
  const rows = zones.map((zone) =>
    hours.map((instant) => {
      const w = wallTimeIn(zone, instant)
      const minutes = w.hour * 60 + w.minute
      return {
        instant,
        date: { year: w.year, month: w.month, day: w.day },
        minutes,
        work: isWorkHour(minutes),
      }
    }),
  )
  const everyone = hours.map((_, i) => rows.length > 0 && rows.every((r) => r[i]?.work))
  return { hours, rows, everyone }
}

/** Unbroken runs of `true`, as [first, last] index pairs. */
export function runs(flags: readonly boolean[]): [number, number][] {
  const out: [number, number][] = []
  flags.forEach((on, i) => {
    if (!on) return
    const last = out[out.length - 1]
    if (last && last[1] === i - 1) last[1] = i
    else out.push([i, i])
  })
  return out
}
