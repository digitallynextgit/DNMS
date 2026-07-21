"use client"

import * as React from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { buttonVariants } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export interface TaskStatusPayload {
  status: string
  holdReason?: string
  holdExpectedDate?: string
  discardReason?: string
}

/**
 * Collects the required context when a task moves to On Hold (reason + expected
 * completion date) or Discarded (reason). Shared by the status dropdown and the
 * kanban drag-drop. `mode` opens it; `onConfirm` returns the full status payload.
 */
export function TaskStatusReasonDialog({
  mode,
  onOpenChange,
  onConfirm,
}: {
  mode: "ON_HOLD" | "DISCARDED" | null
  onOpenChange: (open: boolean) => void
  onConfirm: (payload: TaskStatusPayload) => void
}) {
  const [reason, setReason] = React.useState("")
  const [date, setDate] = React.useState("")

  React.useEffect(() => {
    if (mode) {
      setReason("")
      setDate("")
    }
  }, [mode])

  const canConfirm = mode === "ON_HOLD" ? !!reason.trim() && !!date : !!reason.trim()

  function confirm() {
    if (mode === "ON_HOLD") {
      onConfirm({ status: "ON_HOLD", holdReason: reason.trim(), holdExpectedDate: date })
    } else if (mode === "DISCARDED") {
      onConfirm({ status: "DISCARDED", discardReason: reason.trim() })
    }
    onOpenChange(false)
  }

  return (
    <AlertDialog open={!!mode} onOpenChange={(o) => !o && onOpenChange(false)}>
      <AlertDialogContent className="rounded">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-sm font-semibold tracking-tight">
            {mode === "ON_HOLD" ? "Put task on hold" : "Discard task"}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground text-sm">
            {mode === "ON_HOLD"
              ? "This task will be done later. Add why, and the date it's expected to be completed by."
              : "This task won't be done. Add why it's being discarded."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-sm">
              Reason<span className="text-destructive"> *</span>
            </Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder={mode === "ON_HOLD" ? "Why is it on hold?" : "Why is it discarded?"}
            />
          </div>
          {mode === "ON_HOLD" && (
            <div className="space-y-1.5">
              <Label className="text-sm">
                Expected completion date<span className="text-destructive"> *</span>
              </Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel className="text-sm">Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={!canConfirm}
            onClick={(e) => {
              e.preventDefault()
              confirm()
            }}
            className={cn(mode === "DISCARDED" && buttonVariants({ variant: "destructive" }))}
          >
            {mode === "ON_HOLD" ? "Put on hold" : "Discard"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
