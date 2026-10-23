"use client"

import { useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, CalendarRange, Megaphone, Pencil, Plus, Trash2 } from "lucide-react"

import { SegmentedControl } from "@/components/shared/segmented-control"
import { EmptyState } from "@/components/shared/empty-state"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { replaceUrlParams } from "@/hooks/use-url-state"
import { cn, formatDate } from "@/lib/utils"
import { useSession } from "next-auth/react"
import { useWorkbookIndex } from "../../hooks/use-sheets"
import { useCampaigns, useDeleteCampaign, type Campaign } from "../../hooks/use-campaigns"
import { campaignTimingLabel, type CampaignState } from "../../lib/campaigns"
import { ProjectSheetSection } from "../project-sheet"
import { ServiceChips } from "../service-chips"
import { CampaignDialog } from "./campaign-dialog"

const TIMING_CLASS: Record<CampaignState, string> = {
  LIVE: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  DUE: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  UPCOMING: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  ENDED: "bg-muted text-muted-foreground",
}

const VIEWS = [
  { value: "monthly", label: "Monthly" },
  { value: "campaigns", label: "Campaigns" },
] as const

const range = (c: Campaign) =>
  `${formatDate(c.startDate, "d MMM")} - ${formatDate(c.deadline, "d MMM yyyy")}`

function TimingChip({ c }: { c: Campaign }) {
  return (
    <span
      className={cn(
        "rounded-sm px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
        TIMING_CLASS[c.timing.state],
      )}
    >
      {campaignTimingLabel(c.timing)}
    </span>
  )
}

