"use client"

import * as React from "react"
import { Flag, ShieldCheck } from "lucide-react"

import { cn } from "@/lib/utils"
import { useUrlState } from "@/hooks/use-url-state"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { FormDialog } from "@/components/shared/form-dialog"
import { SegmentedControl } from "@/components/shared/segmented-control"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { OYD_LEVELS, OYD_NOTE_MAX } from "../constants"
import { countsTowardsLevel, levelFor } from "../lib/oyd-rules"
import { useFlagAction, useOydFlags } from "../hooks/use-oyd"
import type { OydFlagView } from "../types"
import { FlagCard, LevelChip, type FlagAction } from "./flag-card"
import { RaiseFlagDialog } from "./raise-flag-dialog"

type Tab = "mine" | "raised" | "review" | "team"

export function OydPage() {
  const { data, isPending } = useOydFlags()
  const flags = React.useMemo(() => data?.flags ?? [], [data])
  const viewer = data?.viewer
  const [tabParam, setTab] = useUrlState("tab", "mine")
  const [raiseOpen, setRaiseOpen] = React.useState(false)
  const [pending, setPending] = React.useState<{ flag: OydFlagView; action: FlagAction } | null>(
    null,
  )

  const mine = flags.filter((f) => f.employee.id === viewer?.id)
  const raised = flags.filter((f) => f.raisedBy.id === viewer?.id)
  const toReview = flags.filter((f) => f.canReview)
  const team = flags.filter((f) => f.employee.id !== viewer?.id)
  const showTeam = !!viewer && (viewer.isHr || viewer.managesAnyone)

  const tabs = [
    { value: "mine" as const, label: `My flags (${mine.filter(countsTowardsLevel).length})` },
    { value: "raised" as const, label: `Raised by me (${raised.length})` },
    ...(showTeam
      ? [
          { value: "review" as const, label: `To confirm (${toReview.length})` },
          { value: "team" as const, label: viewer!.isHr ? "Everyone" : "My team" },
        ]
      : []),
  ]
  const tab: Tab = tabs.some((t) => t.value === tabParam) ? (tabParam as Tab) : "mine"
  const setPendingAction = (flag: OydFlagView, action: FlagAction) => setPending({ flag, action })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Own Your Deadline"
        description="Flags for missed deadlines and delays that hold up others. They count once HR or the Reporting Manager confirms them."
        actions={
          <Button className="gap-1.5" onClick={() => setRaiseOpen(true)}>
            <Flag className="h-4 w-4" /> Raise a flag
          </Button>
        }
      />

      <LevelLegend />

      {isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-80 rounded-sm" />
          <Skeleton className="h-32 rounded-sm" />
          <Skeleton className="h-32 rounded-sm" />
        </div>
      ) : (
        <>
          <SegmentedControl
            value={tab}
            onChange={setTab}
            options={tabs}
            aria-label="Which flags"
            className="max-w-full overflow-x-auto"
          />

          {tab === "mine" && <MyFlags flags={mine} onAction={setPendingAction} />}
          {tab === "raised" && (
            <FlagList
              flags={raised}
              showEmployee
              empty="You haven't raised any flags."
              onAction={setPendingAction}
            />
          )}
          {tab === "review" && (
            <FlagList
              flags={toReview}
              showEmployee
              empty="Nothing waiting for you to confirm."
              onAction={setPendingAction}
            />
          )}
          {tab === "team" && <TeamFlags flags={team} onAction={setPendingAction} />}
        </>
      )}

      <RaiseFlagDialog open={raiseOpen} onOpenChange={setRaiseOpen} />
      <ActionDialogs pending={pending} onClose={() => setPending(null)} />
    </div>
  )
}

