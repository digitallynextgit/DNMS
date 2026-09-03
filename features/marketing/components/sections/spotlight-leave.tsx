"use client"

import { useEffect, useState } from "react"
import { CalendarDays } from "lucide-react"

import { MODULES } from "../../marketing.constants"
import { SpotlightSection } from "../spotlight-section"

const m = MODULES.find((x) => x.name === "Leave & Remote Work")!

interface Holiday {
  day: number
  name: string
  optional: boolean
}
interface CalData {
  year: number
  month: number // 0–11
  holidays: Holiday[]
}

/** Current month + its real company holidays, fetched from the public API.
 *  Client-side so the marketing page stays static and the month is always live;
 *  falls back to a fixed month until it mounts (deterministic → no hydration
 *  mismatch). */
function useMonthCalendar(): CalData | null {
  const [data, setData] = useState<CalData | null>(null)
  useEffect(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    setData({ year, month, holidays: [] }) // show the month immediately
    fetch(`/api/marketing/holidays?year=${year}&month=${month + 1}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j?.success && Array.isArray(j.data)) {
          setData({ year, month, holidays: j.data as Holiday[] })
        }
      })
      .catch(() => {})
  }, [])
  return data
}

/** Bespoke visual: a dynamic month calendar (working days, remote Fridays,
 *  weekends and real company holidays) beside a leave-balance card. */
function LeaveVisual() {
  const data = useMonthCalendar()
  // Deterministic fallback until mounted (Aug 2025) - no hydration mismatch.
  const cal: CalData = data ?? { year: 2025, month: 7, holidays: [] }

  const first = new Date(cal.year, cal.month, 1)
  const firstDay = first.getDay() // 0 = Sunday
  const daysInMonth = new Date(cal.year, cal.month + 1, 0).getDate()
  const monthName = first.toLocaleDateString("en-US", { month: "long" })
  const holidayMap = new Map(cal.holidays.map((h) => [h.day, h]))
  const cells: number[] = [
    ...Array.from({ length: firstDay }, () => 0),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const dayTone = (d: number): string => {
    if (holidayMap.has(d)) return "bg-rose-500/15 text-rose-500 font-medium"
    const wd = new Date(cal.year, cal.month, d).getDay()
    if (wd === 0 || wd === 6) return "text-muted-foreground/40" // weekend
    if (wd === 5) return "bg-blue-500/12 text-blue-500 font-medium" // remote Friday
    return "bg-emerald-500/10 text-emerald-500 font-medium" // working day
  }

  const balances: [string, number, number, string][] = [
    ["Casual", 6, 12, "bg-emerald-500"],
    ["Sick", 4, 8, "bg-amber-500"],
    ["Earned", 11, 18, "bg-blue-500"],
    ["Comp-off", 3, 5, "bg-violet-500"],
    ["WFH / Remote", 8, 12, "bg-teal-500"],
    ["Optional holiday", 1, 2, "bg-rose-500"],
  ]

  return (
    <div className="flex h-full flex-col gap-3 sm:flex-row">
      {/* calendar */}
      <div className="border-border bg-background flex flex-1 flex-col rounded-sm border p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold">{monthName}</span>
          <CalendarDays className="text-muted-foreground h-3.5 w-3.5" />
        </div>
        <div className="text-muted-foreground mb-1 grid grid-cols-7 gap-1 text-center text-[9px] uppercase">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px]">
          {cells.map((d, i) =>
            d === 0 ? (
              <span key={`p-${i}`} />
            ) : (
              <span
                key={d}
                title={holidayMap.get(d)?.name}
                className={`flex aspect-square items-center justify-center rounded-sm ${dayTone(d)}`}
              >
                {d}
              </span>
            ),
          )}
        </div>
        <div className="text-muted-foreground mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-3 text-[9px]">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500/70" /> Working
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-500/70" /> Remote
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-rose-500/70" /> Holiday
          </span>
        </div>
      </div>
      {/* balance */}
      <div className="border-border bg-background flex flex-1 flex-col rounded-sm border p-4">
        <div className="text-muted-foreground mb-3 text-[10px] font-medium uppercase">Balance</div>
        <div className="flex flex-1 flex-col justify-between gap-3">
          {balances.map(([label, used, total, bar]) => (
            <div key={label}>
              <div className="mb-1 flex items-baseline justify-between text-xs">
                <span className="font-medium">{label}</span>
                <span className="text-muted-foreground tabular-nums">
                  {used}
                  <span className="text-muted-foreground/60"> / {total}</span>
                </span>
              </div>
              <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                <div
                  className={`animate-dnms-glow h-full rounded-full ${bar}`}
                  style={{ width: `${Math.round((used / total) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="border-border/60 text-muted-foreground mt-3 border-t pt-3 text-[10px]">
          Accrues monthly · rollover applied
        </div>
      </div>
    </div>
  )
}

export function SpotlightLeave() {
  return (
    <SpotlightSection
      eyebrow={m.name}
      title={m.headline}
      text={m.text}
      points={m.points}
      visual={<LeaveVisual />}
      reverse={true}
      tinted={false}
    />
  )
}
