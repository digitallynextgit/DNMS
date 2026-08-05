"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, Check, Clock, Inbox, Plus, Trash2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { StatStrip } from "@/components/shared/stat-strip"
import { StatusBadge } from "@/components/shared/status-badge"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { FormDialog } from "@/components/shared/form-dialog"
import {
  REQUIREMENT_STATUS_COLORS,
  REQUIREMENT_STATUS_LABELS,
  REQUIREMENT_TYPE_LABELS,
} from "@/lib/constants"
import { cn, formatDate, formatRelativeTime } from "@/lib/utils"
import {
  useDeleteRequirement,
  useProjectRequirements,
  useUpdateRequirement,
  type ProjectRequirement,
} from "@/features/projects/hooks/use-projects"
import { RequirementDialog } from "./requirement-dialog"

const OPEN = ["OPEN", "IN_PROGRESS"]

/** One side of the "who asked / who owes" pair on a requirement card. */
function Person({
  person,
  caption,
  designation,
}: {
  person: { firstName: string; lastName: string; profilePhoto?: string | null }
  caption: string
  designation: string | null
}) {
  return (
    <div className="flex items-center gap-2.5">
      <AvatarDisplay
        src={person.profilePhoto}
        firstName={person.firstName}
        lastName={person.lastName}
        size="sm"
        className="shrink-0"
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {person.firstName} {person.lastName}
        </p>
        <p className="text-muted-foreground truncate text-[11px]">
          {caption}
          {designation ? ` · ${designation}` : ""}
        </p>
      </div>
    </div>
  )
}

/** Past its needed-by date and still not provided. */
function isOverdue(r: ProjectRequirement): boolean {
  if (!r.neededBy || !OPEN.includes(r.status)) return false
  return new Date(r.neededBy) < new Date(new Date().toDateString())
}

