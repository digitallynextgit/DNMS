"use client"

import { useEffect, useMemo, useState } from "react"

import { FormDialog } from "@/components/shared/form-dialog"
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
import { DateField } from "@/components/shared/date-field"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { REQUIREMENT_TYPE_LABELS } from "@/lib/constants"
import {
  useCreateRequirement,
  useProject,
  useProjectMembers,
  useProjectAllTasks,
} from "@/features/projects/hooks/use-projects"

/**
 * Raise a requirement: something the team needs from someone else before work
 * can continue. Reachable from the Requirements tab and from a blocked task,
 * which is why `defaultBlockedTaskId` exists - raising it from the task that is
 * stuck should not make you find that task again in a list.
 */
export function RequirementDialog({
  open,
  onOpenChange,
  projectId,
  defaultBlockedTaskId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  defaultBlockedTaskId?: string
}) {
  const create = useCreateRequirement(projectId)
  const { data: projectData } = useProject(projectId)
  const { data: membersData } = useProjectMembers(projectId)
  const { data: tasksData } = useProjectAllTasks(projectId)

  const accountManager = projectData?.data?.owner
  const members = useMemo(() => membersData?.data ?? [], [membersData])
  // Only unfinished work can be blocked by something.
  const openTasks = useMemo(
    () => (tasksData?.data ?? []).filter((t) => t.status !== "DONE" && t.status !== "DISCARDED"),
    [tasksData],
  )

  const [type, setType] = useState("DOCUMENT")
  const [title, setTitle] = useState("")
  const [details, setDetails] = useState("")
  const [requestedFromId, setRequestedFromId] = useState("")
  const [neededBy, setNeededBy] = useState("")
  const [blockedTaskIds, setBlockedTaskIds] = useState<string[]>([])

  // Reset each time it opens, and default the recipient to the Account Manager -
  // documents and credentials are theirs to chase, being the client contact.
  useEffect(() => {
    if (!open) return
    setType("DOCUMENT")
    setTitle("")
    setDetails("")
    setNeededBy("")
    setRequestedFromId(accountManager?.id ?? "")
    setBlockedTaskIds(defaultBlockedTaskId ? [defaultBlockedTaskId] : [])
  }, [open, accountManager?.id, defaultBlockedTaskId])

  const toggleTask = (id: string) =>
    setBlockedTaskIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => !o && !create.isPending && onOpenChange(false)}
      title="Raise a requirement"
      description="Something your team needs from someone else before this work can continue. They are notified straight away."
      isPending={create.isPending}
      submitDisabled={!title.trim() || !requestedFromId}
      submitLabel="Raise requirement"
      contentClassName="sm:max-w-lg"
      onSubmit={(e) => {
        e.preventDefault()
        create.mutate(
          {
            type,
            title: title.trim(),
            details: details.trim() || null,
            requestedFromId,
            neededBy: neededBy || null,
            blockedTaskIds,
          },
          { onSuccess: () => onOpenChange(false) },
        )
      }}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(REQUIREMENT_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Needed by</Label>
            <DateField value={neededBy} onChange={setNeededBy} placeholder="No date" modal />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="req-title">
            What do you need<span className="text-destructive"> *</span>
          </Label>
          <Input
            id="req-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Razorpay verification documents"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="req-details">Details</Label>
          <Textarea
            id="req-details"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={3}
            placeholder="Exactly what is needed, and what it unblocks. e.g. PAN, GST certificate and a cancelled cheque for the merchant account."
          />
        </div>

        <div className="space-y-2">
          <Label>Requested from</Label>
          <Select value={requestedFromId} onValueChange={setRequestedFromId}>
            <SelectTrigger>
              <SelectValue placeholder="Pick a person" />
            </SelectTrigger>
            <SelectContent>
              {accountManager && (
                <SelectItem value={accountManager.id}>
                  {accountManager.firstName} {accountManager.lastName} · Account Manager
                </SelectItem>
              )}
              {members
                .filter((m) => m.id !== accountManager?.id)
                .map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.firstName} {m.lastName}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-[11px]">
            Defaults to the Account Manager, who owns the client relationship.
          </p>
        </div>

        {openTasks.length > 0 && (
          <div className="space-y-2">
            <Label>Blocking which tasks?</Label>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-sm border p-2">
              {openTasks.map((t) => (
                <label
                  key={t.id}
                  className="hover:bg-muted/50 flex cursor-pointer items-start gap-2 rounded-sm p-1.5 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={blockedTaskIds.includes(t.id)}
                    onChange={() => toggleTask(t.id)}
                    className="accent-primary mt-0.5 h-3.5 w-3.5 shrink-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{t.title}</span>
                    {t.assignee && (
                      <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                        <AvatarDisplay
                          src={t.assignee.profilePhoto}
                          firstName={t.assignee.firstName}
                          lastName={t.assignee.lastName}
                          size="chip"
                        />
                        {t.assignee.firstName} {t.assignee.lastName}
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
            <p className="text-muted-foreground text-[11px]">
              Linked tasks show as blocked until this is provided, and unblock automatically.
            </p>
          </div>
        )}
      </div>
    </FormDialog>
  )
}
