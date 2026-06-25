"use client"

import { useState, useEffect } from "react"
import { FormDialog } from "@/components/shared/form-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { useCreateLeaveType, useUpdateLeaveType } from "@/features/leave/hooks/use-leave"
import type { LeaveType } from "@/features/leave/hooks/use-leave"

interface LeaveTypeFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  leaveType?: LeaveType | null
}

const defaultForm = {
  name: "",
  code: "",
  description: "",
  isPaid: true,
  maxDaysPerYear: 0,
  carryForward: false,
  maxCarryDays: 0,
  requiresApproval: true,
}

type FormState = typeof defaultForm

export function LeaveTypeForm({ open, onOpenChange, leaveType }: LeaveTypeFormProps) {
  const createLeaveType = useCreateLeaveType()
  const updateLeaveType = useUpdateLeaveType()
  const isEditing = !!leaveType

  const [form, setForm] = useState<FormState>(defaultForm)

  useEffect(() => {
    if (leaveType) {
      setForm({
        name: leaveType.name,
        code: leaveType.code,
        description: leaveType.description ?? "",
        isPaid: leaveType.isPaid,
        maxDaysPerYear: leaveType.maxDaysPerYear,
        carryForward: leaveType.carryForward,
        maxCarryDays: leaveType.maxCarryDays,
        requiresApproval: leaveType.requiresApproval,
      })
    } else {
      setForm(defaultForm)
    }
  }, [leaveType, open])

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      description: form.description.trim() || undefined,
      isPaid: form.isPaid,
      maxDaysPerYear: Number(form.maxDaysPerYear),
      carryForward: form.carryForward,
      maxCarryDays: form.carryForward ? Number(form.maxCarryDays) : 0,
      requiresApproval: form.requiresApproval,
    }

    if (isEditing && leaveType) {
      await updateLeaveType.mutateAsync({ id: leaveType.id, body: payload })
    } else {
      await createLeaveType.mutateAsync(payload)
    }

    onOpenChange(false)
  }

  const isPending = createLeaveType.isPending || updateLeaveType.isPending

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Edit Leave Type" : "New Leave Type"}
      description={
        isEditing
          ? "Update the details for this leave type."
          : "Create a new leave type for employees to use."
      }
      isEdit={isEditing}
      isPending={isPending}
      submitDisabled={!form.name || !form.code}
      submitLabel={isEditing ? "Save Changes" : "Create Leave Type"}
      onSubmit={handleSubmit}
      contentClassName="max-w-md"
    >
      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="lt-name">Name</Label>
        <Input
          id="lt-name"
          value={form.name}
          onChange={(e) => setField("name", e.target.value)}
          placeholder="e.g. Annual Leave"
          required
        />
      </div>

      {/* Code */}
      <div className="space-y-1.5">
        <Label htmlFor="lt-code">Code</Label>
        <Input
          id="lt-code"
          value={form.code}
          onChange={(e) => setField("code", e.target.value.toUpperCase())}
          placeholder="e.g. AL"
          required
          maxLength={10}
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="lt-desc">
          Description <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Textarea
          id="lt-desc"
          value={form.description}
          onChange={(e) => setField("description", e.target.value)}
          placeholder="Brief description of this leave type..."
          rows={2}
          className="resize-none"
        />
      </div>

      {/* Max days per year */}
      <div className="space-y-1.5">
        <Label htmlFor="lt-max-days">Max Days / Year</Label>
        <Input
          id="lt-max-days"
          type="number"
          min={0}
          value={form.maxDaysPerYear}
          onChange={(e) => setField("maxDaysPerYear", Number(e.target.value))}
        />
        <p className="text-muted-foreground text-xs">Set to 0 for unlimited.</p>
      </div>

      {/* Switches */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="lt-paid">Paid Leave</Label>
          <Switch
            id="lt-paid"
            checked={form.isPaid}
            onCheckedChange={(v) => setField("isPaid", v)}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="lt-approval">Requires Approval</Label>
          <Switch
            id="lt-approval"
            checked={form.requiresApproval}
            onCheckedChange={(v) => setField("requiresApproval", v)}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="lt-carry">Allow Carry Forward</Label>
          <Switch
            id="lt-carry"
            checked={form.carryForward}
            onCheckedChange={(v) => setField("carryForward", v)}
          />
        </div>

        {/* Max carry days - only shown when carryForward is enabled */}
        {form.carryForward && (
          <div className="border-muted space-y-1.5 border-l-2 pl-4">
            <Label htmlFor="lt-max-carry">Max Days to Carry Forward</Label>
            <Input
              id="lt-max-carry"
              type="number"
              min={0}
              value={form.maxCarryDays}
              onChange={(e) => setField("maxCarryDays", Number(e.target.value))}
            />
            <p className="text-muted-foreground text-xs">Set to 0 for unlimited carry.</p>
          </div>
        )}
      </div>
    </FormDialog>
  )
}
