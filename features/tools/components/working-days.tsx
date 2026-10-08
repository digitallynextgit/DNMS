"use client"

import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react"
import { AlertTriangle, CalendarCheck, Info, RotateCw } from "lucide-react"
import { Link } from "@/components/tenant-link"
import { DateField, parseDateString, toDateString } from "@/components/shared/date-field"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCompanyHolidays } from "../hooks/use-company-holidays"
import {
  MAX_ADD_WORKING_DAYS,
  addWorkingDays,
  buildHolidayMap,
  checkRange,
  countWorkingDays,
  floatingHolidaysBetween,
  formatYmd,
  shiftYmd,
  yearsBetween,
  yearsForAdd,
  type DaySummary,
  type RangeProblem,
  type SkippedDay,
} from "../lib/working-days"
import { ToolPage } from "./tool-page"

type Mode = "between" | "add"

const RANGE_MESSAGES: Record<RangeProblem, string> = {
  missing: "Pick an end date to see the count.",
  invalid: "One of those dates isn't valid - pick it again.",
  "end-before-start": "The end date is before the start date. Pick a later end date.",
  "too-long": "Pick dates up to 3 years apart.",
}

// "Today" comes from the browser only: the server's clock may be on another
// date (UTC vs IST), and rendering it there would mismatch on hydration.
const noSubscribe = () => () => {}
function useToday(): string | null {
  return useSyncExternalStore(
    noSubscribe,
    () => toDateString(new Date()),
    () => null,
  )
}

