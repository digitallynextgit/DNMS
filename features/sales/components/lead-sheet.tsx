"use client"

import { useState } from "react"
import { Ban, Globe, Mail, MapPin, MessageCircle, Pencil, Phone, Trash2 } from "lucide-react"

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
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
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { cn, formatDate, formatRelativeTime } from "@/lib/utils"
import { useAddLeadActivity, useDeleteLead, useLeadActivities } from "../hooks/use-sales"
import {
  ACTIVITY_KINDS,
  ACTIVITY_LABEL,
  STAGES,
  STAGE_CLASS,
  STAGE_LABEL,
  isStage,
  telLink,
  whatsappLink,
  type ActivityKind,
  type Stage,
} from "../lib/sales"
import type { LeadRow } from "../types"

const KEEP = "keep"

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
        {label}
      </p>
      <div className="truncate text-sm">{children}</div>
    </div>
  )
}

function StageChip({ stage }: { stage: Stage }) {
  return (
    <span className={cn("rounded-sm px-1.5 py-0.5 text-[11px] font-medium", STAGE_CLASS[stage])}>
      {STAGE_LABEL[stage]}
    </span>
  )
}

/** One lead: how to reach them, what happened so far, and logging the next step. */
export function LeadSheet({
  projectId,
  lead,
  canWork,
  canManage,
  onClose,
  onEdit,
}: {
  projectId: string
  lead: LeadRow
  canWork: boolean
  canManage: boolean
  onClose: () => void
  onEdit: () => void
}) {
  const { data: activities, isLoading } = useLeadActivities(projectId, lead.id)
  const log = useAddLeadActivity(projectId)
  const remove = useDeleteLead(projectId)
  const [kind, setKind] = useState<ActivityKind>("CALL")
  const [note, setNote] = useState("")
  const [moveTo, setMoveTo] = useState<string>(KEEP)
  const [followUp, setFollowUp] = useState(lead.nextFollowUp ?? "")
  const [confirmDelete, setConfirmDelete] = useState(false)

  const greeting = `Hi${lead.contactName ? ` ${lead.contactName}` : ""},`
  const tel = lead.doNotContact ? null : telLink(lead.phone)
  const wa = lead.doNotContact ? null : whatsappLink(lead.phone, greeting)

  function submit() {
    log.mutate(
      {
        id: lead.id,
        input: {
          kind,
          note: note.trim() || null,
          ...(moveTo !== KEEP && isStage(moveTo) ? { stage: moveTo } : {}),
          ...(followUp !== (lead.nextFollowUp ?? "") ? { nextFollowUp: followUp || null } : {}),
        },
      },
      {
        onSuccess: () => {
          setNote("")
          setMoveTo(KEEP)
        },
      },
    )
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex flex-wrap items-center gap-2 pr-6">
            {lead.business}
            <StageChip stage={lead.stage} />
          </SheetTitle>
          <p className="text-muted-foreground text-sm">
            {[lead.category, lead.area, lead.city].filter(Boolean).join(" · ") || "No details yet"}
          </p>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-6">
          {lead.doNotContact && (
            <p className="bg-destructive/10 text-destructive flex items-center gap-2 rounded-sm px-3 py-2 text-sm">
              <Ban className="h-4 w-4" /> Do not contact - they asked us not to.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button asChild={!!tel} variant="outline" className="gap-1.5" disabled={!tel}>
              {tel ? (
                <a href={tel}>
                  <Phone className="h-3.5 w-3.5" /> Call
                </a>
              ) : (
                <span>
                  <Phone className="h-3.5 w-3.5" /> Call
                </span>
              )}
            </Button>
            <Button asChild={!!wa} variant="outline" className="gap-1.5" disabled={!wa}>
              {wa ? (
                <a href={wa} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </a>
              ) : (
                <span>
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </span>
              )}
            </Button>
            {lead.email && !lead.doNotContact && (
              <Button asChild variant="outline" className="gap-1.5">
                <a href={`mailto:${lead.email}`}>
                  <Mail className="h-3.5 w-3.5" /> Email
                </a>
              </Button>
            )}
            {lead.mapsUrl && (
              <Button asChild variant="outline" className="gap-1.5">
                <a href={lead.mapsUrl} target="_blank" rel="noopener noreferrer">
                  <MapPin className="h-3.5 w-3.5" /> Map
                </a>
              </Button>
            )}
            {lead.website && (
              <Button asChild variant="outline" className="gap-1.5">
                <a href={lead.website} target="_blank" rel="noopener noreferrer">
                  <Globe className="h-3.5 w-3.5" /> Website
                </a>
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Fact label="Contact">{lead.contactName ?? "-"}</Fact>
            <Fact label="Phone">{lead.phone ?? "-"}</Fact>
            <Fact label="Assigned to">
              {lead.assignee
                ? `${lead.assignee.firstName} ${lead.assignee.lastName}`
                : "Nobody yet"}
            </Fact>
            <Fact label="Next follow-up">
              {lead.nextFollowUp ? formatDate(lead.nextFollowUp, "d MMM yyyy") : "-"}
            </Fact>
            <Fact label="Deal value">
              {lead.value != null ? `₹${lead.value.toLocaleString("en-IN")}` : "-"}
            </Fact>
            <Fact label="Source">{lead.source ?? "-"}</Fact>
            {lead.address && (
              <div className="col-span-2">
                <Fact label="Address">{lead.address}</Fact>
              </div>
            )}
            {lead.stage === "LOST" && lead.lostReason && (
              <div className="col-span-2">
                <Fact label="Why lost">{lead.lostReason}</Fact>
              </div>
            )}
            {lead.notes && (
              <div className="col-span-2">
                <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                  Notes
                </p>
                <p className="text-sm whitespace-pre-wrap">{lead.notes}</p>
              </div>
            )}
          </div>

          {canWork && (
            <div className="bg-muted/40 space-y-3 rounded-sm border p-3">
              <p className="text-sm font-medium">Log what happened</p>
              <div className="grid grid-cols-2 gap-2">
                <Select value={kind} onValueChange={(v) => setKind(v as ActivityKind)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {ACTIVITY_LABEL[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={moveTo} onValueChange={setMoveTo}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={KEEP}>Keep the stage</SelectItem>
                    {STAGES.filter((s) => s !== lead.stage).map((s) => (
                      <SelectItem key={s} value={s}>
                        Move to {STAGE_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="e.g. Spoke to the warden - 6 tanks on 3 blocks, wants a quote"
              />
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-44 flex-1 space-y-1">
                  <Label className="text-xs">Next follow-up</Label>
                  <DateField value={followUp} onChange={setFollowUp} modal />
                </div>
                <Button onClick={submit} disabled={log.isPending}>
                  Log
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">History</p>
            {isLoading ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : (activities ?? []).length === 0 ? (
              <p className="text-muted-foreground text-sm">Nothing logged yet.</p>
            ) : (
              <ol className="space-y-3">
                {(activities ?? []).map((a) => (
                  <li key={a.id} className="flex gap-2.5">
                    {a.actor ? (
                      <AvatarDisplay
                        src={a.actor.profilePhoto}
                        firstName={a.actor.firstName}
                        lastName={a.actor.lastName}
                        size="xs"
                        className="mt-0.5"
                      />
                    ) : (
                      <span className="bg-muted mt-0.5 h-5 w-5 shrink-0 rounded-sm" />
                    )}
                    <div className="min-w-0 text-sm">
                      <p>
                        <span className="font-medium">
                          {ACTIVITY_LABEL[a.kind as keyof typeof ACTIVITY_LABEL] ?? a.kind}
                        </span>
                        {a.kind === "STAGE" && a.toStage && isStage(a.toStage) ? (
                          <span className="text-muted-foreground">
                            {" "}
                            to {STAGE_LABEL[a.toStage]}
                          </span>
                        ) : null}
                        <span className="text-muted-foreground">
                          {" "}
                          · {a.actor ? `${a.actor.firstName} · ` : ""}
                          {formatRelativeTime(a.createdAt)}
                        </span>
                      </p>
                      {a.note && <p className="whitespace-pre-wrap">{a.note}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="flex gap-2 border-t pt-3">
            {canWork && (
              <Button variant="outline" className="gap-1.5" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            )}
            {canManage && (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive gap-1.5"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            )}
          </div>
        </div>

        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={`Delete ${lead.business}?`}
          description="The lead and its history are deleted. This can't be undone."
          confirmLabel="Delete lead"
          variant="destructive"
          isLoading={remove.isPending}
          onConfirm={() =>
            remove.mutate(lead.id, {
              onSuccess: () => {
                setConfirmDelete(false)
                onClose()
              },
            })
          }
        />
      </SheetContent>
    </Sheet>
  )
}
