"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

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
  cancelLabel?: string
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  /** Field markup. */
  children: React.ReactNode
  /** DialogContent className (e.g. for width). */
  contentClassName?: string
  /**
   * For tall forms: pin the header and footer and scroll only the body. Without
   * it the whole dialog scrolls as one block (fine for short forms).
   */
  scrollBody?: boolean
}

/**
 * Standard create/edit dialog shell: header (title/description), a `<form>`,
 * and a footer (Cancel + submit with spinner/edit-label). Each feature dialog
 * supplies only its fields as `children`. Replaces the ~8 hand-rolled
 * `*-form-dialog` scaffolds.
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
  cancelLabel = "Cancel",
  onSubmit,
  children,
  contentClassName,
  scrollBody = false,
}: FormDialogProps) {
  const footerButtons = (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => onOpenChange(false)}
        disabled={isPending}
      >
        {cancelLabel}
      </Button>
      <Button type="submit" disabled={isPending || submitDisabled}>
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {submitLabel ?? (isEdit ? "Save Changes" : "Create")}
      </Button>
    </>
  )

  // Tall form: flex column with a pinned header/footer and a scrolling body.
  // p-0 on the content moves padding onto each section so the scrollbar sits at
  // the edge; max-h bounds the column so the body (flex-1) gets the leftover
  // space and scrolls inside it instead of the whole dialog moving.
  if (scrollBody) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-[var(--radius)] p-0",
            contentClassName,
          )}
        >
          <DialogHeader className="shrink-0 border-b px-6 py-4 text-left">
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">{children}</div>
            <DialogFooter className="shrink-0 gap-2 border-t px-6 py-4">
              {footerButtons}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("rounded-[var(--radius)]", contentClassName)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 py-2">
          {children}
          <DialogFooter>{footerButtons}</DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