export function RequirementsTab({
  projectId,
  currentUserId,
  canManage,
}: {
  projectId: string
  currentUserId: string
  canManage: boolean
}) {
  const { data, isLoading } = useProjectRequirements(projectId)
  const requirements = useMemo(() => data?.data ?? [], [data])
  const update = useUpdateRequirement(projectId)
  const del = useDeleteRequirement(projectId)

  const [raiseOpen, setRaiseOpen] = useState(false)
  const [rejecting, setRejecting] = useState<ProjectRequirement | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [deleting, setDeleting] = useState<ProjectRequirement | null>(null)

  const open = requirements.filter((r) => OPEN.includes(r.status))
  const resolved = requirements.filter((r) => !OPEN.includes(r.status))
  const overdue = open.filter(isOverdue)
  const mine = open.filter((r) => r.requestedFrom.id === currentUserId)

  if (isLoading) return <ListSkeleton rows={3} height="h-24" className="space-y-2" />

  return (
    <div className="space-y-4">
      <StatStrip
        items={[
          { label: "Open", value: open.length, tone: open.length > 0 ? "warning" : "default" },
          {
            label: "Overdue",
            value: overdue.length,
            tone: overdue.length > 0 ? "danger" : "default",
          },
          {
            label: "Waiting on you",
            value: mine.length,
            tone: mine.length > 0 ? "warning" : "default",
          },
          { label: "Resolved", value: resolved.length },
        ]}
      />

      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          Things a team needs from someone else before work can continue.
        </p>
        <Button size="sm" className="gap-1.5" onClick={() => setRaiseOpen(true)}>
          <Plus className="h-4 w-4" /> Raise requirement
        </Button>
      </div>

      {requirements.length === 0 ? (
        <EmptyState
          variant="card"
          icon={Inbox}
          title="Nothing outstanding."
          action={{ label: "Raise a requirement", onClick: () => setRaiseOpen(true) }}
        />
      ) : (
        <div className="space-y-2">
          {[...open, ...resolved].map((r) => {
            const late = isOverdue(r)
            // The person it is requested from does the providing; the raiser can
            // withdraw or close their own ask; an admin can do either.
            const canAct = r.requestedFrom.id === currentUserId || canManage
            const canRemove = r.raisedBy.id === currentUserId || canManage

            return (
              <Card
                key={r.id}
                className={cn(
                  late && "border-red-300 dark:border-red-900/60",
                  !OPEN.includes(r.status) && "bg-muted/20",
                )}
              >
                <CardContent className="space-y-3 p-4">
                  {/* Title left, deadline right - the two things you scan for. */}
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 flex-1 text-base font-semibold">{r.title}</p>
                    {r.neededBy && (
                      <span
                        className={cn(
                          "flex shrink-0 items-center gap-1 text-xs",
                          late ? "font-medium text-red-600" : "text-muted-foreground",
                        )}
                        title={`Needed by ${formatDate(r.neededBy)}`}
                      >
                        {late ? (
                          <AlertTriangle className="h-3.5 w-3.5" />
                        ) : (
                          <Clock className="h-3.5 w-3.5" />
                        )}
                        {late ? "Overdue" : `Needed ${formatRelativeTime(r.neededBy)}`}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* Open needs no badge - it is the default state and every
                        card would carry one. Anything else is worth calling out. */}
                    {r.status !== "OPEN" && (
                      <StatusBadge
                        status={r.status}
                        colorMap={REQUIREMENT_STATUS_COLORS}
                        labelMap={REQUIREMENT_STATUS_LABELS}
                        size="xs"
                      />
                    )}
                    <Badge variant="outline" className="text-[10px]">
                      {REQUIREMENT_TYPE_LABELS[r.type] ?? r.type}
                    </Badge>
                    {r.team && (
                      <Badge variant="secondary" className="text-[10px]">
                        {r.team.name}
                      </Badge>
                    )}
                  </div>

                  {r.details && (
                    <p className="text-muted-foreground text-xs whitespace-pre-line">{r.details}</p>
                  )}

                  {/* Both people side by side, each with their role under the
                      name, so "who asked / who owes" reads at a glance. */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Person
                      person={r.raisedBy}
                      caption="Raised by"
                      designation={r.team?.name ?? null}
                    />
                    <Person person={r.requestedFrom} caption="Waiting on" designation={null} />
                  </div>

                  {r.blockedTasks.length > 0 && (
                    <div className="border-t pt-2">
                      <p className="text-muted-foreground mb-1 text-[10px] font-medium tracking-wide uppercase">
                        Blocking {r.blockedTasks.length}{" "}
                        {r.blockedTasks.length === 1 ? "task" : "tasks"}
                      </p>
                      <ul className="text-muted-foreground space-y-0.5 text-[11px]">
                        {r.blockedTasks.map((t) => (
                          <li key={t.id} className="truncate">
                            · {t.title}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {r.resolutionNote && (
                    <p className="text-muted-foreground border-t pt-2 text-[11px] italic">
                      {r.resolutionNote}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {canAct && r.status === "OPEN" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() =>
                          update.mutate({ requirementId: r.id, status: "IN_PROGRESS" })
                        }
                      >
                        Working on it
                      </Button>
                    )}
                    {canAct && OPEN.includes(r.status) && (
                      <>
                        <Button
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={() => update.mutate({ requirementId: r.id, status: "PROVIDED" })}
                        >
                          <Check className="h-3.5 w-3.5" /> Mark provided
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-muted-foreground hover:text-destructive h-7 gap-1 text-xs"
                          onClick={() => {
                            setRejectReason("")
                            setRejecting(r)
                          }}
                        >
                          <X className="h-3.5 w-3.5" /> Can&apos;t provide
                        </Button>
                      </>
                    )}
                    {!OPEN.includes(r.status) && canAct && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => update.mutate({ requirementId: r.id, status: "OPEN" })}
                      >
                        Reopen
                      </Button>
                    )}
                    {canRemove && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive ml-auto h-7 w-7 p-0"
                        title="Delete requirement"
                        onClick={() => setDeleting(r)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <RequirementDialog open={raiseOpen} onOpenChange={setRaiseOpen} projectId={projectId} />

      {/* A refusal has to say why - the raiser is otherwise left guessing, and the
          server rejects a REJECTED status with no note. */}
      <FormDialog
        open={!!rejecting}
        onOpenChange={(o) => !o && setRejecting(null)}
        title="Can't provide this"
        description={
          rejecting ? `"${rejecting.title}" - tell them why, so they can plan around it.` : ""
        }
        isPending={update.isPending}
        submitDisabled={!rejectReason.trim()}
        submitLabel="Send"
        onSubmit={(e) => {
          e.preventDefault()
          if (!rejecting) return
          update.mutate(
            {
              requirementId: rejecting.id,
              status: "REJECTED",
              resolutionNote: rejectReason.trim(),
            },
            { onSuccess: () => setRejecting(null) },
          )
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="reject-reason">
            Reason<span className="text-destructive"> *</span>
          </Label>
          <Input
            id="reject-reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. Client has not shared the GST certificate yet"
          />
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this requirement?"
        description="It disappears for everyone and any blocked tasks are unblocked. This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        confirmDelaySeconds={3}
        isLoading={del.isPending}
        onConfirm={() => {
          if (deleting) del.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }}
      />
    </div>
  )
}
