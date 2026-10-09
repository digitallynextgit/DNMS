"use client"

import { useState } from "react"
import { Plus, Pencil, Trash2, CalendarDays, CalendarCheck, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { StatusBadge } from "@/components/shared/status-badge"
import { StatCard } from "@/components/shared/stat-card"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { FormDialog } from "@/components/shared/form-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { DateField } from "@/components/shared/date-field"
import { useRowSelection } from "@/hooks/use-row-selection"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { TabsBar } from "@/components/shared/tabs-bar"
import { Textarea } from "@/components/ui/textarea"
import {
  useHolidays,
  useCreateHoliday,
  useUpdateHoliday,
  useDeleteHoliday,
  FloatingRequestsInbox,
  HolidayMonthCalendar,
} from "@/features/attendance"
import { usePermissions } from "@/features/admin/hooks/use-permissions"
import { useUrlState } from "@/hooks/use-url-state"
import { HOLIDAY_TYPE_COLORS, HOLIDAY_TYPE_LABELS, PERMISSIONS } from "@/lib/constants"
import { formatDate } from "@/lib/utils"
import { YearSelect } from "./year-select"

// HR view; employees get the read-and-apply version, holidays-calendar-view.tsx.

const CURRENT_YEAR = new Date().getFullYear()

export function HolidaysAdminView() {
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

  const selection = useRowSelection(holidays.map((h) => h.id))
  const [bulkOpen, setBulkOpen] = useState(false)

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
  const updateHoliday = useUpdateHoliday()
  const deleteHoliday = useDeleteHoliday()

  // One dialog for add and edit; `editing` is the row being changed, or null for a new holiday.
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<HolidayRow | null>(null)
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

  function openAdd() {
    setEditing(null)
    resetForm()
    setFormOpen(true)
  }

  function openEdit(h: HolidayRow) {
    setEditing(h)
    setName(h.name)
    // The API returns an ISO datetime at UTC midnight; DateField wants "yyyy-MM-dd".
    setDate(h.date.slice(0, 10))
    setDescription(h.description ?? "")
    setIsOptional(h.isOptional)
    setFormOpen(true)
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault()
    const body = { name, date, description: description || null, isOptional }
    try {
      if (editing) await updateHoliday.mutateAsync({ id: editing.id, body })
      else await createHoliday.mutateAsync(body)
      setFormOpen(false)
      setEditing(null)
      resetForm()
    } catch {
      // the mutation hook already toasts the error; just keep the form open
    }
  }

  async function handleConfirmDelete() {
    if (!deleteId) return
    try {
      await deleteHoliday.mutateAsync(deleteId)
      setDeleteId(null)
    } catch {
      // already toasted by the mutation hook
    }
  }

  async function handleBulkDelete() {
    try {
      for (const id of selection.selectedIds) {
        await deleteHoliday.mutateAsync(id)
      }
      selection.clear()
      setBulkOpen(false)
    } catch {
      // already toasted by the mutation hook
    }
  }

  const columns: DataTableColumn<HolidayRow>[] = [
    { header: "Name", className: "font-medium", sortValue: (h) => h.name, cell: (h) => h.name },
    {
      header: "Date",
      className: "text-muted-foreground",
      sortValue: (h) => h.date,
      exportValue: (h) => h.date.slice(0, 10),
      cell: (h) => formatDate(h.date, "EEE, dd MMM yyyy"),
    },
    {
      header: "Description",
      className: "text-muted-foreground max-w-[280px] truncate",
      exportValue: (h) => h.description,
      cell: (h) => <span title={h.description ?? undefined}>{h.description ?? "-"}</span>,
    },
    {
      header: "Type",
      sortValue: (h) => HOLIDAY_TYPE_LABELS[h.isOptional ? "FLOATING" : "FIXED"],
      cell: (h) => (
        <StatusBadge
          status={h.isOptional ? "FLOATING" : "FIXED"}
          colorMap={HOLIDAY_TYPE_COLORS}
          labelMap={HOLIDAY_TYPE_LABELS}
        />
      ),
    },
    ...(canWrite
      ? [
          {
            header: "Actions",
            align: "right" as const,
            cell: (h: HolidayRow) => (
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openEdit(h)}
                  title="Edit holiday"
                >
                  <Pencil className="h-4 w-4" />
                  <span className="sr-only">Edit</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteId(h.id)}
                  title="Delete holiday"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Delete</span>
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ]

  return (
    <>
      <Tabs value={view} onValueChange={setView} className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsBar
            spacing="none"
            items={[
              { value: "table", label: "Table" },
              { value: "calendar", label: "Calendar" },
              canWrite && { value: "requests", label: "Floating Requests" },
            ]}
          />
          <div className="flex flex-wrap items-center gap-2">
            <YearSelect value={year} onChange={setYear} />
            {canWrite && (
              <Button className="gap-2" onClick={openAdd}>
                <Plus className="h-4 w-4" />
                Add Holiday
              </Button>
            )}
          </div>
        </div>

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

        <TabsContent value="table">
          {isLoading ? (
            <ListSkeleton rows={6} height="h-14" />
          ) : holidays.length === 0 ? (
            <EmptyState
              variant="card"
              icon={CalendarDays}
              title={`No holidays configured for ${year}.`}
              action={canWrite ? { label: "Add First Holiday", onClick: openAdd } : undefined}
            />
          ) : (
            <DataTable
              tableId="holidays"
              exportName={`holidays-${year}`}
              itemLabel="holiday"
              columns={columns}
              rows={holidays}
              rowKey={(h) => h.id}
              showSerial
              pageKey={String(year)}
              selection={canWrite ? selection : undefined}
              // Read-only viewers still tick rows to export them; they get no Delete.
              selectionActions={
                canWrite ? (
                  <Button
                    variant="destructive"
                    onClick={() => setBulkOpen(true)}
                    disabled={deleteHoliday.isPending}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Delete
                  </Button>
                ) : undefined
              }
            />
          )}
        </TabsContent>

        <TabsContent value="calendar">
          <HolidayMonthCalendar
            year={year}
            month={calMonth}
            onPrevMonth={prevMonth}
            onNextMonth={nextMonth}
            holidays={holidays}
          />
        </TabsContent>

        {canWrite && (
          <TabsContent value="requests">
            <FloatingRequestsInbox />
          </TabsContent>
        )}
      </Tabs>

      <FormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) {
            setEditing(null)
            resetForm()
          }
        }}
        title={editing ? "Edit Holiday" : "Add Holiday"}
        isPending={createHoliday.isPending || updateHoliday.isPending}
        submitDisabled={!name || !date}
        submitLabel={editing ? "Save Changes" : "Add Holiday"}
        size="sm"
        onSubmit={handleFormSubmit}
      >
        <div className="space-y-2">
          <Label required htmlFor="holiday-name">
            Holiday Name
          </Label>
          <Input
            id="holiday-name"
            placeholder="e.g. Republic Day"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label required>Date</Label>
          {/* Bounded to the year in view, or the holiday's own year when editing. */}
          <DateField
            value={date}
            onChange={setDate}
            modal
            startMonth={new Date(editing ? Number(editing.date.slice(0, 4)) : year, 0)}
            endMonth={new Date(editing ? Number(editing.date.slice(0, 4)) : year, 11, 31)}
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
            Floating holiday (employees avail any 3; otherwise it&apos;s a fixed company holiday)
          </Label>
        </div>
      </FormDialog>

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
    </>
  )
}
