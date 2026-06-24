"use client"

import { useState } from "react"
import { Plus, Trash2, CalendarDays, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { PageHeader } from "@/components/shared/page-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
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
        <Button variant="outline" size="sm" onClick={() => setYear((y) => y - 1)}>
          &larr; {year - 1}
        </Button>
        <span className="bg-muted rounded px-3 py-1 text-sm font-medium">{year}</span>
        <Button variant="outline" size="sm" onClick={() => setYear((y) => y + 1)}>
          {year + 1} &rarr;
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded" />
          ))}
        </div>
      ) : holidays.length === 0 ? (
        <div className="bg-card flex flex-col items-center justify-center rounded border py-20 text-center">
          <CalendarDays className="text-muted-foreground/40 mb-3 h-10 w-10" />
          <p className="text-muted-foreground text-sm">No holidays configured for {year}.</p>
          {canWrite && (
            <Button className="mt-4 gap-2" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              Add First Holiday
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-card rounded border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b">
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Name</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Date</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">
                  Description
                </th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Type</th>
                {canWrite && (
                  <th className="text-muted-foreground px-4 py-3 text-right font-medium">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {holidays.map((holiday) => (
                <tr key={holiday.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{holiday.name}</td>
                  <td className="text-muted-foreground px-4 py-3 whitespace-nowrap">
                    {formatDate(holiday.date, "EEE, dd MMM yyyy")}
                  </td>
                  <td className="text-muted-foreground max-w-[300px] truncate px-4 py-3">
                    {holiday.description ?? "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                        holiday.isOptional
                          ? "bg-amber-100 text-amber-700"
                          : "bg-blue-100 text-blue-700",
                      )}
                    >
                      {holiday.isOptional ? "Optional" : "Mandatory"}
                    </span>
                  </td>
                  {canWrite && (
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive h-8 w-8"
                        onClick={() => setDeleteId(holiday.id)}
                        title="Delete holiday"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
