"use client"

import * as React from "react"
import { Spinner } from "@/components/shared/spinner"

import { buttonVariants } from "@/components/ui/button"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

interface RejectReasonDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  reasonLabel?: string
  reasonPlaceholder?: string
  /** Require a non-empty reason before the confirm button enables. Default true. */
  required?: boolean
  confirmLabel?: string
  cancelLabel?: string
  variant?: "default" | "destructive"
  isLoading?: boolean
  onConfirm: (reason: string) => void
}

/**
 * Confirmation dialog with a reason/note textarea (reject leave, decline
 * resignation, etc.). When `required`, the confirm button stays disabled until
 * a non-empty reason is entered. Resets the reason whenever it (re)opens.
 */
export function RejectReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  reasonLabel = "Reason",
  reasonPlaceholder = "Add a reason…",
  required = true,
  confirmLabel = "Reject",
  cancelLabel = "Cancel",
  variant = "destructive",
  isLoading = false,
  onConfirm,
}: RejectReasonDialogProps) {
  const [reason, setReason] = React.useState("")

  React.useEffect(() => {
    if (open) setReason("")
  }, [open])

  const disabled = isLoading || (required && reason.trim().length === 0)

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-sm font-semibold tracking-tight">
            {title}
          </AlertDialogTitle>
          {description && (
            <AlertDialogDescription className="text-muted-foreground text-sm">
              {description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reject-reason" className="text-sm">
            {reasonLabel}
            {required && <span className="text-destructive"> *</span>}
          </Label>
          <Textarea
            id="reject-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={reasonPlaceholder}
            rows={3}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading} className="text-sm">
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              onConfirm(reason.trim())
            }}
            disabled={disabled}
            className={cn(variant === "destructive" && buttonVariants({ variant: "destructive" }))}
          >
            {isLoading && <Spinner size="sm" className="mr-2" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