function LevelLegend() {
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {OYD_LEVELS.map((step) => (
        <div key={step.level} className="bg-card flex items-start gap-2 rounded-sm border p-3">
          <span className="text-lg leading-none" aria-hidden>
            {step.emoji}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{step.label}</p>
            <p className="text-muted-foreground text-xs">{step.action}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function MyFlags({
  flags,
  onAction,
}: {
  flags: OydFlagView[]
  onAction: (flag: OydFlagView, action: FlagAction) => void
}) {
  const active = flags.filter(countsTowardsLevel).length
  const step = levelFor(active)
  return (
    <div className="space-y-4">
      <div className="bg-card flex flex-wrap items-center gap-4 rounded-sm border p-5">
        <div>
          <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            Active flags
          </p>
          <p className="text-3xl font-semibold tabular-nums">{active}</p>
        </div>
        <div className="min-w-0 flex-1">
          {step ? (
            <>
              <LevelChip level={active} />
              <p className="text-muted-foreground mt-1 text-sm">{step.action}.</p>
            </>
          ) : (
            <p className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-4 w-4" /> No active flags. Keep flagging blockers early.
            </p>
          )}
        </div>
      </div>
      <FlagList flags={flags} showEmployee={false} empty="No flags so far." onAction={onAction} />
    </div>
  )
}

/** People with flags, most active first; picking one narrows the list to them. */
function TeamFlags({
  flags,
  onAction,
}: {
  flags: OydFlagView[]
  onAction: (flag: OydFlagView, action: FlagAction) => void
}) {
  const [personId, setPersonId] = React.useState<string | null>(null)
  const people = React.useMemo(() => {
    const map = new Map<
      string,
      { employee: OydFlagView["employee"]; active: number; total: number; pending: number }
    >()
    for (const f of flags) {
      const row = map.get(f.employee.id) ?? {
        employee: f.employee,
        active: 0,
        total: 0,
        pending: 0,
      }
      row.total++
      if (countsTowardsLevel(f)) row.active++
      if (f.status === "PENDING" && !f.removedAt) row.pending++
      map.set(f.employee.id, row)
    }
    return [...map.values()].sort(
      (a, b) => b.active - a.active || a.employee.firstName.localeCompare(b.employee.firstName),
    )
  }, [flags])

  if (people.length === 0) {
    return <EmptyState icon={ShieldCheck} variant="card" title="No flags on anyone yet." />
  }

  const shown = personId ? flags.filter((f) => f.employee.id === personId) : flags
  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
      <div className="bg-card h-fit divide-y rounded-sm border">
        {people.map((p) => (
          <button
            key={p.employee.id}
            type="button"
            onClick={() => setPersonId(personId === p.employee.id ? null : p.employee.id)}
            className={cn(
              "hover:bg-accent flex w-full items-center gap-2 px-3 py-2.5 text-left",
              personId === p.employee.id && "bg-accent",
            )}
          >
            <AvatarDisplay
              src={p.employee.profilePhoto}
              firstName={p.employee.firstName}
              lastName={p.employee.lastName ?? ""}
              size="sm"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {p.employee.firstName} {p.employee.lastName}
              </span>
              <span className="text-muted-foreground block text-xs">
                {p.active} active · {p.total} in history
                {p.pending ? ` · ${p.pending} to confirm` : ""}
              </span>
            </span>
            {p.active > 0 && <LevelChip level={p.active} />}
          </button>
        ))}
      </div>
      <FlagList flags={shown} showEmployee={!personId} empty="No flags." onAction={onAction} />
    </div>
  )
}

function FlagList({
  flags,
  showEmployee,
  empty,
  onAction,
}: {
  flags: OydFlagView[]
  showEmployee: boolean
  empty: string
  onAction: (flag: OydFlagView, action: FlagAction) => void
}) {
  if (flags.length === 0) {
    return <EmptyState icon={ShieldCheck} variant="card" compact title={empty} />
  }
  return (
    <div className="space-y-3">
      {flags.map((f) => (
        <FlagCard key={f.id} flag={f} showEmployee={showEmployee} onAction={onAction} />
      ))}
    </div>
  )
}

/** Confirm is a yes/no; not confirming needs a reason; removing takes an optional one. */
function ActionDialogs({
  pending,
  onClose,
}: {
  pending: { flag: OydFlagView; action: FlagAction } | null
  onClose: () => void
}) {
  const act = useFlagAction()
  const [note, setNote] = React.useState("")
  const flag = pending?.flag
  const name = flag ? flag.employee.firstName : ""

  function run(action: FlagAction) {
    if (!flag) return
    act.mutate(
      { id: flag.id, body: { action, note: note.trim() || undefined } },
      {
        onSuccess: () => {
          setNote("")
          onClose()
        },
      },
    )
  }

  const close = (open: boolean) => {
    if (open) return
    setNote("")
    onClose()
  }

  return (
    <>
      <ConfirmDialog
        open={pending?.action === "confirm"}
        onOpenChange={close}
        title={`Confirm this flag on ${name}?`}
        description={`It will count towards ${name}'s OYD level, and ${name} gets the mail with HR and their Reporting Manager in Cc.`}
        confirmLabel="Confirm flag"
        isLoading={act.isPending}
        onConfirm={() => run("confirm")}
      />
      <FormDialog
        open={pending?.action === "reject" || pending?.action === "remove"}
        onOpenChange={close}
        title={
          pending?.action === "reject" ? "Don't confirm this flag" : `Remove this flag on ${name}?`
        }
        description={
          pending?.action === "reject"
            ? "It won't count, and the person who raised it sees your reason."
            : "It stops counting but stays in the history, with your name on the removal."
        }
        isPending={act.isPending}
        submitDisabled={pending?.action === "reject" && note.trim().length === 0}
        submitLabel={pending?.action === "reject" ? "Don't confirm" : "Remove flag"}
        submitVariant={pending?.action === "remove" ? "destructive" : "default"}
        onSubmit={(e) => {
          e.preventDefault()
          if (pending) run(pending.action)
        }}
        size="sm"
      >
        <div className="space-y-2">
          <Label htmlFor="oyd-action-note" required={pending?.action === "reject"}>
            {pending?.action === "reject" ? "Why not?" : "Reason (optional)"}
          </Label>
          <Textarea
            id="oyd-action-note"
            rows={3}
            maxLength={OYD_NOTE_MAX}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              pending?.action === "reject"
                ? "e.g. The delay was agreed with the client in advance"
                : "e.g. Raised by mistake"
            }
          />
        </div>
      </FormDialog>
    </>
  )
}
