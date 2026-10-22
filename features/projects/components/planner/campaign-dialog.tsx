"use client"

import { useState } from "react"

import { FormDialog } from "@/components/shared/form-dialog"
import { DateField } from "@/components/shared/date-field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { EmployeeCombobox } from "@/features/employees/components/employee-combobox"
import { useCreateCampaign, useUpdateCampaign, type Campaign } from "../../hooks/use-campaigns"
import { campaignDatesProblem } from "../../lib/campaigns"
import { ServicePicker } from "../service-chips"

/** New campaign (campaign null) or edit one. New ones start with the project's services ticked. */
export function CampaignDialog({
  projectId,
  projectServices,
  campaign,
  open,
  onOpenChange,
  onCreated,
}: {
  projectId: string
  projectServices: readonly string[]
  campaign: Campaign | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (c: Campaign) => void
}) {
  const [name, setName] = useState(campaign?.name ?? "")
  const [startDate, setStartDate] = useState(campaign?.startDate ?? "")
  const [deadline, setDeadline] = useState(campaign?.deadline ?? "")
  const [services, setServices] = useState<string[]>(campaign?.services ?? [...projectServices])
  const [ownerId, setOwnerId] = useState<string | null>(campaign?.owner?.id ?? null)
  const [brief, setBrief] = useState(campaign?.brief ?? "")
  const create = useCreateCampaign(projectId)
  const update = useUpdateCampaign(projectId)

  const datesProblem = startDate && deadline ? campaignDatesProblem(startDate, deadline) : null
  const valid = name.trim() && startDate && deadline && !datesProblem && services.length > 0
  const ownerLabel = campaign?.owner
    ? `${campaign.owner.firstName} ${campaign.owner.lastName}`
    : undefined

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    const input = {
      name: name.trim(),
      startDate,
      deadline,
      services,
      brief: brief.trim() || null,
      ...(ownerId ? { ownerId } : {}),
    }
    if (campaign) {
      update.mutate({ id: campaign.id, input }, { onSuccess: () => onOpenChange(false) })
    } else {
      create.mutate(input, {
        onSuccess: (c) => {
          onOpenChange(false)
          onCreated?.(c)
        },
      })
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={campaign ? `Edit ${campaign.name}` : "New campaign"}
      description={
        campaign
          ? undefined
          : "One campaign across services - like Halloween or a launch - with its own calendar: a tab for each service and a plan for each team."
      }
      isEdit={!!campaign}
      isPending={create.isPending || update.isPending}
      submitDisabled={!valid}
      submitLabel={campaign ? "Save" : "Create campaign"}
      onSubmit={submit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Campaign name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="e.g. Halloween 2026"
            autoFocus={!campaign}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Starts</Label>
          <DateField value={startDate} onChange={setStartDate} modal />
        </div>
        <div className="space-y-1.5">
          <Label>Deadline</Label>
          <DateField value={deadline} onChange={setDeadline} modal />
          {datesProblem ? <p className="text-destructive text-xs">{datesProblem}</p> : null}
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Services taking part</Label>
          <ServicePicker value={services} onChange={setServices} />
          <p className="text-muted-foreground text-xs">
            {campaign
              ? "A newly ticked service gets its tab. Unticking keeps its tab and anything in it."
              : "Each gets a tab in the campaign's calendar, and its usual teams a plan due on the deadline."}
          </p>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Owner</Label>
          <EmployeeCombobox
            value={ownerId ?? undefined}
            onChange={(id) => setOwnerId(id ?? null)}
            initialLabel={ownerLabel}
            placeholder="Campaign Planning's owner, or the Account Manager"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Brief</Label>
          <Textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={3}
            placeholder="What the campaign is for, the offer, the look and feel"
          />
        </div>
      </div>
    </FormDialog>
  )
}