function parseCount(raw: string): { n: number } | { error: string } {
  const value = raw.trim()
  if (!value) return { error: "Type how many working days to add." }
  if (!/^\d+$/.test(value)) return { error: "Use a whole number, like 10." }
  const n = Number(value)
  if (n > MAX_ADD_WORKING_DAYS) return { error: `Use ${MAX_ADD_WORKING_DAYS} days or fewer.` }
  return { n }
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export function WorkingDaysCalculator() {
  const today = useToday()
  const [mode, setMode] = useState<Mode>("between")
  // null = "today", filled in once the browser has rendered.
  const [startInput, setStartInput] = useState<string | null>(null)
  const [end, setEnd] = useState("")
  const [includeEnd, setIncludeEnd] = useState(true)
  const [countRaw, setCountRaw] = useState("10")
  const [countStart, setCountStart] = useState(false)
  const [includeFloating, setIncludeFloating] = useState(false)

  const start = startInput ?? today ?? ""
  const rangeProblem = checkRange(start, end)
  const count = parseCount(countRaw)
  const n = "n" in count ? count.n : null

  // Every year the answer can touch, so its holidays get loaded.
  const years =
    mode === "between"
      ? rangeProblem
        ? []
        : yearsBetween(start, end)
      : n === null || !start
        ? []
        : yearsForAdd(start, n, countStart)
  const holidays = useCompanyHolidays(years)

  const holidayMap = useMemo(
    () => buildHolidayMap(holidays.holidays, { includeFloating }),
    [holidays.holidays, includeFloating],
  )

  const ready = !holidays.isLoading && !holidays.isError
  const between =
    mode === "between" && !rangeProblem && ready
      ? countWorkingDays(start, end, holidayMap, { includeEnd })
      : null
  const added =
    mode === "add" && n !== null && start && ready
      ? addWorkingDays(start, n, holidayMap, { countStart })
      : null

  // The days the answer covered, for the floating-holiday note.
  const span: [string, string] | null = between
    ? [start, includeEnd ? end : shiftYmd(end, -1)]
    : added && n
      ? [countStart ? start : shiftYmd(start, 1), added.end]
      : null
  const floatingWorked =
    span && !includeFloating && span[0] <= span[1]
      ? floatingHolidaysBetween(holidays.holidays, span[0], span[1])
      : []

  // Years the answer reached whose calendar is still empty.
  const reachedYears = span ? yearsBetween(span[0], span[1]) : []
  const emptyYears = holidays.emptyYears.filter((y) => reachedYears.includes(y))

  // Before hydration there's no "today" yet: show the skeleton, not a prompt.
  const hydrating = startInput === null && today === null
  const prompt = hydrating
    ? null
    : mode === "between"
      ? !start
        ? "Pick a start date."
        : rangeProblem
          ? RANGE_MESSAGES[rangeProblem]
          : null
      : !start
        ? "Pick a start date."
        : "error" in count
          ? count.error
          : null

  return (
    <ToolPage slug="working-days">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <Card>
          <CardContent className="space-y-6 p-5">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList aria-label="What do you want to work out?" className="w-full sm:w-auto">
                <TabsTrigger value="between" className="flex-1 sm:flex-none">
                  Between two dates
                </TabsTrigger>
                <TabsTrigger value="add" className="flex-1 sm:flex-none">
                  Add working days
                </TabsTrigger>
              </TabsList>

              <TabsContent value="between" className="mt-5 space-y-5">
                <p className="text-muted-foreground text-sm">
                  How many working days are there from one date to another?
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <DateInput
                    id="wd-between-start"
                    label="Start date"
                    value={start}
                    onChange={setStartInput}
                  />
                  <DateInput
                    id="wd-between-end"
                    label="End date"
                    value={end}
                    onChange={setEnd}
                    notBefore={start}
                  />
                </div>
                <SwitchRow
                  id="wd-include-end"
                  label="Include the end date"
                  help={
                    includeEnd
                      ? "Counted: Monday to Wednesday is 3 days."
                      : "Not counted: Monday to Wednesday is 2 days."
                  }
                  checked={includeEnd}
                  onCheckedChange={setIncludeEnd}
                />
              </TabsContent>

              <TabsContent value="add" className="mt-5 space-y-5">
                <p className="text-muted-foreground text-sm">
                  Find the date that&apos;s a number of working days away - for a deadline or a
                  quote.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <DateInput
                    id="wd-add-start"
                    label="Start date"
                    value={start}
                    onChange={setStartInput}
                  />
                  <div className="space-y-2">
                    <Label required htmlFor="wd-count">
                      Working days to add
                    </Label>
                    <Input
                      id="wd-count"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={MAX_ADD_WORKING_DAYS}
                      step={1}
                      value={countRaw}
                      onChange={(e) => setCountRaw(e.target.value)}
                      aria-invalid={"error" in count}
                      aria-describedby={"error" in count ? "wd-count-error" : undefined}
                    />
                    {"error" in count && (
                      <p id="wd-count-error" className="text-destructive text-xs">
                        {count.error}
                      </p>
                    )}
                  </div>
                </div>
                <SwitchRow
                  id="wd-count-start"
                  label="Count the start date as day 1"
                  help={
                    countStart
                      ? "On: a 5-day job starting Monday ends that Friday."
                      : "Off: 5 working days from Monday is the next Monday."
                  }
                  checked={countStart}
                  onCheckedChange={setCountStart}
                />
              </TabsContent>
            </Tabs>

            <div className="space-y-4 border-t pt-5">
              <SwitchRow
                id="wd-floating"
                label="Also skip floating holidays"
                help="Floating holidays are optional, so most people work on them. Turn this on to treat them as days off too."
                checked={includeFloating}
                onCheckedChange={setIncludeFloating}
              />
              <p className="text-muted-foreground flex items-start gap-2 text-xs leading-relaxed">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Saturdays and Sundays are weekends. Holidays come from the company&apos;s{" "}
                  <Link
                    href="/calendar"
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    holiday calendar
                  </Link>
                  .
                </span>
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardContent className="space-y-4 p-5">
              {prompt ? (
                <div className="text-muted-foreground flex flex-col items-center gap-2 py-8 text-center text-sm">
                  <CalendarCheck className="h-8 w-8" />
                  <p>{prompt}</p>
                </div>
              ) : holidays.isError ? (
                <div role="alert" className="flex flex-col items-center gap-3 py-6 text-center">
                  <AlertTriangle className="text-destructive h-8 w-8" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Couldn&apos;t load the company holidays</p>
                    <p className="text-muted-foreground text-xs">
                      {holidays.error?.message || "Check your connection and try again."}
                    </p>
                  </div>
                  <Button variant="outline" className="gap-1.5" onClick={holidays.retry}>
                    <RotateCw className="h-4 w-4" />
                    Try again
                  </Button>
                </div>
              ) : between || added ? (
                <>
                  <div aria-live="polite" aria-atomic="true">
                    {between ? (
                      <>
                        <p className="text-4xl font-semibold tabular-nums">{between.workingDays}</p>
                        <p className="font-medium">
                          working {between.workingDays === 1 ? "day" : "days"}
                        </p>
                        <p className="text-muted-foreground mt-1 text-sm">
                          {formatYmd(start)} to {formatYmd(end)}
                          {includeEnd ? "" : " (end date not counted)"}
                        </p>
                      </>
                    ) : added ? (
                      <>
                        <p className="text-muted-foreground text-sm">Finishes on</p>
                        <p className="text-2xl font-semibold">{formatYmd(added.end)}</p>
                        <p className="text-muted-foreground mt-1 text-sm">
                          {plural(added.workingDays, "working day")}{" "}
                          {countStart ? "starting" : "after"} {formatYmd(start)}
                        </p>
                      </>
                    ) : null}
                  </div>

                  <Totals summary={(between ?? added)!} />
                  <SkippedList skipped={(between ?? added)!.skipped} />

                  {floatingWorked.length > 0 && (
                    <Note>
                      Counted as working {floatingWorked.length === 1 ? "day" : "days"} (floating
                      holiday{floatingWorked.length === 1 ? "" : "s"}):{" "}
                      {floatingWorked
                        .map((h) => `${h.name} (${formatYmd(h.date, "d MMM")})`)
                        .join(", ")}
                      .
                    </Note>
                  )}
                  {emptyYears.length > 0 && (
                    <Note>
                      No company holidays are set up for {emptyYears.join(" or ")} yet, so only
                      weekends are skipped there.
                    </Note>
                  )}
                  {added && !holidays.loadedYears.includes(Number(added.end.slice(0, 4))) && (
                    <Note>
                      Holidays in {added.end.slice(0, 4)} weren&apos;t checked - treat this date as
                      a rough guide.
                    </Note>
                  )}
                </>
              ) : (
                <div aria-busy="true" aria-label="Loading company holidays" className="space-y-3">
                  <Skeleton className="h-10 w-24" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-56" />
                  <Skeleton className="h-16 w-full" />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ToolPage>
  )
}

/** The DateField has no id of its own, so the label names the group. */
function DateInput({
  id,
  label,
  value,
  onChange,
  notBefore,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  /** "yyyy-MM-dd": days before it can't be picked. */
  notBefore?: string
}) {
  const min = parseDateString(notBefore)
  return (
    <div role="group" aria-labelledby={`${id}-label`} className="space-y-2">
      <Label required id={`${id}-label`}>
        {label}
      </Label>
      <DateField
        value={value}
        onChange={onChange}
        placeholder={`Pick the ${label.toLowerCase()}`}
        disabled={min ? (d) => d < min : undefined}
      />
    </div>
  )
}

function SwitchRow({
  id,
  label,
  help,
  checked,
  onCheckedChange,
}: {
  id: string
  label: string
  help: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start gap-3">
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-describedby={`${id}-help`}
      />
      <div className="space-y-1">
        <Label htmlFor={id} className="mb-0 font-normal">
          {label}
        </Label>
        <p id={`${id}-help`} className="text-muted-foreground text-xs">
          {help}
        </p>
      </div>
    </div>
  )
}

function Totals({ summary }: { summary: DaySummary }) {
  const items = [
    { label: "Calendar days", value: summary.calendarDays },
    { label: "Weekend days", value: summary.weekendDays },
    { label: "Holidays", value: summary.holidayDays },
  ]
  return (
    <dl className="grid grid-cols-3 gap-2">
      {items.map((i) => (
        <div
          key={i.label}
          className="bg-muted/50 flex flex-col-reverse rounded-sm px-2 py-2 text-center"
        >
          <dt className="text-muted-foreground text-[11px] leading-tight">{i.label}</dt>
          <dd className="text-lg font-semibold tabular-nums">{i.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function SkippedList({ skipped }: { skipped: SkippedDay[] }) {
  if (skipped.length === 0) {
    return <p className="text-muted-foreground text-xs">No days skipped - every day counted.</p>
  }
  const holidays = skipped.filter((s) => s.reason === "holiday")
  const weekends = skipped.filter((s) => s.reason === "weekend")
  return (
    <div
      role="region"
      aria-label="Days skipped"
      tabIndex={0}
      className="focus-visible:ring-ring max-h-72 space-y-3 overflow-y-auto rounded-sm border p-3 focus-visible:ring-2 focus-visible:outline-none"
    >
      {holidays.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium">Holidays skipped</p>
          <ul className="space-y-1 text-xs">
            {holidays.map((h) => (
              <li key={h.date} className="flex justify-between gap-3">
                <span className="min-w-0">{h.names.join(" / ")}</span>
                <span className="text-muted-foreground shrink-0 tabular-nums">
                  {formatYmd(h.date)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {weekends.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-xs font-medium">
            Weekend days skipped ({weekends.length})
          </summary>
          <ul className="mt-1.5 space-y-1 text-xs">
            {weekends.map((w) => (
              <li key={w.date} className="flex justify-between gap-3">
                <span className="text-muted-foreground min-w-0">
                  {w.names.length > 0 ? `Also ${w.names.join(" / ")}` : "Weekend"}
                </span>
                <span className="text-muted-foreground shrink-0 tabular-nums">
                  {formatYmd(w.date)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  )
}
