"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

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
  /**
   * Fired on confirm. `permanent` is whether the "delete permanently" box was
   * ticked: true → caller should hard-delete, false → deactivate/soft-delete.
   */
  onConfirm: (permanent: boolean) => void
  isLoading?: boolean
  /** When false, the "delete permanently" option is hidden (deactivate only) -
   *  e.g. the current user isn't allowed to hard-delete. Default true. */
  canPermanent?: boolean
  /** Checkbox caption. */
  permanentLabel?: string
  /** Confirm-button text per mode. */
  deactivateLabel?: string
  permanentButtonLabel?: string
  cancelLabel?: string
}

/**
 * Shared delete confirmation with a "permanent" toggle. Unchecked = deactivate
 * (recoverable); checked = permanent delete. The confirm button's label reflects
 * the current choice. Reusable anywhere a soft/hard delete choice is needed - the
 * parent decides what each mode does via `onConfirm(permanent)`.
 */
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
  useEffect(() => {
    if (open) setPermanent(false)
  }, [open])

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-[var(--radius)]">
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
          <label className="border-border hover:bg-muted/40 flex cursor-pointer items-start gap-2.5 rounded-md border p-3 text-sm transition-colors">
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
            {isLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            {permanent ? permanentButtonLabel : deactivateLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
