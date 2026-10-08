"use client"

import { useMemo, useState, useSyncExternalStore, type KeyboardEvent } from "react"
import { Check, Copy, MapPin, RotateCcw, Search, X } from "lucide-react"
import { toast } from "sonner"
import { DateField } from "@/components/shared/date-field"
import { TimeField } from "@/components/shared/time-field"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  DEFAULT_CITIES,
  MAX_CITIES,
  dayDiff,
  formatClock,
  formatDay,
  formatOffset,
  parseDate,
  parseSavedZones,
  parseTime,
  planDay,
  runs,
  sameZone,
  searchZones,
  shortClock,
  toDateString,
  toTimeString,
  wallTimeIn,
  wallTimeToInstant,
  weekdayName,
  zoneInfo,
  zoneOffsetMinutes,
  type DateParts,
} from "../lib/time-zones"
import { ToolPage } from "./tool-page"

const HOUR = 3_600_000

// Browser-only values, as stores: nothing time-based is drawn on the server.

const subscribeNothing = () => () => {}

function readBrowserZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  } catch {
    return "UTC"
  }
}

/** This computer's time zone; null on the server. */
function useBrowserZone(): string | null {
  return useSyncExternalStore(subscribeNothing, readBrowserZone, () => null)
}

function subscribeClock(onChange: () => void) {
  const id = window.setInterval(onChange, 1000)
  return () => window.clearInterval(id)
}
/** Same value all minute, so the clocks only re-render when they change. */
const readMinute = () => Math.floor(Date.now() / 60_000) * 60_000

/** Now, to the minute; 0 on the server. */
function useNow(): number {
  return useSyncExternalStore(subscribeClock, readMinute, () => 0)
}

const STORAGE_KEY = "dnms-tools-time-zones"
const cityListeners = new Set<() => void>()
/** Kept in memory too, so adding a city still works where storage is blocked. */
let memoryCities: readonly string[] | null = null
let cachedRaw: string | null | undefined
let cachedCities: readonly string[] = DEFAULT_CITIES

function readCities(): readonly string[] {
  if (memoryCities) return memoryCities
  let raw: string | null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    return DEFAULT_CITIES
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedCities = parseSavedZones(raw) ?? DEFAULT_CITIES
  }
  return cachedCities
}

function subscribeCities(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY && e.key !== null) return
    memoryCities = null // another tab changed the list
    onChange()
  }
  cityListeners.add(onChange)
  window.addEventListener("storage", onStorage)
  return () => {
    cityListeners.delete(onChange)
    window.removeEventListener("storage", onStorage)
  }
}

function saveCities(next: readonly string[]) {
  memoryCities = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Storage blocked (private window): the list still works until the page closes.
  }
  cityListeners.forEach((fn) => fn())
}

function useCities(): readonly string[] {
  return useSyncExternalStore(subscribeCities, readCities, () => DEFAULT_CITIES)
}

function dateOf(w: DateParts): DateParts {
  return { year: w.year, month: w.month, day: w.day }
}

/** 270 -> "4h 30m ahead" */
function relativeToYou(diffMinutes: number): string {
  if (diffMinutes === 0) return "Same time as you"
  const abs = Math.abs(diffMinutes)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  const span = [h ? `${h}h` : "", m ? `${m}m` : ""].filter(Boolean).join(" ")
  return `${span} ${diffMinutes > 0 ? "ahead" : "behind"}`
}

function dayLabel(diff: number): string | null {
  if (diff === 0) return null
  if (diff === 1) return "Next day"
  if (diff === -1) return "Day before"
  return diff > 0 ? `+${diff} days` : `${diff} days`
}

export function TimeZoneConverter() {
  const browserZone = useBrowserZone()
  const now = useNow()
  return (
    <ToolPage slug="time-zones">
      {browserZone && now ? <ZoneTool yourZone={browserZone} now={now} /> : <ZoneToolSkeleton />}
    </ToolPage>
  )
}

