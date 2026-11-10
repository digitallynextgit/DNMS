"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { CalendarX2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { apiFetch } from "@/lib/api-fetch"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import type { FloatingDecision } from "../server/floating-decisions.queries"

type Column = FloatingDecision["status"]

const COLUMNS: { status: Column; label: string; dot: string; text: string }[] = [
  {
    status: "APPROVED",
    label: "Approved",
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  {
    status: "REJECTED",
    label: "Declined",
    dot: "bg-red-500",
    text: "text-red-600 dark:text-red-400",
  },
  {
    status: "PENDING",
    label: "Waiting",
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
  },
]

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })

/** "Today", "In 3 days", "2 weeks ago" - holiday dates are UTC midnights. */
function whenLabel(iso: string, today: number): string {
  const days = Math.round((new Date(iso).getTime() - today) / 86_400_000)
  if (days === 0) return "Today"
  if (days === 1) return "Tomorrow"
  if (days > 1) return days < 14 ? `In ${days} days` : `In ${Math.round(days / 7)} weeks`
  if (days === -1) return "Yesterday"
  return -days < 14 ? `${-days} days ago` : `${Math.round(-days / 7)} weeks ago`
}

function pendingNote(d: FloatingDecision): string {
  if (d.managerDecision === "APPROVED") return "Manager approved, waiting for HR"
  if (d.managerDecision === "REJECTED") return "Manager declined, waiting for HR"
  return "Waiting for the manager"
}

/** HR's year at a glance: each floating holiday, who got it, who didn't, who is still waiting. */
export function FloatingDecisionsBoard({
  year,
  holidays,
}: {
  year: number
  /** The year's floating (optional) holidays. */
  holidays: { id: string; name: string; date: string }[]
}) {
  // Today's local date as a UTC midnight, like the holiday dates; read once, not on every render.
  const [today] = useState(() => {
    const d = new Date()
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  })
  // Under the inbox's key, so approving or declining there refreshes this board too.
  const { data, isLoading } = useQuery({
    queryKey: ["floating-holiday-requests", "decisions", year],
    queryFn: async () =>
      (
        await apiFetch<{ data: FloatingDecision[] }>(
          `/api/attendance/floating-holidays/decisions?year=${year}`,
        )
      ).data,
  })

  const byHoliday = useMemo(() => {
    const map = new Map<string, FloatingDecision[]>()
    for (const d of data ?? []) map.set(d.holidayId, [...(map.get(d.holidayId) ?? []), d])
    return map
  }, [data])

  // Latest holiday first.
  const sorted = [...holidays].sort((a, b) => b.date.localeCompare(a.date))
  const totals = COLUMNS.map((c) => ({
    ...c,
    count: (data ?? []).filter((d) => d.status === c.status).length,
  }))

  if (isLoading) return <ListSkeleton rows={3} height="h-40" />
  if (sorted.length === 0) {
    return (
      <EmptyState
        variant="card"
        icon={CalendarX2}
        title={`No floating holidays set up for ${year}.`}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-card flex flex-wrap items-center gap-x-6 gap-y-2 rounded-sm border px-4 py-3 text-sm">
        <span className="text-muted-foreground">All floating holidays in {year}:</span>
        {totals.map((t) => (
          <span key={t.status} className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", t.dot)} />
            <span className="font-semibold tabular-nums">{t.count}</span>
            <span className="text-muted-foreground">{t.label.toLowerCase()}</span>
          </span>
        ))}
      </div>

      {sorted.map((h) => (
        <HolidayCard key={h.id} holiday={h} decisions={byHoliday.get(h.id) ?? []} today={today} />
      ))}
    </div>
  )
}

function HolidayCard({
  holiday,
  decisions,
  today,
}: {
  holiday: { id: string; name: string; date: string }
  decisions: FloatingDecision[]
  today: number
}) {
  const past = new Date(holiday.date).getTime() < today

  return (
    <div className={cn("bg-card rounded-sm border", past && "opacity-80")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-3">
        <span className="font-semibold">{holiday.name}</span>
        <span className="text-muted-foreground text-sm">{dayLabel(holiday.date)}</span>
        <span className="text-muted-foreground bg-muted rounded-sm px-1.5 py-0.5 text-[11px]">
          {whenLabel(holiday.date, today)}
        </span>
        <span className="ml-auto flex flex-wrap items-center gap-3 text-xs">
          {decisions.length === 0 ? (
            <span className="text-muted-foreground">No one applied</span>
          ) : (
            COLUMNS.map((c) => (
              <span key={c.status} className={cn("font-medium tabular-nums", c.text)}>
                {decisions.filter((d) => d.status === c.status).length} {c.label.toLowerCase()}
              </span>
            ))
          )}
        </span>
      </div>

      {decisions.length > 0 && (
        <div className="grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {COLUMNS.map((c) => {
            const people = decisions.filter((d) => d.status === c.status)
            return (
              <div key={c.status} className="space-y-2 p-4">
                <p
                  className={cn(
                    "flex items-center gap-1.5 text-xs font-semibold uppercase",
                    c.text,
                  )}
                >
                  <span className={cn("h-2 w-2 rounded-full", c.dot)} />
                  {c.label} ({people.length})
                </p>
                {people.length === 0 ? (
                  <p className="text-muted-foreground/60 text-sm">-</p>
                ) : (
                  <ul className="space-y-2">
                    {people.map((d) => (
                      <PersonRow key={d.id} decision={d} />
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PersonRow({ decision: d }: { decision: FloatingDecision }) {
  const sub = d.status === "PENDING" ? pendingNote(d) : `by ${d.decidedBy ?? "Management"}`
  return (
    <li
      className="flex items-start gap-2"
      title={d.reason ? `Their reason: ${d.reason}` : undefined}
    >
      <AvatarDisplay
        src={d.employee.profilePhoto}
        firstName={d.employee.firstName}
        lastName={d.employee.lastName}
        size="xs"
      />
      <span className="min-w-0">
        <span className="block truncate text-sm">
          {d.employee.firstName} {d.employee.lastName}
        </span>
        <span className="text-muted-foreground block text-xs">{sub}</span>
        {d.status === "REJECTED" && d.rejectionReason && d.rejectionReason.trim().length > 2 && (
          <span className="text-muted-foreground block text-xs italic">
            &ldquo;{d.rejectionReason}&rdquo;
          </span>
        )}
      </span>
    </li>
  )
}
