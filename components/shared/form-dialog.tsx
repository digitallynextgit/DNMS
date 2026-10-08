"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface FormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  /** Drives the default submit label. */
  isEdit?: boolean
  /** Disables the footer and shows a spinner. */
  isPending?: boolean
  submitDisabled?: boolean
  /** Default: isEdit ? "Save Changes" : "Create". */
  submitLabel?: string
  /** "destructive" for irreversible actions. */
  submitVariant?: "default" | "destructive"
  cancelLabel?: string
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  children: React.ReactNode
  /** sm: a few short fields; md: the default; lg: wide or two-column forms. */
  size?: "sm" | "md" | "lg"
  /** One-off escape hatch; prefer `size`. */
  contentClassName?: string
}

const SIZES = {
  sm: "sm:max-w-md",
  md: "sm:max-w-2xl",
  lg: "sm:max-w-4xl",
} as const

/** Standard create/edit dialog shell; feature dialogs supply only their fields. */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  isEdit = false,
  isPending = false,
  submitDisabled = false,
  submitLabel,
  submitVariant = "default",
  cancelLabel = "Cancel",
  onSubmit,
  children,
  size = "md",
  contentClassName,
}: FormDialogProps) {
  // The footer sits outside the <form> (DialogContent pins it), so the `form` attribute links the
  // submit button back - without it, submit does nothing.
  const formId = React.useId()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("rounded-sm", SIZES[size], contentClassName)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <form id={formId} onSubmit={onSubmit} className="space-y-4">
          {children}
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {cancelLabel}
          </Button>
          <Button
            type="submit"
            form={formId}
            variant={submitVariant}
            loading={isPending}
            disabled={submitDisabled}
          >
            {submitLabel ?? (isEdit ? "Save Changes" : "Create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
