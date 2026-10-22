"use client"

import { useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { MessageCircle, Phone, Plus, Upload, Users } from "lucide-react"

import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { StatStrip } from "@/components/shared/stat-strip"
import { SegmentedControl } from "@/components/shared/segmented-control"
import { EmptyState } from "@/components/shared/empty-state"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { replaceUrlParams } from "@/hooks/use-url-state"
import { cn, formatDate, formatRelativeTime } from "@/lib/utils"
import { indiaToday } from "@/lib/dates"
import { useLeads } from "../hooks/use-sales"
import {
  ACTIVITY_LABEL,
  STAGES,
  STAGE_CLASS,
  STAGE_LABEL,
  followUpState,
  isOpenStage,
  telLink,
  whatsappLink,
  type Stage,
} from "../lib/sales"
import type { LeadRow } from "../types"
import { LeadDialog } from "./lead-dialog"
import { LeadImportDialog } from "./lead-import-dialog"
import { LeadSheet } from "./lead-sheet"

type View = "table" | "board"
const VIEWS = [
  { value: "table", label: "Table" },
  { value: "board", label: "Board" },
] as const
const OPEN = "open"
const ALL = "all"

const rupees = (v: number) => `₹${v.toLocaleString("en-IN")}`

function StageChip({ stage }: { stage: Stage }) {
  return (
    <span
      className={cn(
        "rounded-sm px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
        STAGE_CLASS[stage],
      )}
    >
      {STAGE_LABEL[stage]}
    </span>
  )
}

function FollowUp({ lead, today }: { lead: LeadRow; today: string }) {
  if (!lead.nextFollowUp || !isOpenStage(lead.stage)) {
    return <span className="text-muted-foreground">-</span>
  }
  const state = followUpState(lead.nextFollowUp, today)
  return (
    <span
      className={cn(
        "tabular-nums",
        state === "OVERDUE" && "text-destructive font-medium",
        state === "TODAY" && "font-medium text-amber-700 dark:text-amber-400",
      )}
    >
      {state === "TODAY" ? "Today" : formatDate(lead.nextFollowUp, "d MMM")}
      {state === "OVERDUE" ? " · late" : ""}
    </span>
  )
}

/** Call and WhatsApp straight from the row; off for "do not contact". */
function Reach({ lead }: { lead: LeadRow }) {
  if (lead.doNotContact) return <span className="text-destructive text-[11px]">Do not contact</span>
  const tel = telLink(lead.phone)
  const wa = whatsappLink(lead.phone, `Hi${lead.contactName ? ` ${lead.contactName}` : ""},`)
  if (!tel) return <span className="text-muted-foreground">-</span>
  return (
    <span className="flex items-center gap-1">
      <span className="mr-1 tabular-nums">{lead.phone}</span>
      <a
        href={tel}
        onClick={(e) => e.stopPropagation()}
        title="Call"
        className="hover:bg-muted rounded-sm p-1"
      >
        <Phone className="h-3.5 w-3.5" />
      </a>
      {wa && (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          title="WhatsApp"
          className="hover:bg-muted rounded-sm p-1 text-emerald-600"
        >
          <MessageCircle className="h-3.5 w-3.5" />
        </a>
      )}
    </span>
  )
}

function Assignee({ lead }: { lead: LeadRow }) {
  const a = lead.assignee
  if (!a) return <span className="text-muted-foreground text-xs">Nobody</span>
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <AvatarDisplay src={a.profilePhoto} firstName={a.firstName} lastName={a.lastName} size="xs" />
      {a.firstName}
    </span>
  )
}

