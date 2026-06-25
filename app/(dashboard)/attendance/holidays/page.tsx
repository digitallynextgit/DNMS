"use client"

import { useState } from "react"
import { Plus, Trash2, CalendarDays, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination } from "@/components/shared/pagination"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useHolidays, useCreateHoliday, useDeleteHoliday } from "@/features/attendance"
import { usePermissions } from "@/features/admin"
import { PERMISSIONS } from "@/lib/constants"
import { formatDate, cn } from "@/lib/utils"

const CURRENT_YEAR = new Date().getFullYear()

export default function HolidaysPage() {
  const { can } = usePermissions()
  const canWrite = can(PERMISSIONS.ATTENDANCE_WRITE)

  const [year, setYear] = useState(CURRENT_YEAR)
  const { data, isLoading } = useHolidays(year)
  const holidays = data?.data ?? []

  // Client-side pagination of the per-year holiday list.
  const PAGE_SIZE = 10
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(holidays.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pagedHolidays = holidays.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  // Reset to the first page whenever the year filter changes.
  function changeYear(next: number) {
    setYear(next)
    setPage(1)
  }

  const createHoliday = useCreateHoliday()
  const deleteHoliday = useDeleteHoliday()

  const [addOpen, setAddOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Add form state
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

  type HolidayRow = (typeof holidays)[number]
  const columns: DataTableColumn<HolidayRow>[] = [
    {
      header: "Name",
      className: "font-medium",
      cell: (holiday) => holiday.name,
    },
    {
      header: "Date",
      className: "text-muted-foreground whitespace-nowrap",
      cell: (holiday) => formatDate(holiday.date, "EEE, dd MMM yyyy"),
    },
    {
      header: "Description",
      className: "text-muted-foreground max-w-[300px] truncate",
      cell: (holiday) => holiday.description ?? "-",
    },
    {
      header: "Type",
      cell: (holiday) => (
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
            holiday.isOptional ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700",
          )}
        >
          {holiday.isOptional ? "Optional" : "Mandatory"}
        </span>
      ),
    },
    ...(canWrite
      ? [
          {
            header: "Actions",
            align: "right" as const,
            cell: (holiday: HolidayRow) => (
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive h-8 w-8"
                onClick={() => setDeleteId(holiday.id)}
                title="Delete holiday"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ),
          },
        ]
      : []),
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Public Holidays"
        description="Manage company holidays and optional days off"
        actions={
          canWrite ? (
            <Button onClick={() => setAddOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Holiday
            </Button>
          ) : undefined
        }
      />

      {/* Year selector */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => changeYear(year - 1)}>
          &larr; {year - 1}
        </Button>
        <span className="bg-muted rounded px-3 py-1 text-sm font-medium">{year}</span>
        <Button variant="outline" size="sm" onClick={() => changeYear(year + 1)}>
          {year + 1} &rarr;
        </Button>
      </div>

      {isLoading ? (
        <ListSkeleton rows={6} height="h-14" />
      ) : holidays.length === 0 ? (
        <EmptyState
          variant="card"
          icon={CalendarDays}
          title={`No holidays configured for ${year}.`}
          action={
            canWrite ? { label: "Add First Holiday", onClick: () => setAddOpen(true) } : undefined
          }
        />
      ) : (
        <DataTable columns={columns} rows={pagedHolidays} rowKey={(holiday) => holiday.id} />
      )}

      <Pagination
        page={currentPage}
        totalPages={totalPages}
        total={holidays.length}
        onPageChange={setPage}
        itemLabel="holiday"
      />

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
            <div className="space-y-1.5">
              <Label htmlFor="holiday-name">Holiday Name</Label>
              <Input
                id="holiday-name"
                placeholder="e.g. Republic Day"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="holiday-date">Date</Label>
              <Input
                id="holiday-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
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
              <Label htmlFor="is-optional" className="cursor-pointer font-normal">
                Optional holiday (employee can choose to take it)
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
