"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { CalendarDays, Sparkles, Check, X } from "lucide-react"
import { Spinner } from "@/components/shared/spinner"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/shared/status-badge"
import { StatCard } from "@/components/shared/stat-card"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { Pagination } from "@/components/shared/pagination"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { TabsBar } from "@/components/shared/tabs-bar"
import { useHolidays, FloatingRequestsInbox, HolidayMonthCalendar } from "@/features/attendance"
import { useUrlState, useUrlPage } from "@/hooks/use-url-state"
import {
  FLOATING_REQUEST_STATUS_COLORS,
  FLOATING_REQUEST_STATUS_LABELS,
  HOLIDAY_TYPE_COLORS,
  HOLIDAY_TYPE_LABELS,
} from "@/lib/constants"
import { cn, formatDate } from "@/lib/utils"
import { daysFromToday, relativeDayLabel } from "../lib/relative-day"
import { YearSelect } from "./year-select"

// Employee read-and-apply view (HR uses holidays-admin-view.tsx).

const CURRENT_YEAR = new Date().getFullYear()
const TABS = ["calendar", "table", "floating", "requests"]
const TABLE_PAGE_SIZE = 10

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

export function HolidaysCalendarView() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useUrlState("tab", "calendar")
  const [year, setYear] = useState(CURRENT_YEAR)
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [floatPage, setFloatPage] = useUrlPage()
  const FLOAT_PAGE_SIZE = 8
  // Its own page, not the URL's: the floating list already owns ?page.
  const [tablePage, setTablePage] = useState(1)

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

  const approvedFloatingIds = new Set(
    (fd?.selections ?? []).filter((s) => s.status === "APPROVED").map((s) => s.holidayId),
  )

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

  // Fall back to the grid if this user can't approve, or if `tab` belongs to another calendar in the URL.
  const activeTab =
    !TABS.includes(tab) || (tab === "requests" && fd && !fd.isApprover) ? "calendar" : tab

  function changeYear(next: number) {
    setYear(next)
    setTablePage(1)
  }

  type HolidayRow = (typeof holidays)[number]
  const tableTotalPages = Math.max(1, Math.ceil(holidays.length / TABLE_PAGE_SIZE))
  const tableCurrentPage = Math.min(tablePage, tableTotalPages)
  const holidayColumns: DataTableColumn<HolidayRow>[] = [
    {
      header: "Holiday",
      cell: (h) => (
        <div className="min-w-0">
          <p className="font-medium">{h.name}</p>
          {h.description && (
            <p className="text-muted-foreground max-w-[320px] truncate text-xs">{h.description}</p>
          )}
        </div>
      ),
    },
    {
      header: "Date",
      className: "whitespace-nowrap",
      cell: (h) => formatDate(h.date, "EEE, dd MMM yyyy"),
    },
    {
      header: "Type",
      cell: (h) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge
            status={h.isOptional ? "FLOATING" : "FIXED"}
            colorMap={HOLIDAY_TYPE_COLORS}
            labelMap={HOLIDAY_TYPE_LABELS}
          />
          {approvedFloatingIds.has(h.id) && (
            <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
              <Check className="h-3 w-3" />
              Approved for you
            </span>
          )}
        </div>
      ),
    },
    {
      header: "When",
      align: "right",
      cell: (h) => {
        const days = daysFromToday(h.date)
        return days === 0 ? (
          <span className="inline-flex rounded-sm bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
            Today
          </span>
        ) : (
          <span
            className={cn(
              "text-xs",
              days < 0 ? "text-muted-foreground/60" : "text-muted-foreground",
            )}
          >
            {relativeDayLabel(h.date)}
          </span>
        )
      },
    },
  ]

  return (
    <Tabs value={activeTab} onValueChange={setTab} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TabsBar
          spacing="none"
          items={[
            { value: "calendar", label: "Calendar" },
            { value: "table", label: "Table" },
            { value: "floating", label: "Floating Holidays" },
            fd?.isApprover && { value: "requests", label: "Floating Requests" },
          ]}
        />
        <YearSelect value={year} onChange={changeYear} />
      </div>

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

      <TabsContent value="calendar">
        <HolidayMonthCalendar
          year={year}
          month={calMonth}
          onPrevMonth={prevMonth}
          onNextMonth={nextMonth}
          holidays={holidays}
          approvedFloatingIds={approvedFloatingIds}
        />
      </TabsContent>

      <TabsContent value="table">
        {isLoading || holidays.length > 0 ? (
          <DataTable
            columns={holidayColumns}
            rows={holidays.slice(
              (tableCurrentPage - 1) * TABLE_PAGE_SIZE,
              tableCurrentPage * TABLE_PAGE_SIZE,
            )}
            rowKey={(h) => h.id}
            showSerial
            serialOffset={(tableCurrentPage - 1) * TABLE_PAGE_SIZE}
            loading={isLoading}
            pagination={{
              page: tableCurrentPage,
              totalPages: tableTotalPages,
              total: holidays.length,
              onPageChange: setTablePage,
              itemLabel: "holiday",
            }}
          />
        ) : (
          <EmptyState variant="card" icon={CalendarDays} title={`No holidays for ${year}.`} />
        )}
      </TabsContent>

      <TabsContent value="floating" className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Pick up to {fd?.limit ?? 3} floating holidays. Each request goes to your manager and HR -
          HR gives the final approval.
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
                    // CANCELLED has no pill: it reads the same as never having applied.
                    const known = sel && FLOATING_REQUEST_STATUS_LABELS[sel.status]
                    if (!sel || !known)
                      return <span className="text-muted-foreground text-xs">-</span>
                    return (
                      <div className="space-y-0.5">
                        <StatusBadge
                          status={sel.status}
                          colorMap={FLOATING_REQUEST_STATUS_COLORS}
                          labelMap={FLOATING_REQUEST_STATUS_LABELS}
                        />
                        {sel.status === "REJECTED" && sel.rejectionReason && (
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
                        disabled={pending || !canApply || atLimit}
                        onClick={() => applyMut.mutate(h.id)}
                      >
                        {applyMut.isPending ? (
                          <Spinner size="sm" className="mr-1" />
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
            You&apos;ve used all {fd?.limit} floating holidays for {year}. Withdraw one to choose a
            different holiday.
          </p>
        )}
      </TabsContent>

      {fd?.isApprover && (
        <TabsContent value="requests" className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Your team&apos;s floating-holiday requests. Approve to send to HR for the final call.
          </p>
          <FloatingRequestsInbox />
        </TabsContent>
      )}
    </Tabs>
  )
}
