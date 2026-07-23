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
  /** Whether the form is in edit (vs. create) mode - drives the default submit label. */
  isEdit?: boolean
  /** Mutation pending state - disables the footer + shows a spinner. */
  isPending?: boolean
  /** Extra condition to disable submit (e.g. invalid form). */
  submitDisabled?: boolean
  /** Override the submit label (default: isEdit ? "Save Changes" : "Create"). */
  submitLabel?: string
  /** Submit button variant - use "destructive" for irreversible actions (e.g. resign). */
  submitVariant?: "default" | "destructive"
  cancelLabel?: string
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  /** Field markup. */
  children: React.ReactNode
  /**
   * Dialog width. Three sanctioned sizes instead of the 12 ad-hoc `sm:max-w-*`
   * values that used to be sprinkled across the app.
   *   sm - a few short fields (confirm-ish forms)
   *   md - the default create/edit form
   *   lg - wide/two-column forms
   * (DialogContent already caps at 80vw on large screens.)
   */
  size?: "sm" | "md" | "lg"
  /** Escape hatch for a one-off DialogContent className. Prefer `size`. */
  contentClassName?: string
}

const SIZES = {
  sm: "sm:max-w-md",
  md: "sm:max-w-2xl",
  lg: "sm:max-w-4xl",
} as const

/**
 * Standard create/edit dialog shell: header (title/description), a `<form>`,
 * and a footer (Cancel + submit with spinner/edit-label). Each feature dialog
 * supplies only its fields as `children`. Replaces the ~8 hand-rolled
 * `*-form-dialog` scaffolds.
 *
 * The header and footer are pinned and only the fields scroll - that comes from
 * DialogContent, so it applies to every form dialog automatically.
 */
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
  // DialogContent pins the header and footer and scrolls only the body, so the
  // footer is rendered OUTSIDE the <form>. The HTML `form` attribute links the
  // submit button back across that boundary - without it, submit does nothing.
  const formId = React.useId()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("rounded", SIZES[size], contentClassName)}>
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
