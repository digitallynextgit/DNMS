"use client"

import { useState } from "react"
import {
  Plus,
  Trash2,
  CalendarDays,
  CalendarCheck,
  Sparkles,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { Pagination } from "@/components/shared/pagination"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { DateField } from "@/components/shared/date-field"
import { BulkActionBar } from "@/components/shared/bulk-action-bar"
import { useRowSelection } from "@/hooks/use-row-selection"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import {
  useHolidays,
  useCreateHoliday,
  useDeleteHoliday,
  FloatingRequestsInbox,
} from "@/features/attendance"
import { usePermissions } from "@/features/admin"
import { useUrlState, useUrlPage } from "@/hooks/use-url-state"
import { PERMISSIONS } from "@/lib/constants"
import { formatDate, cn } from "@/lib/utils"

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

export default function HolidayCalendarPage() {
  const { can } = usePermissions()
  const canWrite = can(PERMISSIONS.ATTENDANCE_WRITE)

  const [year, setYear] = useState(CURRENT_YEAR)
  const { data, isLoading } = useHolidays(year)
  const holidays = data?.data ?? []
  type HolidayRow = (typeof holidays)[number]

  const [view, setView] = useUrlState("tab", "table")
  const [calMonth, setCalMonth] = useState(new Date().getMonth())

  const publicCount = holidays.filter((h) => !h.isOptional).length
  const floatingCount = holidays.filter((h) => h.isOptional).length

  // Year options for the dropdown (a few years either side, always incl. current).
  const years: number[] = []
  for (let y = CURRENT_YEAR - 3; y <= CURRENT_YEAR + 3; y++) years.push(y)
  if (!years.includes(year)) years.push(year)
  years.sort((a, b) => a - b)

  // Holidays keyed by "YYYY-MM-DD" for the calendar view.
  const holidayByDay = new Map<string, HolidayRow>()
  for (const h of holidays) holidayByDay.set(h.date.slice(0, 10), h)

  // Client-side pagination of the per-year holiday list (table view).
  const PAGE_SIZE = 10
  const [page, setPage] = useUrlPage()
  const totalPages = Math.max(1, Math.ceil(holidays.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pagedHolidays = holidays.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const selection = useRowSelection(pagedHolidays.map((h) => h.id))
  const [bulkOpen, setBulkOpen] = useState(false)

  function changeYear(next: number) {
    setYear(next)
    setPage(1)
  }
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

  const createHoliday = useCreateHoliday()
  const deleteHoliday = useDeleteHoliday()

  const [addOpen, setAddOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [date, setDate] = useState("")
  const [description, setDescription] = useState("")
  const [isOptional, setIsOptional] = useState(false)

  function resetForm() {
    setName("")
    setDate("")
    setDescription("")
    setIsOptional(false)
  }

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault()
    await createHoliday.mutateAsync({ name, date, description: description || null, isOptional })
    setAddOpen(false)
    resetForm()
  }

  async function handleConfirmDelete() {
    if (!deleteId) return
    await deleteHoliday.mutateAsync(deleteId)
    setDeleteId(null)
  }

  async function handleBulkDelete() {
    for (const id of selection.selectedIds) {
      await deleteHoliday.mutateAsync(id)
    }
    selection.clear()
    setBulkOpen(false)
  }

  const columns: DataTableColumn<HolidayRow>[] = [
    { header: "Name", className: "font-medium", cell: (h) => h.name },
    {
      header: "Date",
      className: "text-muted-foreground whitespace-nowrap",
      cell: (h) => formatDate(h.date, "EEE, dd MMM yyyy"),
    },
    {
      header: "Description",
      className: "text-muted-foreground max-w-[300px] truncate",
      cell: (h) => h.description ?? "-",
    },
    {
      header: "Type",
      cell: (h) => (
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
            h.isOptional ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700",
          )}
        >
          {h.isOptional ? "Floating" : "Fixed"}
        </span>
      ),
    },
    ...(canWrite
      ? [
          {
            header: "Actions",
            align: "right" as const,
            cell: (h: HolidayRow) => (
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive h-8 w-8"
                onClick={() => setDeleteId(h.id)}
                title="Delete holiday"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ),
          },
        ]
      : []),
  ]

  // ── Calendar grid for the selected month ──────────────────────────────────
  const firstDow = new Date(Date.UTC(year, calMonth, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, calMonth + 1, 0)).getUTCDate()

  return (
    <div className="space-y-6">
      <Tabs value={view} onValueChange={setView} className="space-y-6">
        {/* Title + filters (view toggle, year, add) on one row. */}
        <PageHeader
          title="Holiday Calendar"
          description="Company holidays and optional days off - list and month view."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <TabsList>
                <TabsTrigger value="table">Table</TabsTrigger>
                <TabsTrigger value="calendar">Calendar</TabsTrigger>
                {canWrite && <TabsTrigger value="requests">Floating Requests</TabsTrigger>}
              </TabsList>
              <Select value={String(year)} onValueChange={(v) => changeYear(Number(v))}>
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
              {canWrite && (
                <Button onClick={() => setAddOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Holiday
                </Button>
              )}
            </div>
          }
        />

        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            title="Total Holidays"
            value={isLoading ? "-" : holidays.length}
            icon={CalendarDays}
            iconColor="text-violet-600"
            iconBg="bg-violet-50"
          />
          <StatCard
            title="Fixed Holidays"
            value={isLoading ? "-" : publicCount}
            icon={CalendarCheck}
            iconColor="text-blue-600"
            iconBg="bg-blue-50"
          />
          <StatCard
            title="Floating Holidays"
            value={isLoading ? "-" : floatingCount}
            icon={Sparkles}
            iconColor="text-amber-600"
            iconBg="bg-amber-50"
          />
        </div>

        {/* ── Table view ── */}
        <TabsContent value="table" className="space-y-4">
          {canWrite && (
            <BulkActionBar count={selection.count} onClear={selection.clear}>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setBulkOpen(true)}
                disabled={deleteHoliday.isPending}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete
              </Button>
            </BulkActionBar>
          )}

          {isLoading ? (
            <ListSkeleton rows={6} height="h-14" />
          ) : holidays.length === 0 ? (
            <EmptyState
              variant="card"
              icon={CalendarDays}
              title={`No holidays configured for ${year}.`}
              action={
                canWrite
                  ? { label: "Add First Holiday", onClick: () => setAddOpen(true) }
                  : undefined
              }
            />
          ) : (
            <>
              <DataTable
                columns={columns}
                rows={pagedHolidays}
                rowKey={(h) => h.id}
                showSerial
                serialOffset={(currentPage - 1) * PAGE_SIZE}
                selection={canWrite ? selection : undefined}
              />
              <Pagination
                page={currentPage}
                totalPages={totalPages}
                total={holidays.length}
                onPageChange={setPage}
                itemLabel="holiday"
              />
            </>
          )}
        </TabsContent>

        {/* ── Calendar view ── */}
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

          <div className="bg-card rounded border p-4">
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((w) => (
                <div key={w} className="text-muted-foreground py-1 text-center text-xs font-medium">
                  {w}
                </div>
              ))}
              {Array.from({ length: firstDow }).map((_, i) => (
                <div key={`blank-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const key = `${year}-${pad(calMonth + 1)}-${pad(day)}`
                const h = holidayByDay.get(key)
                const dow = new Date(Date.UTC(year, calMonth, day)).getUTCDay()
                const weekend = dow === 0 || dow === 6
                return (
                  <div
                    key={day}
                    title={h ? `${h.name}${h.isOptional ? " (Floating)" : ""}` : undefined}
                    className={cn(
                      "flex min-h-[76px] flex-col rounded p-1.5 text-left",
                      h
                        ? h.isOptional
                          ? "bg-amber-100 text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200"
                          : "bg-blue-100 text-blue-900 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-200"
                        : weekend
                          ? "bg-muted text-muted-foreground"
                          : "border-border border",
                    )}
                  >
                    <span className="text-xs font-semibold">{day}</span>
                    {h && (
                      <span className="mt-auto line-clamp-2 text-[10px] leading-tight font-medium">
                        {h.name}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-blue-100 dark:bg-blue-950/40" />
                <span className="text-muted-foreground">Public holiday</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-amber-100 dark:bg-amber-950/40" />
                <span className="text-muted-foreground">Floating holiday</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="bg-muted h-3 w-3 rounded" />
                <span className="text-muted-foreground">Weekend</span>
              </span>
            </div>
          </div>
        </TabsContent>

        {/* ── Floating-holiday approval inbox (shared with the Leave section) ── */}
        {canWrite && (
          <TabsContent value="requests">
            <FloatingRequestsInbox />
          </TabsContent>
        )}
      </Tabs>

      {/* Add Holiday Dialog */}
      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Add Holiday</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddSubmit} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="holiday-name">Holiday Name</Label>
              <Input
                id="holiday-name"
                placeholder="e.g. Republic Day"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Date</Label>
              <DateField
                value={date}
                onChange={setDate}
                modal
                startMonth={new Date(year, 0)}
                endMonth={new Date(year, 11, 31)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="holiday-desc">Description (optional)</Label>
              <Textarea
                id="holiday-desc"
                placeholder="Short description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="is-optional"
                checked={isOptional}
                onCheckedChange={(v) => setIsOptional(!!v)}
              />
              <Label htmlFor="is-optional" className="mb-0 cursor-pointer font-normal">
                Floating holiday (employees avail any 3; otherwise it&apos;s a fixed company
                holiday)
              </Label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAddOpen(false)
                  resetForm()
                }}
                disabled={createHoliday.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createHoliday.isPending || !name || !date}>
                {createHoliday.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Holiday
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk delete confirmation */}
      <ConfirmDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        title={`Delete ${selection.count} holiday${selection.count === 1 ? "" : "s"}?`}
        description="The selected holidays will be permanently deleted. This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleBulkDelete}
        isLoading={deleteHoliday.isPending}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Holiday"
        description="This will permanently delete this holiday. This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleConfirmDelete}
        isLoading={deleteHoliday.isPending}
      />
    </div>
  )
}