function ZoneTool({ yourZone, now }: { yourZone: string; now: number }) {
  const cities = useCities()
  // You first, then the cities - without listing your own zone twice.
  const zones = useMemo(
    () => [yourZone, ...cities.filter((c) => !sameZone(c, yourZone))],
    [yourZone, cities],
  )

  // The converter: a time in one of the listed zones. Empty date/time = right now.
  const [fromChoice, setFromChoice] = useState<string | null>(null)
  const [dateText, setDateText] = useState("")
  const [timeText, setTimeText] = useState("")
  const fromZone = fromChoice && zones.includes(fromChoice) ? fromChoice : yourZone
  const fromCity = zoneInfo(fromZone).city
  const nowThere = wallTimeIn(fromZone, now)
  const date = parseDate(dateText) ?? dateOf(nowThere)
  const time = parseTime(timeText) ?? { hour: nowThere.hour, minute: nowThere.minute }
  const isNow = !dateText && !timeText
  const instant = isNow ? now : wallTimeToInstant({ ...date, ...time }, fromZone)

  // 24 hours x a dozen cities is a few hundred clock reads - cheap enough to redo each render.
  const plan = planDay(date, fromZone, zones)
  const pickedHour = plan.hours.findIndex((h) => instant >= h && instant < h + HOUR)

  function setDate(v: string) {
    setDateText(v)
    if (!timeText) setTimeText(toTimeString(time)) // stop the time ticking once you pick
  }
  function setTime(v: string) {
    setTimeText(v)
    if (!dateText) setDateText(toDateString(date))
  }
  function pickHour(i: number) {
    const h = plan.hours[i]
    if (h === undefined) return
    const w = wallTimeIn(fromZone, h)
    setDateText(toDateString(w))
    setTimeText(toTimeString(w))
  }
  function backToNow() {
    setDateText("")
    setTimeText("")
  }

  function addCity(zone: string) {
    if (zones.some((z) => sameZone(z, zone))) return
    saveCities([...cities, zone])
    toast.success(`${zoneInfo(zone).city} added`)
  }
  function removeCity(zone: string) {
    saveCities(cities.filter((c) => c !== zone))
  }

  const yourOffset = zoneOffsetMinutes(yourZone, now)
  const yourDate = dateOf(wallTimeIn(yourZone, now))
  const isDefaultList =
    cities.length === DEFAULT_CITIES.length && cities.every((c, i) => c === DEFAULT_CITIES[i])

  const converted = zones.map((zone) => {
    const w = wallTimeIn(zone, instant)
    return { zone, wall: w, diff: dayDiff(date, w) }
  })

  async function copyTimes() {
    const lines = converted.map(
      ({ zone, wall }) =>
        `${formatClock(wall)}, ${formatDay(wall)} - ${zoneInfo(zone).city}${zone === yourZone ? " (you)" : ""}`,
    )
    try {
      await navigator.clipboard.writeText(lines.join("\n"))
      toast.success("Times copied - paste them into your invite or email")
    } catch {
      toast.error("Your browser blocked copying - select the text and copy it instead")
    }
  }

  const goodRuns = runs(plan.everyone)

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <Card>
          <CardContent className="space-y-4 p-5">
            <h2 className="text-sm font-semibold">World clocks</h2>
            <ul className="divide-y rounded-sm border">
              {zones.map((zone) => {
                const info = zoneInfo(zone)
                const w = wallTimeIn(zone, now)
                const offset = zoneOffsetMinutes(zone, now)
                const mine = zone === yourZone
                const day = dayLabel(dayDiff(yourDate, w))
                return (
                  <li key={zone} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {mine && <MapPin className="text-primary h-3.5 w-3.5 shrink-0" />}
                        <span className="truncate font-medium">{info.city}</span>
                        {mine && <span className="text-muted-foreground text-xs">(you)</span>}
                      </div>
                      <div className="text-muted-foreground truncate text-xs">
                        {[info.country, formatOffset(offset)].filter(Boolean).join(" · ")}
                        {!mine && ` · ${relativeToYou(offset - yourOffset)}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold tabular-nums">{formatClock(w)}</div>
                      <div className="text-muted-foreground text-xs">
                        {formatDay(w)}
                        {day && <span className="text-foreground font-medium"> · {day}</span>}
                      </div>
                    </div>
                    {mine ? (
                      <span className="w-9 shrink-0" aria-hidden />
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${info.city}`}
                        title={`Remove ${info.city}`}
                        className="text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => removeCity(zone)}
                      >
                        <X />
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>

            <AddCity zones={zones} now={now} full={cities.length >= MAX_CITIES} onAdd={addCity} />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-muted-foreground text-xs">
                Your list is remembered in this browser only.
              </p>
              {!isDefaultList && (
                <Button
                  variant="ghost"
                  className="text-muted-foreground px-2"
                  onClick={() => saveCities(DEFAULT_CITIES)}
                >
                  <RotateCcw />
                  Reset cities
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardContent className="space-y-4 p-5">
              <h2 className="text-sm font-semibold">Convert a time</h2>
              <div className="space-y-2">
                <Label htmlFor="tz-from">Time in</Label>
                <Select value={fromZone} onValueChange={setFromChoice}>
                  <SelectTrigger id="tz-from">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {zones.map((zone) => (
                      <SelectItem key={zone} value={zone}>
                        {zoneInfo(zone).city}
                        {zone === yourZone ? " (you)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div role="group" aria-labelledby="tz-date-label" className="space-y-2">
                <Label id="tz-date-label">Date</Label>
                <DateField value={toDateString(date)} onChange={(v) => v && setDate(v)} />
              </div>
              <div role="group" aria-labelledby="tz-time-label" className="space-y-2">
                <Label id="tz-time-label">Time</Label>
                <TimeField value={toTimeString(time)} onChange={(v) => v && setTime(v)} />
              </div>

              <div className="border-t pt-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {isNow
                      ? "Right now:"
                      : `When it's ${formatClock(time)} on ${formatDay(date)} in ${fromCity}:`}
                  </p>
                  {!isNow && (
                    <Button variant="ghost" className="shrink-0 px-2" onClick={backToNow}>
                      <RotateCcw />
                      Now
                    </Button>
                  )}
                </div>
                {/* Announce a picked time, but not every tick of "right now". */}
                <ul className="space-y-1.5" aria-live={isNow ? "off" : "polite"}>
                  {converted.map(({ zone, wall, diff }) => {
                    const label = dayLabel(diff)
                    return (
                      <li
                        key={zone}
                        className={cn(
                          "flex items-baseline justify-between gap-3 text-sm",
                          zone === fromZone && "text-muted-foreground",
                        )}
                      >
                        <span className="truncate">
                          {zoneInfo(zone).city}
                          {zone === yourZone ? " (you)" : ""}
                        </span>
                        <span className="shrink-0 text-right tabular-nums">
                          <span className="font-semibold">{formatClock(wall)}</span>
                          {label && (
                            <span className="ml-1.5 rounded-sm bg-amber-100 px-1 text-xs text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                              {label}
                            </span>
                          )}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
              <Button variant="outline" className="w-full" onClick={copyTimes}>
                <Copy />
                Copy times
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">
              Meeting planner - {formatDay(date)}, {fromCity} time
            </h2>
            <p className="text-muted-foreground text-xs">
              Each column is one hour. Tap an hour to see it in the converter above.
            </p>
          </div>

          <p
            className={cn(
              "rounded-sm px-3 py-2 text-sm",
              goodRuns.length
                ? "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300"
                : "bg-muted text-muted-foreground",
            )}
          >
            {goodRuns.length
              ? `Works for everyone: ${goodRuns
                  .map(([a, b]) => {
                    const from = wallTimeIn(fromZone, plan.hours[a] ?? 0)
                    const to = wallTimeIn(fromZone, (plan.hours[b] ?? 0) + HOUR)
                    return `${formatClock(from)} - ${formatClock(to)}`
                  })
                  .join(", ")} (${fromCity} time).`
              : "No hour is inside 9 AM - 6 PM for everyone on this day. Pick the hour that is least late, or split the call."}
          </p>

          <div className="overflow-x-auto pb-1">
            <table className="border-separate border-spacing-0.5 text-xs">
              <caption className="sr-only">
                Local time in each city for every hour of {formatDay(date)} ({fromCity} time).
              </caption>
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="bg-card text-muted-foreground sticky left-0 z-10 min-w-32 pr-2 text-left font-medium"
                  >
                    {fromCity} time
                  </th>
                  {plan.hours.map((h, i) => {
                    const w = wallTimeIn(fromZone, h)
                    const good = plan.everyone[i]
                    return (
                      <th key={h} scope="col" className="p-0">
                        <button
                          type="button"
                          onClick={() => pickHour(i)}
                          aria-label={`Pick ${formatClock(w)} ${fromCity} time${good ? " - works for everyone" : ""}`}
                          aria-pressed={i === pickedHour}
                          className={cn(
                            "focus-visible:ring-ring flex h-8 w-12 items-center justify-center gap-0.5 rounded-sm font-medium tabular-nums transition-colors focus-visible:ring-2 focus-visible:outline-none",
                            good
                              ? "bg-green-600 text-white hover:bg-green-700"
                              : "text-muted-foreground hover:bg-accent",
                            i === pickedHour && "ring-primary ring-2",
                          )}
                        >
                          {good && <Check className="h-3 w-3" aria-hidden />}
                          {shortClock(w.hour * 60 + w.minute)}
                        </button>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {plan.rows.map((row, r) => {
                  const zone = zones[r] ?? ""
                  return (
                    <tr key={zone}>
                      <th
                        scope="row"
                        className="bg-card sticky left-0 z-10 max-w-40 pr-2 text-left font-medium"
                      >
                        <div className="truncate">
                          {zoneInfo(zone).city}
                          {zone === yourZone ? " (you)" : ""}
                        </div>
                      </th>
                      {row.map((cell, i) => {
                        const night = cell.minutes < 7 * 60 || cell.minutes >= 22 * 60
                        const showDay = i === 0 || cell.minutes < 60
                        return (
                          <td
                            key={cell.instant}
                            title={`${formatDay(cell.date)}, ${formatClock({ hour: Math.floor(cell.minutes / 60), minute: cell.minutes % 60 })}`}
                            className={cn(
                              "h-10 w-12 rounded-sm text-center leading-tight tabular-nums",
                              cell.work
                                ? "bg-green-500/15 text-green-800 dark:text-green-300"
                                : night
                                  ? "bg-muted text-muted-foreground"
                                  : "",
                              plan.everyone[i] && "font-semibold ring-1 ring-green-600 ring-inset",
                              i === pickedHour && "ring-primary ring-2 ring-inset",
                            )}
                          >
                            <div>{shortClock(cell.minutes)}</div>
                            {showDay && (
                              <div className="text-muted-foreground text-[10px] font-normal">
                                {weekdayName(cell.date)}
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-green-500/25" aria-hidden />
              Work hours (9 AM - 6 PM there)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="bg-muted h-3 w-3 rounded-sm border" aria-hidden />
              Night (10 PM - 7 AM)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-green-600" aria-hidden />
              Works for everyone
            </span>
            <span>Weekends and holidays aren&apos;t marked - check the day names.</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function AddCity({
  zones,
  now,
  full,
  onAdd,
}: {
  zones: readonly string[]
  now: number
  full: boolean
  onAdd: (zone: string) => void
}) {
  const [query, setQuery] = useState("")
  const [focused, setFocused] = useState(false)
  const [active, setActive] = useState(0)
  const results = useMemo(
    () => searchZones(query, 40).filter((o) => !zones.some((z) => sameZone(z, o.zone))),
    [query, zones],
  )
  const open = focused && query.trim() !== ""
  const current = Math.min(active, Math.max(results.length - 1, 0))

  function choose(zone: string) {
    onAdd(zone)
    setQuery("")
    setActive(0)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive(Math.min(current + 1, results.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive(Math.max(current - 1, 0))
    } else if (e.key === "Enter") {
      const pick = results[current]
      if (open && pick) {
        e.preventDefault()
        choose(pick.zone)
      }
    } else if (e.key === "Escape") {
      setQuery("")
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="tz-add">Add a city</Label>
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          id="tz-add"
          role="combobox"
          aria-expanded={open}
          aria-controls="tz-add-results"
          aria-autocomplete="list"
          aria-activedescendant={open && results[current] ? `tz-add-${current}` : undefined}
          aria-describedby="tz-add-hint"
          autoComplete="off"
          disabled={full}
          placeholder={full ? "That's the most cities" : "City or country, like Toronto or Germany"}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
          className="pl-9"
        />
        {open && (
          <ul
            id="tz-add-results"
            role="listbox"
            aria-label="Matching places"
            className="bg-popover text-popover-foreground absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-sm border p-1 shadow-md"
          >
            {results.length ? (
              results.map((o, i) => (
                <li
                  key={o.zone}
                  id={`tz-add-${i}`}
                  role="option"
                  aria-selected={i === current}
                  // Keep focus in the box so the list doesn't close before the click lands.
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(o.zone)}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-sm",
                    i === current && "bg-accent text-accent-foreground",
                  )}
                >
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{o.city}</span>
                    {o.country && <span className="text-muted-foreground"> · {o.country}</span>}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    {formatOffset(zoneOffsetMinutes(o.zone, now))}
                  </span>
                </li>
              ))
            ) : (
              <li className="text-muted-foreground px-2 py-1.5 text-sm">
                No match - try a bigger city nearby, or the country.
              </li>
            )}
          </ul>
        )}
      </div>
      <p id="tz-add-hint" className="text-muted-foreground text-xs">
        {full
          ? `You can show up to ${MAX_CITIES} cities. Remove one to add another.`
          : "Use the arrow keys and Enter, or tap a place."}
      </p>
    </div>
  )
}

/** Shown for the moment before the page is running in the browser. */
function ZoneToolSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <Card>
          <CardContent className="space-y-3 p-5">
            <Skeleton className="h-4 w-28" />
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardContent className="p-5">
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}
