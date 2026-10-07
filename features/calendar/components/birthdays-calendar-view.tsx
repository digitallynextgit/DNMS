"use client"

import { useState } from "react"
import { Cake, CalendarHeart } from "lucide-react"
import { StatCard } from "@/components/shared/stat-card"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { EmptyState } from "@/components/shared/empty-state"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { TabsBar } from "@/components/shared/tabs-bar"
import { HolidayMonthCalendar } from "@/features/attendance"
import { BirthdaysCard } from "@/features/noticeboard"
import { useUrlState, useUrlPage } from "@/hooks/use-url-state"
import { cn } from "@/lib/utils"
import { useBirthdayCalendar, type CalendarBirthday } from "../hooks/use-birthday-calendar"
import { daysFromToday, relativeDayLabel, todayKey } from "../lib/relative-day"
import { YearSelect } from "./year-select"

// The Birthday Calendar view: everyone's birthdays (day and month only - no
// ages) as a month grid with the upcoming ones beside it, or as a table of the
// whole year.

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
const TABS = ["calendar", "table"] as const
const PAGE_SIZE = 10
const pad = (n: number) => String(n).padStart(2, "0")

export function BirthdaysCalendarView() {
  const now = new Date()
  const [tab, setTab] = useUrlState("tab", "calendar")
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [page, setPage] = useUrlPage()
  const { data, isLoading } = useBirthdayCalendar(year)
  const birthdays = data ?? []
  const inMonth = birthdays.filter((b) => b.date.startsWith(`${year}-${pad(month + 1)}`)).length

  // `tab` is shared with the other calendars' tabs in the URL - anything that
  // is not one of ours (e.g. "floating" after switching over) means the grid.
  const activeTab = (TABS as readonly string[]).includes(tab) ? tab : "calendar"

  function changeYear(next: number) {
    setYear(next)
    setPage(1)
  }
  function prevMonth() {
    if (month === 0) {
      setYear((y) => y - 1)
      setMonth(11)
    } else setMonth((m) => m - 1)
  }
  function nextMonth() {
    if (month === 11) {
      setYear((y) => y + 1)
      setMonth(0)
    } else setMonth((m) => m + 1)
  }

  const totalPages = Math.max(1, Math.ceil(birthdays.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const today = todayKey()

  const columns: DataTableColumn<CalendarBirthday>[] = [
    {
      header: "Employee",
      cell: (b) => (
        <div className="flex items-center gap-3">
          <AvatarDisplay
            src={b.profilePhoto}
            firstName={b.firstName}
            lastName={b.lastName}
            size="sm"
            className="shrink-0"
          />
          <div className="min-w-0">
            <p className="truncate font-medium">{b.name}</p>
            <p className="text-muted-foreground truncate text-xs">{b.designation ?? "-"}</p>
          </div>
        </div>
      ),
    },
    {
      header: "Birthday",
      className: "whitespace-nowrap",
      cell: (b) =>
        new Date(`${b.date}T00:00:00Z`).toLocaleDateString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
          timeZone: "UTC",
        }),
    },
    {
      header: "Month",
      className: "text-muted-foreground",
      cell: (b) => MONTHS[Number(b.date.slice(5, 7)) - 1],
    },
    {
      header: "When",
      align: "right",
      cell: (b) => {
        if (b.date === today)
          return (
            <span className="inline-flex rounded-sm bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-600 dark:text-rose-400">
              🎂 Today
            </span>
          )
        return (
          <span
            className={cn(
              "text-xs",
              daysFromToday(b.date) < 0 ? "text-muted-foreground/60" : "text-muted-foreground",
            )}
          >
            {relativeDayLabel(b.date)}
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
          ]}
        />
        <YearSelect value={year} onChange={changeYear} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          title={`Birthdays in ${MONTHS[month]}`}
          value={isLoading ? "-" : inMonth}
          icon={Cake}
          iconColor="text-rose-600"
          iconBg="bg-rose-50"
        />
        <StatCard
          title={`Birthdays in ${year}`}
          value={isLoading ? "-" : birthdays.length}
          icon={CalendarHeart}
          iconColor="text-rose-600"
          iconBg="bg-rose-50"
        />
      </div>

      {/* ── Month grid ── */}
      <TabsContent value="calendar">
        <div className="grid items-start gap-4 xl:grid-cols-[1fr_20rem]">
          {/* The month grid already draws birthdays; with no holidays passed it
              is a birthday calendar - same grid, same day detail, no second one. */}
          <HolidayMonthCalendar
            year={year}
            month={month}
            onPrevMonth={prevMonth}
            onNextMonth={nextMonth}
            holidays={[]}
            birthdays={birthdays.map((b) => ({ date: b.date, name: b.name }))}
          />
          <BirthdaysCard days={30} />
        </div>
      </TabsContent>

      {/* ── The whole year as a table, in date order ── */}
      <TabsContent value="table">
        {isLoading || birthdays.length > 0 ? (
          <DataTable
            columns={columns}
            rows={birthdays.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)}
            rowKey={(b) => b.id}
            showSerial
            serialOffset={(currentPage - 1) * PAGE_SIZE}
            loading={isLoading}
            pagination={{
              page: currentPage,
              totalPages,
              total: birthdays.length,
              onPageChange: setPage,
              itemLabel: "birthday",
            }}
          />
        ) : (
          <EmptyState variant="card" icon={Cake} title="No birthdays on file yet." />
        )}
      </TabsContent>
    </Tabs>
  )
}
