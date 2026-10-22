"use client"

import { useState } from "react"

import { FormDialog } from "@/components/shared/form-dialog"
import { DateField } from "@/components/shared/date-field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmployeeCombobox } from "@/features/employees/components/employee-combobox"
import { useCreateLead, useUpdateLead } from "../hooks/use-sales"
import { STAGES, STAGE_LABEL, type Stage } from "../lib/sales"
import type { LeadRow } from "../types"

const TEXT_FIELDS = [
  { key: "contactName", label: "Contact person", placeholder: "Owner or manager" },
  { key: "phone", label: "Phone", placeholder: "+91 98765 43210" },
  { key: "email", label: "Email", placeholder: "name@business.com" },
  { key: "category", label: "Category", placeholder: "e.g. Boys hostel, PG, Hotel" },
  { key: "area", label: "Area", placeholder: "e.g. Sector 62" },
  { key: "city", label: "City", placeholder: "e.g. Noida" },
  { key: "website", label: "Website", placeholder: "https://" },
  { key: "mapsUrl", label: "Google Maps link", placeholder: "https://maps.google.com/..." },
] as const
type TextKey = (typeof TEXT_FIELDS)[number]["key"]

/** Add a lead (lead null) or edit one. Only managers see the assignee field. */
export function LeadDialog({
  projectId,
  lead,
  canManage,
  open,
  onOpenChange,
}: {
  projectId: string
  lead: LeadRow | null
  canManage: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [business, setBusiness] = useState(lead?.business ?? "")
  const [text, setText] = useState<Record<TextKey, string>>(
    () =>
      Object.fromEntries(TEXT_FIELDS.map((f) => [f.key, lead?.[f.key] ?? ""])) as Record<
        TextKey,
        string
      >,
  )
  const [address, setAddress] = useState(lead?.address ?? "")
  const [stage, setStage] = useState<Stage>(lead?.stage ?? "NEW")
  const [lostReason, setLostReason] = useState(lead?.lostReason ?? "")
  const [value, setValue] = useState(lead?.value != null ? String(lead.value) : "")
  const [assigneeId, setAssigneeId] = useState<string | null>(lead?.assignee?.id ?? null)
  const [nextFollowUp, setNextFollowUp] = useState(lead?.nextFollowUp ?? "")
  const [doNotContact, setDoNotContact] = useState(lead?.doNotContact ?? false)
  const [notes, setNotes] = useState(lead?.notes ?? "")
  const create = useCreateLead(projectId)
  const update = useUpdateLead(projectId)

  const amount = value.trim() === "" ? null : Number(value.replace(/[,₹\s]/g, ""))
  const valid = business.trim() && (amount === null || (Number.isFinite(amount) && amount >= 0))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    const fields = Object.fromEntries(
      TEXT_FIELDS.map((f) => [f.key, text[f.key].trim() || null]),
    ) as Record<TextKey, string | null>
    const input = {
      business: business.trim(),
      ...fields,
      address: address.trim() || null,
      stage,
      lostReason: stage === "LOST" ? lostReason.trim() || null : null,
      value: amount,
      nextFollowUp: nextFollowUp || null,
      doNotContact,
      notes: notes.trim() || null,
      ...(canManage ? { assigneeId } : {}),
    }
    const done = { onSuccess: () => onOpenChange(false) }
    if (lead) update.mutate({ id: lead.id, input }, done)
    else create.mutate(input, done)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={lead ? `Edit ${lead.business}` : "Add a lead"}
      isEdit={!!lead}
      isPending={create.isPending || update.isPending}
      submitDisabled={!valid}
      submitLabel={lead ? "Save" : "Add lead"}
      onSubmit={submit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Business</Label>
          <Input
            value={business}
            onChange={(e) => setBusiness(e.target.value)}
            placeholder="e.g. Sunrise Boys Hostel"
            maxLength={160}
            autoFocus={!lead}
          />
        </div>
        {TEXT_FIELDS.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label>{f.label}</Label>
            <Input
              value={text[f.key]}
              onChange={(e) => setText((t) => ({ ...t, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
            />
          </div>
        ))}
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Address</Label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Stage</Label>
          <Select value={stage} onValueChange={(v) => setStage(v as Stage)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STAGES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STAGE_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Deal value (₹)</Label>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode="numeric"
            placeholder="Expected or won amount"
          />
        </div>
        {stage === "LOST" && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Why it was lost</Label>
            <Input
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              placeholder="e.g. Already has a vendor, too expensive"
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Next follow-up</Label>
          <DateField value={nextFollowUp} onChange={setNextFollowUp} modal />
        </div>
        {canManage && (
          <div className="space-y-1.5">
            <Label>Assigned to</Label>
            <EmployeeCombobox
              value={assigneeId ?? undefined}
              onChange={(id) => setAssigneeId(id ?? null)}
              initialLabel={
                lead?.assignee ? `${lead.assignee.firstName} ${lead.assignee.lastName}` : undefined
              }
              placeholder="Who works this lead"
            />
          </div>
        )}
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
        <Label className="flex items-center gap-2 font-normal sm:col-span-2">
          <Switch checked={doNotContact} onCheckedChange={setDoNotContact} />
          Do not contact - they asked us not to. No reminders, and Call/WhatsApp are switched off.
        </Label>
      </div>
    </FormDialog>
  )
}