/** The project's sales pipeline: leads added by hand or imported, worked stage by stage. */
export function SalesTab({ projectId }: { projectId: string }) {
  const { data, isLoading } = useLeads(projectId)
  const { data: session } = useSession()
  const me = session?.user?.id ?? null
  const params = useSearchParams()
  const leads = useMemo(() => data?.data ?? [], [data])
  const canManage = data?.canManage ?? false
  const today = indiaToday()

  const [view, setView] = useState<View>("table")
  const [stage, setStage] = useState<string>(OPEN)
  const [who, setWho] = useState<string>(ALL)
  const [q, setQ] = useState("")
  const [editing, setEditing] = useState<LeadRow | null | undefined>(undefined)
  const [importOpen, setImportOpen] = useState(false)

  // ?lead=<id> (from a reminder) opens that lead.
  const openId = params.get("lead")
  const open = openId ? (leads.find((l) => l.id === openId) ?? null) : null
  const openLead = (id: string | null) => replaceUrlParams({ lead: id })

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return leads.filter((l) => {
      if (stage === OPEN && !isOpenStage(l.stage)) return false
      if (stage !== OPEN && stage !== ALL && l.stage !== stage) return false
      if (who === "me" && l.assignee?.id !== me) return false
      if (who === "none" && l.assignee) return false
      if (!needle) return true
      return [l.business, l.area, l.city, l.category, l.contactName, l.phone]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(needle))
    })
  }, [leads, stage, who, q, me])

  const stats = useMemo(() => {
    const openLeads = leads.filter((l) => isOpenStage(l.stage))
    const due = openLeads.filter(
      (l) => !l.doNotContact && l.nextFollowUp && l.nextFollowUp <= today,
    ).length
    const won = leads.filter((l) => l.stage === "WON")
    const wonValue = won.reduce((s, l) => s + (l.value ?? 0), 0)
    return [
      { label: "Open leads", value: openLeads.length },
      { label: "Follow-ups due", value: due, tone: due ? ("warning" as const) : undefined },
      { label: "Won", value: wonValue ? `${won.length} · ${rupees(wonValue)}` : won.length },
      { label: "Lost", value: leads.filter((l) => l.stage === "LOST").length },
    ]
  }, [leads, today])

  const columns: DataTableColumn<LeadRow>[] = [
    {
      header: "Business",
      sortValue: (l) => l.business,
      exportValue: (l) => l.business,
      cell: (l) => (
        <span className="flex flex-col">
          <span className="font-medium">{l.business}</span>
          <span className="text-muted-foreground text-[11px]">
            {[l.category, l.area].filter(Boolean).join(" · ") || "-"}
          </span>
        </span>
      ),
    },
    {
      header: "Contact",
      sortValue: (l) => l.contactName,
      exportValue: (l) => [l.contactName, l.phone, l.email].filter(Boolean).join(" / "),
      cell: (l) => (
        <span className="flex flex-col gap-0.5 text-xs">
          {l.contactName && <span>{l.contactName}</span>}
          <Reach lead={l} />
        </span>
      ),
    },
    {
      header: "Stage",
      sortValue: (l) => STAGES.indexOf(l.stage),
      exportValue: (l) => STAGE_LABEL[l.stage],
      cell: (l) => <StageChip stage={l.stage} />,
    },
    {
      header: "Assigned to",
      sortValue: (l) => (l.assignee ? l.assignee.firstName : null),
      exportValue: (l) => (l.assignee ? `${l.assignee.firstName} ${l.assignee.lastName}` : ""),
      cell: (l) => <Assignee lead={l} />,
    },
    {
      header: "Next follow-up",
      sortValue: (l) => (isOpenStage(l.stage) ? l.nextFollowUp : null),
      exportValue: (l) => l.nextFollowUp ?? "",
      cell: (l) => <FollowUp lead={l} today={today} />,
    },
    {
      header: "Value",
      align: "right",
      sortValue: (l) => l.value,
      exportValue: (l) => l.value ?? "",
      cell: (l) =>
        l.value != null ? (
          <span className="tabular-nums">{rupees(l.value)}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      header: "Last activity",
      sortValue: (l) => l.lastActivity?.at ?? null,
      exportValue: (l) => l.lastActivity?.at ?? "",
      className: "text-muted-foreground text-xs",
      cell: (l) =>
        l.lastActivity
          ? `${ACTIVITY_LABEL[l.lastActivity.kind as keyof typeof ACTIVITY_LABEL] ?? l.lastActivity.kind} · ${formatRelativeTime(l.lastActivity.at)}`
          : "-",
    },
    {
      header: "City",
      defaultHidden: true,
      exportValue: (l) => l.city ?? "",
      cell: (l) => l.city ?? "-",
    },
    {
      header: "Notes",
      defaultHidden: true,
      className: "max-w-64 truncate text-xs",
      exportValue: (l) => l.notes ?? "",
      cell: (l) => l.notes ?? "-",
    },
  ]

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <SegmentedControl value={view} onChange={setView} options={VIEWS} aria-label="View" />
      <Select value={stage} onValueChange={setStage}>
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={OPEN}>Open leads</SelectItem>
          <SelectItem value={ALL}>All leads</SelectItem>
          {STAGES.map((s) => (
            <SelectItem key={s} value={s}>
              {STAGE_LABEL[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={who} onValueChange={setWho}>
        <SelectTrigger className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Everyone&apos;s</SelectItem>
          <SelectItem value="me">Mine</SelectItem>
          <SelectItem value="none">Unassigned</SelectItem>
        </SelectContent>
      </Select>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search name, area, phone"
        className="w-52"
      />
    </div>
  )

  const actions = canManage ? (
    <div className="flex items-center gap-2">
      <Button variant="outline" className="gap-1.5" onClick={() => setImportOpen(true)}>
        <Upload className="h-3.5 w-3.5" />
        Import
      </Button>
      <Button className="gap-1.5" onClick={() => setEditing(null)}>
        <Plus className="h-3.5 w-3.5" />
        Add lead
      </Button>
    </div>
  ) : null

  const canWorkLead = (l: LeadRow) => canManage || l.assignee?.id === me

  return (
    <div className="mt-4 space-y-4">
      <StatStrip items={stats} loading={isLoading} />

      {!isLoading && leads.length === 0 ? (
        <EmptyState
          icon={Users}
          variant="card"
          title="No leads yet"
          description="Add the businesses this client can sell to - hostels, PGs, hotels - by hand or from a spreadsheet, then work them through Contacted, Interested, Site visit, Quotation and Won."
          action={canManage ? { label: "Add lead", onClick: () => setEditing(null) } : undefined}
          secondaryAction={
            canManage
              ? { label: "Import a spreadsheet", onClick: () => setImportOpen(true) }
              : undefined
          }
        />
      ) : view === "table" ? (
        <DataTable
          tableId="sales-leads"
          columns={columns}
          rows={shown}
          rowKey={(l) => l.id}
          loading={isLoading}
          skeletonRows={6}
          showSerial
          exportName="sales-leads"
          itemLabel="leads"
          onRowClick={(l) => openLead(l.id)}
          rowClassName={(l) => (l.doNotContact ? "opacity-60" : undefined)}
          toolbar={toolbar}
          toolbarEnd={actions}
          empty="No leads match."
        />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {toolbar}
            {actions}
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {STAGES.filter(
              (s) => stage === ALL || stage === s || (stage === OPEN && isOpenStage(s)),
            ).map((s) => {
              const col = shown.filter((l) => l.stage === s)
              return (
                <div key={s} className="bg-muted/30 w-64 shrink-0 space-y-2 rounded-sm border p-2">
                  <div className="flex items-center justify-between px-1">
                    <StageChip stage={s} />
                    <span className="text-muted-foreground text-xs">{col.length}</span>
                  </div>
                  {col.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => openLead(l.id)}
                      className={cn(
                        "bg-card hover:border-primary/50 block w-full space-y-1.5 rounded-sm border p-2.5 text-left text-sm",
                        l.doNotContact && "opacity-60",
                      )}
                    >
                      <p className="font-medium">{l.business}</p>
                      <p className="text-muted-foreground text-[11px]">
                        {[l.category, l.area].filter(Boolean).join(" · ") || "-"}
                      </p>
                      <div className="flex items-center justify-between text-xs">
                        <Assignee lead={l} />
                        <FollowUp lead={l} today={today} />
                      </div>
                    </button>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {open && (
        <LeadSheet
          key={open.id}
          projectId={projectId}
          lead={open}
          canWork={canWorkLead(open)}
          canManage={canManage}
          onClose={() => openLead(null)}
          onEdit={() => setEditing(open)}
        />
      )}
      {editing !== undefined && (
        <LeadDialog
          key={editing?.id ?? "new"}
          projectId={projectId}
          lead={editing}
          canManage={canManage}
          open
          onOpenChange={(o) => {
            if (!o) setEditing(undefined)
          }}
        />
      )}
      {importOpen && <LeadImportDialog projectId={projectId} open onOpenChange={setImportOpen} />}
    </div>
  )
}
