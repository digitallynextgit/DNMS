"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FormDialog } from "@/components/shared/form-dialog"
import { ATTENDANCE_STATUS_LABELS } from "@/lib/constants"
import {
  useCreateAttendanceLog,
  useUpdateAttendanceLog,
} from "@/features/attendance/hooks/use-attendance"
import type { AttendanceLog } from "@/features/attendance/hooks/use-attendance"
import { EmployeeCombobox } from "@/features/employees"
import { format } from "date-fns"

interface ManualAttendanceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editLog?: AttendanceLog | null
}

function calcWorkHoursPreview(checkIn: string, checkOut: string): string {
  if (!checkIn || !checkOut) return ""
  const [inH, inM] = checkIn.split(":").map(Number)
  const [outH, outM] = checkOut.split(":").map(Number)
  const totalInMins = inH * 60 + inM
  const totalOutMins = outH * 60 + outM
  const diffMins = totalOutMins - totalInMins
  if (diffMins <= 0) return ""
  const hours = Math.floor(diffMins / 60)
  const mins = diffMins % 60
  return `${hours}h ${mins > 0 ? `${mins}m` : ""}`.trim()
}

// Build a full ISO datetime string for today's date combined with HH:mm time string
function buildDatetime(date: string, time: string): string {
  return `${date}T${time}:00.000Z`
}

export function ManualAttendanceDialog({
  open,
  onOpenChange,
  editLog,
}: ManualAttendanceDialogProps) {
  const isEdit = !!editLog

  const [employeeId, setEmployeeId] = useState("")
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [checkIn, setCheckIn] = useState("")
  const [checkOut, setCheckOut] = useState("")
  const [status, setStatus] = useState("PRESENT")
  const [notes, setNotes] = useState("")

  const createLog = useCreateAttendanceLog()
  const updateLog = useUpdateAttendanceLog()
  const isPending = createLog.isPending || updateLog.isPending

  // Populate form when editing
  useEffect(() => {
    if (editLog) {
      setEmployeeId(editLog.employeeId)
      setDate(format(new Date(editLog.date), "yyyy-MM-dd"))
      setCheckIn(editLog.checkIn ? new Date(editLog.checkIn).toISOString().slice(11, 16) : "")
      setCheckOut(editLog.checkOut ? new Date(editLog.checkOut).toISOString().slice(11, 16) : "")
      setStatus(editLog.status)
      setNotes(editLog.notes ?? "")
    } else {
      setEmployeeId("")
      setDate(format(new Date(), "yyyy-MM-dd"))
      setCheckIn("")
      setCheckOut("")
      setStatus("PRESENT")
      setNotes("")
    }
  }, [editLog, open])

  const workHoursPreview = calcWorkHoursPreview(checkIn, checkOut)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const payload: Record<string, unknown> = {
      employeeId,
      date,
      status,
      notes: notes || null,
      checkIn: checkIn ? buildDatetime(date, checkIn) : null,
      checkOut: checkOut ? buildDatetime(date, checkOut) : null,
    }

    if (isEdit && editLog) {
      await updateLog.mutateAsync({ id: editLog.id, body: payload })
    } else {
      await createLog.mutateAsync(payload)
    }

    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit Attendance Record" : "Add Manual Attendance"}
      isEdit={isEdit}
      isPending={isPending}
      submitDisabled={(!isEdit && !employeeId) || !date}
      submitLabel={isEdit ? "Save Changes" : "Add Record"}
      onSubmit={handleSubmit}
      contentClassName="sm:max-w-[500px]"
    >
      {/* Employee select */}
      {!isEdit && (
        <div className="space-y-1.5">
          <Label htmlFor="employee">Employee</Label>
          <EmployeeCombobox
            value={employeeId || undefined}
            onChange={(id) => setEmployeeId(id ?? "")}
            placeholder="Select employee..."
            modal
          />
        </div>
      )}

      {/* Date */}
      <div className="space-y-1.5">
        <Label htmlFor="date">Date</Label>
        <Input
          id="date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          disabled={isEdit}
        />
      </div>

      {/* Check in / check out */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="check-in">Check In</Label>
          <Input
            id="check-in"
            type="time"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="check-out">Check Out</Label>
          <Input
            id="check-out"
            type="time"
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
          />
        </div>
      </div>

      {/* Work hours preview */}
      {workHoursPreview && (
        <p className="text-muted-foreground text-sm">
          Work hours: <span className="text-foreground font-medium">{workHoursPreview}</span>
        </p>
      )}

      {/* Status */}
      <div className="space-y-1.5">
        <Label htmlFor="status">Status</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger id="status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ATTENDANCE_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          placeholder="Optional notes..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </div>
    </FormDialog>
  )
}