function Progress({ c }: { c: Campaign }) {
  const { total, done, overdue } = c.progress
  const pct = total ? Math.round((done / total) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="bg-muted h-1.5 overflow-hidden rounded-full">
        <div
          className={cn("h-full rounded-full", pct === 100 ? "bg-emerald-500" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-muted-foreground flex items-center justify-between text-[11px]">
        <span>
          {total ? `${done} of ${total} team${total === 1 ? "" : "s"} done` : "No team plans yet"}
        </span>
        {overdue > 0 && <span className="text-destructive font-medium">{overdue} overdue</span>}
      </div>
    </div>
  )
}

function Owner({ c }: { c: Campaign }) {
  if (!c.owner) return <span className="text-muted-foreground text-xs">No owner</span>
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <AvatarDisplay
        src={c.owner.profilePhoto}
        firstName={c.owner.firstName}
        lastName={c.owner.lastName}
        size="xs"
      />
      {c.owner.firstName} {c.owner.lastName}
    </span>
  )
}

function CampaignCard({ c, onOpen }: { c: Campaign; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="bg-card hover:border-primary/50 flex flex-col gap-3 rounded-sm border p-4 text-left transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">{c.name}</p>
          <p className="text-muted-foreground text-xs tabular-nums">{range(c)}</p>
        </div>
        <TimingChip c={c} />
      </div>
      <ServiceChips services={c.services} />
      <Progress c={c} />
      <Owner c={c} />
    </button>
  )
}

/** The Planner: each service's monthly calendars, or campaigns that cut across services. */
export function PlannerSection({
  projectId,
  canManage,
  projectServices,
}: {
  projectId: string
  canManage: boolean
  projectServices: readonly string[]
}) {
  const params = useSearchParams()
  const { data: session } = useSession()
  const me = session?.user?.id ?? null
  const { data: index } = useWorkbookIndex(projectId)
  const { data: campaigns, isLoading } = useCampaigns(projectId)
  const [dialog, setDialog] = useState<"new" | "edit" | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const remove = useDeleteCampaign(projectId)

  // ?campaign=<id>, or a notification's ?calendar=<id> that is a campaign's calendar.
  const linkedCalendar = params.get("calendar")
  const open = useMemo(() => {
    const list = campaigns ?? []
    const byId = params.get("campaign")
    if (byId) return list.find((c) => c.id === byId) ?? null
    if (linkedCalendar && index?.find((w) => w.id === linkedCalendar)?.campaignId) {
      return list.find((c) => c.workbookId === linkedCalendar) ?? null
    }
    return null
  }, [campaigns, params, linkedCalendar, index])
  const view = open || params.get("view") === "campaigns" ? "campaigns" : "monthly"

  const go = (next: { view?: string | null; campaign?: string | null }) =>
    replaceUrlParams({ view: null, campaign: null, calendar: null, ...next })

  const canEdit = canManage || (!!open && open.owner?.id === me)

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          value={view}
          onChange={(v) => go({ view: v === "monthly" ? null : v })}
          options={VIEWS}
          aria-label="Planner view"
        />
        {view === "campaigns" && !open && canManage && (
          <Button className="ml-auto gap-1.5" onClick={() => setDialog("new")}>
            <Plus className="h-3.5 w-3.5" />
            New campaign
          </Button>
        )}
      </div>

      {view === "monthly" ? (
        <ProjectSheetSection projectId={projectId} canManage={canManage} />
      ) : open ? (
        <>
          <div className="bg-card space-y-3 rounded-sm border p-4">
            <div className="flex flex-wrap items-start gap-3">
              <Button
                variant="ghost"
                className="-ml-2 gap-1 px-2"
                onClick={() => go({ view: "campaigns" })}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                All campaigns
              </Button>
              <div className="ml-auto flex items-center gap-1">
                {canEdit && (
                  <Button variant="outline" className="gap-1.5" onClick={() => setDialog("edit")}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                )}
                {canManage && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete campaign"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="text-destructive h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Megaphone className="text-primary h-4 w-4" />
              <h3 className="text-lg font-semibold">{open.name}</h3>
              <TimingChip c={open} />
              <span className="text-muted-foreground flex items-center gap-1 text-sm tabular-nums">
                <CalendarRange className="h-3.5 w-3.5" />
                {range(open)}
              </span>
              <Owner c={open} />
            </div>
            <ServiceChips services={open.services} />
            {open.brief ? (
              <p className="text-muted-foreground text-sm whitespace-pre-wrap">{open.brief}</p>
            ) : null}
            <div className="max-w-md">
              <Progress c={open} />
            </div>
          </div>
          {open.workbookId ? (
            <ProjectSheetSection
              projectId={projectId}
              canManage={canManage}
              campaignWorkbookId={open.workbookId}
            />
          ) : null}
        </>
      ) : isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 rounded-sm" />
          ))}
        </div>
      ) : (campaigns ?? []).length === 0 ? (
        <EmptyState
          icon={Megaphone}
          variant="card"
          title="No campaigns yet"
          description="Plan Halloween, Diwali or a launch across every service at once: one start date, one deadline, a tab per service and a plan per team - and everyone on it gets reminded."
          action={
            canManage ? { label: "New campaign", onClick: () => setDialog("new") } : undefined
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(campaigns ?? []).map((c) => (
            <CampaignCard key={c.id} c={c} onOpen={() => go({ campaign: c.id })} />
          ))}
        </div>
      )}

      {dialog && (
        <CampaignDialog
          key={dialog === "edit" ? open?.id : "new"}
          projectId={projectId}
          projectServices={projectServices}
          campaign={dialog === "edit" ? open : null}
          open
          onOpenChange={(o) => {
            if (!o) setDialog(null)
          }}
          onCreated={(c) => go({ campaign: c.id })}
        />
      )}
      {open && (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={`Delete ${open.name}?`}
          description="The campaign and its calendar - every tab, row and team plan in it - are deleted. This can't be undone."
          confirmLabel="Delete campaign"
          variant="destructive"
          isLoading={remove.isPending}
          onConfirm={() =>
            remove.mutate(open.id, {
              onSuccess: () => {
                setConfirmDelete(false)
                go({ view: "campaigns" })
              },
            })
          }
        />
      )}
    </div>
  )
}
