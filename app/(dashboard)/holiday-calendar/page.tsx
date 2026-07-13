"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { CalendarDays, Sparkles, ChevronLeft, ChevronRight, Check, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { Pagination } from "@/components/shared/pagination"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useHolidays, FloatingRequestsInbox } from "@/features/attendance"
import { useUrlState, useUrlPage } from "@/hooks/use-url-state"
import { cn, formatDate } from "@/lib/utils"

const CURRENT_YEAR = new Date().getFullYear()
const MONTHS = [
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
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const pad = (n: number) => String(n).padStart(2, "0")

interface FloatingHoliday {
  id: string
  name: string
  date: string
  description: string | null
}
interface FloatingSelection {
  id: string
  holidayId: string
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"
  rejectionReason: string | null
}
interface FloatingData {
  year: number
  limit: number
  remaining: number
  optionalHolidays: FloatingHoliday[]
  selections: FloatingSelection[]
  birthdays: { date: string; name: string }[]
  isApprover: boolean
}

async function fetchFloating(year: number): Promise<{ data: FloatingData }> {
  const res = await fetch(`/api/attendance/floating-holidays?year=${year}`)
  if (!res.ok) throw new Error("Failed to load floating holidays")
  return res.json()
}
async function applyFloating(holidayId: string) {
  const res = await fetch("/api/attendance/floating-holidays", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ holidayId }),
  })
  if (!res.ok)
    throw new Error((await res.json().catch(() => ({})))?.error?.message || "Failed to apply")
  return res.json()
}
async function withdrawFloating(holidayId: string) {
  const res = await fetch(`/api/attendance/floating-holidays?holidayId=${holidayId}`, {
    method: "DELETE",
  })
  if (!res.ok) throw new Error("Failed to withdraw")
  return res.json()
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  PENDING: {
    label: "Pending",
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  },
  APPROVED: {
    label: "Approved",
    cls: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  },
  REJECTED: {
    label: "Rejected",
    cls: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  },
}

