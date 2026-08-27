"use client"

import { useState } from "react"
import { UserPlus } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useSubmitReferral } from "../hooks/use-referrals"
import { RoleCombobox } from "./role-combobox"

const EMPTY = {
  fullName: "",
  email: "",
  phone: "",
  resumeUrl: "",
  linkedIn: "",
  careerRoleId: "",
  note: "",
}

/**
 * Refer somebody for an open role.
 *
 * Asks for less than the public application form on purpose: this is a
 * colleague passing on a friend's CV, and a form that demands a portfolio and a
 * cover letter is a form nobody fills in. Name, contact, CV, role.
 */
export function ReferDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const submit = useSubmitReferral()
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const set = (key: keyof typeof EMPTY, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: "" }))
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.fullName.trim()) e.fullName = "Their name is required."
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) e.email = "Enter a valid email."
    if (!form.resumeUrl.trim()) e.resumeUrl = "A link to their CV is required."
    else if (!/^https?:\/\//i.test(form.resumeUrl.trim()))
      e.resumeUrl = "Enter a full URL, including https://"
    if (form.linkedIn.trim() && !/^https?:\/\//i.test(form.linkedIn.trim()))
      e.linkedIn = "Enter a full URL, including https://"
    if (!form.careerRoleId) e.careerRoleId = "Pick the role."
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return
    submit.mutate(
      {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        resumeUrl: form.resumeUrl.trim(),
        linkedIn: form.linkedIn.trim(),
        careerRoleId: form.careerRoleId,
        note: form.note.trim(),
      },
      {
        onSuccess: () => {
          setForm(EMPTY)
          onOpenChange(false)
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !submit.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Refer someone
          </DialogTitle>
          <DialogDescription>
            They go into the same hiring pipeline as any other candidate, with you recorded as the
            referrer.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <Field label="Their name" required error={errors.fullName}>
            <Input
              value={form.fullName}
              onChange={(e) => set("fullName", e.target.value)}
              placeholder="Priya Sharma"
              aria-label="Priya Sharma"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Email" required error={errors.email}>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="priya@example.com"
                aria-label="priya@example.com"
              />
            </Field>
            <Field label="Phone" error={errors.phone}>
              <Input
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="Optional"
                aria-label="Optional"
              />
            </Field>
          </div>

          <Field label="Role" required error={errors.careerRoleId}>
            <RoleCombobox
              value={form.careerRoleId}
              onChange={(id) => set("careerRoleId", id)}
              // Only fetch while the dialog is open - a role list nobody is
              // looking at is a request nobody needs.
              enabled={open}
              hasError={!!errors.careerRoleId}
            />
          </Field>

          <Field label="CV / resume link" required error={errors.resumeUrl}>
            <Input
              value={form.resumeUrl}
              onChange={(e) => set("resumeUrl", e.target.value)}
              placeholder="https://drive.google.com/..."
              aria-label="https://drive.google.com/"
            />
          </Field>

          <Field label="LinkedIn" error={errors.linkedIn}>
            <Input
              value={form.linkedIn}
              onChange={(e) => set("linkedIn", e.target.value)}
              placeholder="Optional"
              aria-label="Optional"
            />
          </Field>

          <Field label="Why them?" error={errors.note}>
            <Textarea
              rows={3}
              value={form.note}
              onChange={(e) => set("note", e.target.value)}
              placeholder="Anything HR should know - how you know them, what they are good at."
              aria-label="Anything HR should know - how you know them, what they are good at"
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submit.isPending}>
            Cancel
          </Button>
          {/* Not gated on the role list any more - the combobox owns that, and
              validation already refuses a submit with no role picked. */}
          <Button onClick={handleSubmit} disabled={submit.isPending}>
            {submit.isPending ? "Submitting..." : "Submit referral"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className={cn(error && "text-destructive")}>
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  )
}
