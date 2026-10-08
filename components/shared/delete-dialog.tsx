"use client"

import { useState } from "react"
import { Spinner } from "@/components/shared/spinner"

import { buttonVariants } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { cn } from "@/lib/utils"

interface DeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  /** `permanent`: true = hard-delete, false = deactivate / soft-delete. */
  onConfirm: (permanent: boolean) => void
  isLoading?: boolean
  /** False hides the "delete permanently" option (deactivate only). Default true. */
  canPermanent?: boolean
  permanentLabel?: string
  deactivateLabel?: string
  permanentButtonLabel?: string
  cancelLabel?: string
}

export function DeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  isLoading = false,
  canPermanent = true,
  permanentLabel = "Delete permanently (this can't be undone)",
  deactivateLabel = "Deactivate",
  permanentButtonLabel = "Delete permanently",
  cancelLabel = "Cancel",
}: DeleteDialogProps) {
  const [permanent, setPermanent] = useState(false)

  // Always start unchecked each time the dialog opens.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setPermanent(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
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

        {canPermanent && (
          <label className="border-border hover:bg-muted/40 flex cursor-pointer items-start gap-2.5 rounded-sm border p-3 text-sm transition-colors">
            <Checkbox
              checked={permanent}
              onCheckedChange={(v) => setPermanent(v === true)}
              disabled={isLoading}
              className="mt-0.5"
            />
            <span className="min-w-0">
              <span className="font-medium">{permanentLabel}</span>
              <span className="text-muted-foreground mt-0.5 block text-xs">
                {permanent
                  ? "The record and its related data will be removed for good."
                  : "Leave unticked to just deactivate - hidden from use but recoverable."}
              </span>
            </span>
          </label>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading} className="text-sm">
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              onConfirm(permanent)
            }}
            disabled={isLoading}
            className={cn(buttonVariants({ variant: "destructive" }))}
          >
            {isLoading && <Spinner size="sm" className="mr-2" />}
            {permanent ? permanentButtonLabel : deactivateLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
