"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface NameFormProps {
  title: string
  description?: string
  label?: string
  initial?: string
  placeholder?: string
  submitLabel?: string
  pending?: boolean
  onSubmit: (name: string) => void
  onCancel: () => void
}

/**
 * One text field behind a title: "New folder", "Rename". Submit is disabled
 * until the name is non-empty AND different from what it started as, so a
 * rename that changes nothing cannot be sent.
 */
export function NameDialog({
  open,
  onOpenChange,
  ...form
}: Omit<NameFormProps, "onCancel"> & {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* The form's state lives in a child that only exists while the dialog
            is open, so every opening starts from `initial` without an effect. */}
        <NameForm {...form} onCancel={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function NameForm({
  title,
  description,
  label = "Name",
  initial = "",
  placeholder,
  submitLabel = "Save",
  pending = false,
  onSubmit,
  onCancel,
}: NameFormProps) {
  const [name, setName] = useState(initial)
  const trimmed = name.trim()
  const canSubmit = trimmed.length > 0 && trimmed !== initial.trim()

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (canSubmit && !pending) onSubmit(trimmed)
      }}
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <div className="space-y-2 py-4">
        <Label required htmlFor="name-dialog-input">
          {label}
        </Label>
        <Input
          id="name-dialog-input"
          autoFocus
          value={name}
          maxLength={255}
          placeholder={placeholder}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => e.target.select()}
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit} loading={pending}>
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  )
}
