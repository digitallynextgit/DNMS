"use client"

import { useEffect, useRef, useState } from "react"
import { Fingerprint } from "lucide-react"

import { MODULES } from "../../marketing.constants"
import { cn } from "@/lib/utils"
import { SpotlightSection } from "../spotlight-section"

const m = MODULES.find((x) => x.name === "Attendance & Time")!

interface Row {
  name: string
  time: string
  status: string
}
interface Snapshot {
  day: string
  date: string
  rows: Row[]
}

// Fallback shown before the fetch resolves or if it returns nothing, so the
// panel never looks empty.
const DEMO_ROWS: Row[] = [
  { name: "Aarav Sharma", time: "09:02", status: "Present" },
  { name: "Diya Patel", time: "09:11", status: "Present" },
  { name: "Rahul Kapoor", time: "08:57", status: "Present" },
  { name: "Neha Gupta", time: "09:05", status: "Present" },
  { name: "Sana Iqbal", time: "09:18", status: "Present" },
  { name: "Vikram Rao", time: "09:26", status: "Late" },
  { name: "Priya Nair", time: "09:03", status: "Present" },
  { name: "Kabir Mehta", time: "13:20", status: "Half-day" },
  { name: "Meera Reddy", time: "-", status: "Absent" },
]

const TONE: Record<string, string> = {
  Present: "text-emerald-500 bg-emerald-500/10",
  Late: "text-amber-500 bg-amber-500/10",
  "Half-day": "text-amber-500 bg-amber-500/10",
  "On leave": "text-blue-500 bg-blue-500/10",
  Absent: "text-red-500 bg-red-500/10",
  Holiday: "text-muted-foreground bg-muted",
  Weekend: "text-muted-foreground bg-muted",
}

/** Pulls the live attendance snapshot (latest working day) from the public API.
 *  Client-side so the marketing page stays static; keeps the demo rows until it
 *  resolves and if it returns nothing. Fires only once the section is NEAR the
 *  viewport - this sits ~8 viewports down the homepage, and fetching at mount
 *  competed with the hero's first paint for nothing anyone could see. */
function useAttendanceSnapshot(ref: React.RefObject<HTMLElement | null>) {
  const [snap, setSnap] = useState<Snapshot | null>(null)
  useEffect(() => {
    const el = ref.current
    let alive = true
    const load = () => {
      fetch("/api/marketing/attendance-snapshot", { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => {
          if (alive && j?.success && j.data?.rows?.length) setSnap(j.data as Snapshot)
        })
        .catch(() => {})
    }
    if (!el || typeof IntersectionObserver === "undefined") {
      load()
      return () => {
        alive = false
      }
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect()
          load()
        }
      },
      // A viewport of lead time, so the demo rows are usually swapped before
      // the reader arrives at the section.
      { rootMargin: "100% 0px" },
    )
    io.observe(el)
    return () => {
      alive = false
      io.disconnect()
    }
  }, [ref])
  return snap
}

/** Bespoke visual: a biometric terminal with a sweeping scan line, feeding a
 *  live punch → status list. Both panels stretch to full height so the card
 *  never shows empty background. */
function AttendanceVisual() {
  const rootRef = useRef<HTMLDivElement>(null)
  const snap = useAttendanceSnapshot(rootRef)
  const rows = snap?.rows ?? DEMO_ROWS
  return (
    <div ref={rootRef} className="flex h-full flex-col gap-3 sm:flex-row">
      {/* scanner */}
      <div className="border-border bg-background relative flex flex-1 flex-col items-center justify-center overflow-hidden rounded-sm border p-6">
        <div className="text-primary relative">
          <span className="border-primary/40 animate-dnms-pulse-ring absolute inset-0 rounded-full border" />
          <span className="bg-primary/10 flex h-20 w-20 items-center justify-center rounded-full">
            <Fingerprint className="h-9 w-9" />
          </span>
        </div>
        {/* Full-height track - see bento-overview.tsx for the pattern. */}
        <div className="animate-dnms-scan pointer-events-none absolute top-0 right-6 left-6 h-full">
          <div className="via-primary h-px bg-gradient-to-r from-transparent to-transparent" />
        </div>
        <div className="text-muted-foreground mt-4 text-xs">Scanning · ISAPI</div>
      </div>
      {/* live rows */}
      <div className="border-border bg-background flex flex-1 flex-col rounded-sm border p-3">
        <div className="text-muted-foreground mb-1 flex items-center justify-between gap-2 text-[10px] font-medium uppercase">
          <span className="flex items-center gap-1.5">
            <span>{snap ? snap.day : "Today"}</span>
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            <span>Live</span>
          </span>
          {snap && <span className="tabular-nums">{snap.date}</span>}
        </div>
        <div className="flex flex-1 flex-col">
          {rows.map(({ name, time, status }, i) => (
            <div
              key={name}
              className={cn(
                "grid flex-1 grid-cols-[minmax(0,1fr)_3.5rem_5rem] items-center gap-2 text-xs",
                i > 0 && "border-border/50 border-t",
              )}
            >
              <span className="truncate">{name}</span>
              <span className="text-muted-foreground text-right tabular-nums">{time}</span>
              <span
                className={cn(
                  "justify-self-end rounded-sm px-1.5 py-0.5 text-[10px] font-medium",
                  TONE[status] ?? "text-muted-foreground bg-muted",
                )}
              >
                {status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function SpotlightAttendance() {
  return (
    <SpotlightSection
      eyebrow={m.name}
      title={m.headline}
      text={m.text}
      points={m.points}
      visual={<AttendanceVisual />}
      tinted
    />
  )
}
