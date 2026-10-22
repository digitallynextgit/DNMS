"use client"

import { useState } from "react"
import { Trash2 } from "lucide-react"

import { FormDialog } from "@/components/shared/form-dialog"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DateField } from "@/components/shared/date-field"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatDate } from "@/lib/utils"
import { useCreateFullFinal, useDeleteFullFinal, useUpdateFullFinal } from "../hooks/use-full-final"
import { NOTICE_LABEL, NOTICE_PERIODS, fnfDueDate, type NoticePeriod } from "../lib/fnf"
import type { FullFinalRow } from "../types"

const NOT_RECORDED = "none"

interface FormState {
  name: string
  designation: string
  lastWorkingDate: string
  dueDate: string
  /** Set by hand: stop following the last working day. */
  dueTouched: boolean
  releasedOn: string
  noticePeriod: NoticePeriod | typeof NOT_RECORDED
  relievingGiven: boolean
  relievingDate: string
  notes: string
}

function initial(row: FullFinalRow | null): FormState {
  return {
    name: row?.name ?? "",
    designation: row?.designation ?? "",
    lastWorkingDate: row?.lastWorkingDate ?? "",
    dueDate: row?.dueDate ?? "",
    dueTouched: !!row && row.dueDate !== fnfDueDate(row.lastWorkingDate),
    releasedOn: row?.releasedOn ?? "",
    noticePeriod: row?.noticePeriod ?? NOT_RECORDED,
    relievingGiven: row?.relievingGiven ?? false,
    relievingDate: row?.relievingDate ?? "",
    notes: row?.notes ?? "",
  }
}

function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className ?? "space-y-1.5"}>
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  )
}

/** Add a past employee, or edit anyone's FnF details. `row` null = add. */
export function FullFinalDialog({
  open,
  onOpenChange,
  row,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  row: FullFinalRow | null
}) {
  const [form, setForm] = useState<FormState>(() => initial(row))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const create = useCreateFullFinal()
  const update = useUpdateFullFinal()
  const remove = useDeleteFullFinal()
  const linked = !!row?.employeeId
  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }))

  const setLastDay = (lastWorkingDate: string) =>
    set({
      lastWorkingDate,
      ...(form.dueTouched || !lastWorkingDate ? {} : { dueDate: fnfDueDate(lastWorkingDate) }),
    })

  const valid = (linked || form.name.trim()) && form.lastWorkingDate && form.dueDate
  const pending = create.isPending || update.isPending

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    const common = {
      designation: form.designation.trim() || null,
      dueDate: form.dueDate,
      releasedOn: form.releasedOn || null,
      noticePeriod: form.noticePeriod === NOT_RECORDED ? null : form.noticePeriod,
      relievingGiven: form.relievingGiven,
      relievingDate: form.relievingGiven ? form.relievingDate || null : null,
      notes: form.notes.trim() || null,
    }
    const done = { onSuccess: () => onOpenChange(false) }
    if (row) {
      update.mutate(
        {
          id: row.id,
          input: {
            ...common,
            ...(linked ? {} : { name: form.name.trim(), lastWorkingDate: form.lastWorkingDate }),
          },
        },
        done,
      )
    } else {
      create.mutate(
        { ...common, name: form.name.trim(), lastWorkingDate: form.lastWorkingDate },
        done,
      )
    }
  }

  return (
    <>
      <FormDialog
        open={open}
        onOpenChange={onOpenChange}
        title={row ? `Full & Final: ${row.name}` : "Add a leaver"}
        description={
          row
            ? undefined
            : "For someone who left before DNMS. People who leave through DNMS are added on their own."
        }
        isEdit={!!row}
        isPending={pending}
        submitDisabled={!valid}
        onSubmit={submit}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" hint={linked ? "From their DNMS profile." : undefined}>
            <Input
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              disabled={linked}
              placeholder="Full name"
            />
          </Field>
          <Field label="Designation">
            <Input
              value={form.designation}
              onChange={(e) => set({ designation: e.target.value })}
              placeholder="e.g. Content Strategist"
            />
          </Field>

          <Field
            label="Last working day"
            hint={linked ? "From their profile - change it there." : undefined}
          >
            {linked ? (
              <Input value={formatDate(form.lastWorkingDate, "d MMM yyyy")} disabled />
            ) : (
              <DateField value={form.lastWorkingDate} onChange={setLastDay} modal />
            )}
          </Field>
          <Field
            label="FnF due by"
            hint={
              form.dueTouched
                ? "Set by hand."
                : "Two months after the last working day, unless you change it."
            }
          >
            <DateField
              value={form.dueDate}
              onChange={(dueDate) => set({ dueDate, dueTouched: true })}
              modal
            />
          </Field>

          <Field label="FnF released on" hint="Leave empty until it is paid.">
            <div className="flex items-center gap-2">
              <DateField
                value={form.releasedOn}
                onChange={(releasedOn) => set({ releasedOn })}
                placeholder="Not released yet"
                modal
                className="flex-1"
              />
              {form.releasedOn ? (
                <Button type="button" variant="ghost" onClick={() => set({ releasedOn: "" })}>
                  Clear
                </Button>
              ) : null}
            </div>
          </Field>
          <Field label="Notice period">
            <Select
              value={form.noticePeriod}
              onValueChange={(v) => set({ noticePeriod: v as FormState["noticePeriod"] })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NOTICE_PERIODS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {NOTICE_LABEL[p]}
                  </SelectItem>
                ))}
                <SelectItem value={NOT_RECORDED}>Not recorded</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <div className="space-y-1.5 sm:col-span-2">
            <Label className="flex items-center gap-2 font-normal">
              <Checkbox
                checked={form.relievingGiven}
                onCheckedChange={(v) => set({ relievingGiven: v === true })}
              />
              Relieving letter given
            </Label>
            {form.relievingGiven ? (
              <DateField
                value={form.relievingDate}
                onChange={(relievingDate) => set({ relievingDate })}
                placeholder="Date given (optional)"
                modal
                className="sm:max-w-[50%]"
              />
            ) : null}
          </div>

          <Field label="Notes" className="space-y-1.5 sm:col-span-2">
            <Textarea
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
              rows={2}
              placeholder="Anything HR should remember about this settlement"
            />
          </Field>

          {row && !linked ? (
            <div className="sm:col-span-2">
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive gap-1.5 px-2"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove from the register
              </Button>
            </div>
          ) : null}
        </div>
      </FormDialog>

      {row ? (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={`Remove ${row.name}?`}
          description="Their Full & Final record is deleted. This can't be undone."
          confirmLabel="Remove"
          variant="destructive"
          isLoading={remove.isPending}
          onConfirm={() =>
            remove.mutate(row.id, {
              onSuccess: () => {
                setConfirmDelete(false)
                onOpenChange(false)
              },
            })
          }
        />
      ) : null}
    </>
  )
}