export default function EmployeeHolidayCalendarPage() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useUrlState("tab", "calendar")
  const [year, setYear] = useState(CURRENT_YEAR)
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [floatPage, setFloatPage] = useUrlPage()
  const FLOAT_PAGE_SIZE = 8

  const { data: holidaysData, isLoading } = useHolidays(year)
  const holidays = holidaysData?.data ?? []

  const { data: floatingData } = useQuery({
    queryKey: ["floating-holidays", year],
    queryFn: () => fetchFloating(year),
  })
  const fd = floatingData?.data
  const selByHoliday = new Map((fd?.selections ?? []).map((s) => [s.holidayId, s]))

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["floating-holidays"] })
    queryClient.invalidateQueries({ queryKey: ["my-attendance-calendar"] })
  }
  const applyMut = useMutation({
    mutationFn: applyFloating,
    onSuccess: () => {
      invalidate()
      toast.success("Floating holiday requested - sent to your manager and HR")
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const withdrawMut = useMutation({
    mutationFn: withdrawFloating,
    onSuccess: () => {
      invalidate()
      toast.success("Request withdrawn")
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const pending = applyMut.isPending || withdrawMut.isPending

  const years: number[] = []
  for (let y = CURRENT_YEAR - 3; y <= CURRENT_YEAR + 3; y++) years.push(y)
  if (!years.includes(year)) years.push(year)
  years.sort((a, b) => a - b)

  const holidayByDay = new Map(holidays.map((h) => [h.date.slice(0, 10), h]))
  // date -> list of employees whose birthday falls that day (a team view).
  const birthdaysByDay = new Map<string, string[]>()
  for (const b of fd?.birthdays ?? []) {
    const arr = birthdaysByDay.get(b.date)
    if (arr) arr.push(b.name)
    else birthdaysByDay.set(b.date, [b.name])
  }
  const firstDow = new Date(Date.UTC(year, calMonth, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, calMonth + 1, 0)).getUTCDate()

  function prevMonth() {
    if (calMonth === 0) {
      setYear((y) => y - 1)
      setCalMonth(11)
    } else setCalMonth((m) => m - 1)
  }
  function nextMonth() {
    if (calMonth === 11) {
      setYear((y) => y + 1)
      setCalMonth(0)
    } else setCalMonth((m) => m + 1)
  }

  const availed = fd ? fd.limit - fd.remaining : 0
  const atLimit = fd ? fd.remaining <= 0 : false
  const todayYmd = formatDate(new Date(), "yyyy-MM-dd")

  // Don't land on the Requests tab if this user can't approve (e.g. a stale
  // deep-link after losing reports) - fall back to the calendar once loaded.
  const activeTab = tab === "requests" && fd && !fd.isApprover ? "calendar" : tab

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setTab} className="space-y-6">
        <PageHeader
          title="Holiday Calendar"
          description="Company holidays for the year, and your floating-holiday requests."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <TabsList>
                <TabsTrigger value="calendar">Calendar</TabsTrigger>
                <TabsTrigger value="floating">Floating Holidays</TabsTrigger>
                {fd?.isApprover && <TabsTrigger value="requests">Floating Requests</TabsTrigger>}
              </TabsList>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard
            title="Company Holidays"
            value={isLoading ? "-" : holidays.length}
            icon={CalendarDays}
            iconColor="text-blue-600"
            iconBg="bg-blue-50"
          />
          <StatCard
            title="Floating Holidays Availed"
            value={fd ? `${availed} of ${fd.limit}` : "-"}
            icon={Sparkles}
            iconColor="text-amber-600"
            iconBg="bg-amber-50"
          />
        </div>

        {/* ── Calendar ── */}
        <TabsContent value="calendar" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-foreground text-sm font-semibold">
              {MONTHS[calMonth]} {year}
            </h3>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((w) => (
                <div key={w} className="text-muted-foreground py-1 text-center text-xs font-medium">
                  {w}
                </div>
              ))}
              {Array.from({ length: firstDow }).map((_, i) => (
                <div key={`b-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const dateStr = `${year}-${pad(calMonth + 1)}-${pad(day)}`
                const h = holidayByDay.get(dateStr)
                const bdayNames = birthdaysByDay.get(dateStr)
                const isBirthday = !!bdayNames?.length
                const bdayLabel = bdayNames
                  ? bdayNames.length === 1
                    ? `🎂 ${bdayNames[0].split(" ")[0]}`
                    : `🎂 ${bdayNames.length} birthdays`
                  : ""
                const dow = new Date(Date.UTC(year, calMonth, day)).getUTCDay()
                const weekend = dow === 0 || dow === 6
                // A floating holiday this employee applied for and HR approved is
                // a confirmed day off - show it green, distinct from an un-availed
                // floating option (amber).
                const approved =
                  !!h && h.isOptional && selByHoliday.get(h.id)?.status === "APPROVED"
                return (
                  <div
                    key={day}
                    title={
                      isBirthday
                        ? `Birthday: ${bdayNames!.join(", ")}`
                        : h
                          ? `${h.name}${approved ? " - approved floating holiday" : h.isOptional ? " (Floating)" : ""}`
                          : undefined
                    }
                    className={cn(
                      "flex min-h-18 flex-col rounded-md p-1.5",
                      isBirthday
                        ? "bg-rose-100 text-rose-900 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-200"
                        : h
                          ? h.isOptional
                            ? "bg-amber-100 text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200"
                            : "bg-blue-100 text-blue-900 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-200"
                          : weekend
                            ? "bg-muted text-muted-foreground"
                            : "border-border border",
                    )}
                  >
                    <span className="flex items-center gap-1 text-xs font-semibold">
                      {day}
                      {approved && <Check className="h-3 w-3" />}
                    </span>
                    {(isBirthday || h) && (
                      <span className="mt-auto line-clamp-2 text-[10px] leading-tight font-medium">
                        {isBirthday ? bdayLabel : h?.name}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-blue-100 dark:bg-blue-950/40" />
                <span className="text-muted-foreground">Public holiday</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-amber-100 dark:bg-amber-950/40" />
                <span className="text-muted-foreground">Floating holiday</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-rose-100 dark:bg-rose-950/40" />
                <span className="text-muted-foreground">Birthday</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="h-3 w-3" />
                <span className="text-muted-foreground">Approved floating holiday</span>
              </span>
            </div>
          </div>
        </TabsContent>

        {/* ── Floating holidays apply ── */}
        <TabsContent value="floating" className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Pick up to {fd?.limit ?? 3} floating holidays. Each request goes to your manager and HR
            - HR gives the final approval.
          </p>
          {!fd ? (
            <ListSkeleton rows={4} height="h-16" />
          ) : fd.optionalHolidays.length === 0 ? (
            <EmptyState
              variant="card"
              icon={Sparkles}
              title={`No floating holidays are configured for ${year}.`}
            />
          ) : (
            <DataTable
              columns={
                [
                  {
                    header: "Holiday",
                    className: "font-medium",
                    cell: (h: FloatingHoliday) => h.name,
                  },
                  {
                    header: "Date",
                    className: "text-muted-foreground whitespace-nowrap",
                    cell: (h: FloatingHoliday) => formatDate(h.date, "EEE, dd MMM yyyy"),
                  },
                  {
                    header: "Status",
                    className: "max-w-[220px]",
                    cell: (h: FloatingHoliday) => {
                      const sel = selByHoliday.get(h.id)
                      const meta = sel ? STATUS_META[sel.status] : undefined
                      if (!meta) return <span className="text-muted-foreground text-xs">-</span>
                      return (
                        <div className="space-y-0.5">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                              meta.cls,
                            )}
                          >
                            {meta.label}
                          </span>
                          {sel?.status === "REJECTED" && sel.rejectionReason && (
                            <p className="text-muted-foreground text-xs">{sel.rejectionReason}</p>
                          )}
                        </div>
                      )
                    },
                  },
                  {
                    header: "Action",
                    align: "right" as const,
                    cell: (h: FloatingHoliday) => {
                      const sel = selByHoliday.get(h.id)
                      const status = sel?.status
                      const past = h.date.slice(0, 10) < todayYmd
                      const canWithdraw = status === "PENDING" || status === "APPROVED"
                      const canApply = !sel || status === "REJECTED" || status === "CANCELLED"
                      if (canWithdraw) {
                        return (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground"
                            disabled={pending}
                            onClick={() => withdrawMut.mutate(h.id)}
                          >
                            <X className="mr-1 h-3.5 w-3.5" />
                            Withdraw
                          </Button>
                        )
                      }
                      if (past) {
                        return <span className="text-muted-foreground text-xs">Passed</span>
                      }
                      return (
                        <Button
                          size="sm"
                          disabled={pending || !canApply || atLimit}
                          onClick={() => applyMut.mutate(h.id)}
                        >
                          {applyMut.isPending ? (
                            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="mr-1 h-3.5 w-3.5" />
                          )}
                          {status === "REJECTED" ? "Re-apply" : "Apply"}
                        </Button>
                      )
                    },
                  },
                ] as DataTableColumn<FloatingHoliday>[]
              }
              rows={fd.optionalHolidays.slice(
                (floatPage - 1) * FLOAT_PAGE_SIZE,
                floatPage * FLOAT_PAGE_SIZE,
              )}
              rowKey={(h) => h.id}
              showSerial
              serialOffset={(floatPage - 1) * FLOAT_PAGE_SIZE}
              minWidth="min-w-[560px]"
            />
          )}
          {fd && fd.optionalHolidays.length > FLOAT_PAGE_SIZE && (
            <Pagination
              page={floatPage}
              totalPages={Math.ceil(fd.optionalHolidays.length / FLOAT_PAGE_SIZE)}
              total={fd.optionalHolidays.length}
              onPageChange={setFloatPage}
              itemLabel="holiday"
            />
          )}
          {atLimit && (
            <p className="text-muted-foreground text-xs">
              You&apos;ve used all {fd?.limit} floating holidays for {year}. Withdraw one to choose
              a different holiday.
            </p>
          )}
        </TabsContent>

        {/* ── Floating-holiday approval inbox (managers + HR only) ── */}
        {fd?.isApprover && (
          <TabsContent value="requests" className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Your team&apos;s floating-holiday requests. Approve to send to HR for the final call.
            </p>
            <FloatingRequestsInbox />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
