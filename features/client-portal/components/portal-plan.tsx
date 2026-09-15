"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Link2,
  MessageSquareWarning,
  Plus,
  Trash2,
  Upload,
} from "lucide-react"

import { apiFetch } from "@/lib/api-fetch"
import { formatDate, formatFileSize } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { DateField } from "@/components/shared/date-field"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { EmptyState } from "@/components/shared/empty-state"
import { StatStrip } from "@/components/shared/stat-strip"
import { StatusBadge } from "@/components/shared/status-badge"
import { FormDialog } from "@/components/shared/form-dialog"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DELIVERABLE_STATUS_COLORS } from "@/lib/constants"
import {
  DELIVERABLE_STATUS_LABELS,
  nextActions,
  type DeliverableStatus,
} from "@/features/projects/lib/deliverable-lifecycle"
import { formatPeriod, parseDay } from "@/features/projects/lib/delivery-period"

// =============================================================================
// The client's view of the content plan.
// =============================================================================
// Same rows the team works from, read as one table: what was promised, what has
// landed, and what is still waiting on somebody.
//
// Which buttons a row gets is NOT decided here. `nextActions(status, "client")`
// is the same function the server checks the request against, so the portal
// cannot offer a move that would then be refused - and when the rules change,
// they change in one place.
// =============================================================================

interface PlanFile {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
}

interface PlanItem {
  id: string
  type: string
  title: string
  quantity: number
  deliveredQuantity: number
  status: DeliverableStatus
  /** All four are yyyy-MM-dd, never timestamps - the server trims them. */
  dueOn: string | null
  periodStart: string | null
  periodEnd: string | null
  completedOn: string | null
  links: string[]
  acceptedAt: string | null
  acceptanceNote: string | null
  createdAt: string
  loggedByClient: { id: string; name: string } | null
  acceptedByClient: { id: string; name: string } | null
  files: PlanFile[]
  /** The brief, but only on items the client wrote. Null on the team's own. */
  yourBrief: string | null
  /**
   * May this client withdraw it? Decided on the SERVER, by the same predicate
   * the delete itself uses - the browser never re-derives the rule.
   */
  canWithdraw: boolean
}

interface PlanPayload {
  items: PlanItem[]
  /** False while the project has no team to file a request against. */
  canPlan: boolean
  projectName: string
}

/** One line of a plan being drafted. Quantity is a string while it is typed. */
interface DraftLine {
  type: string
  title: string
  quantity: string
  description: string
}

const emptyLine = (): DraftLine => ({ type: "", title: "", quantity: "1", description: "" })

const todayYmd = () => new Date().toISOString().slice(0, 10)

/** "14-18 Sep 2026" for a row's window, or a dash where it has none. */
function periodLabel(start: string | null, end: string | null): string {
  const a = parseDay(start)
  const b = parseDay(end)
  return a && b ? formatPeriod(a, b) : "—"
}

export function PortalPlan({ projectRef }: { projectRef: string }) {
  const qc = useQueryClient()
  const base = `/api/portal/projects/${projectRef}/plan`

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["portal-plan", projectRef],
    queryFn: async () => (await apiFetch<{ data: { data: PlanPayload } }>(base)).data.data,
    staleTime: 30_000,
  })

  const [planning, setPlanning] = React.useState(false)
  const [from, setFrom] = React.useState(todayYmd)
  const [to, setTo] = React.useState(todayYmd)
  const [lines, setLines] = React.useState<DraftLine[]>([emptyLine()])

  const [deciding, setDeciding] = React.useState<{ item: PlanItem; finalise: boolean } | null>(null)
  const [reason, setReason] = React.useState("")
  const [reasonFor, setReasonFor] = React.useState<string | null>(null)

  const [linking, setLinking] = React.useState<PlanItem | null>(null)
  const [link, setLink] = React.useState("")
  const [withdrawing, setWithdrawing] = React.useState<PlanItem | null>(null)

  const uploadFor = React.useRef<string | null>(null)
  const fileInput = React.useRef<HTMLInputElement>(null)

  // Reset the note when the dialog moves to a different item - during render,
  // not in an effect, which would paint the previous note for a frame.
  if (deciding && reasonFor !== deciding.item.id) {
    setReasonFor(deciding.item.id)
    setReason("")
  }

  const invalidate = () => qc.invalidateQueries({ queryKey: ["portal-plan", projectRef] })

  const plan = useMutation({
    mutationFn: (body: unknown) =>
      apiFetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast.success("Added to the plan - the team has been notified")
      setPlanning(false)
      setLines([emptyLine()])
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const decide = useMutation({
    mutationFn: (vars: { id: string; decision: "FINALISE" | "REQUEST_CHANGES"; reason: string }) =>
      apiFetch(`${base}/${vars.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: vars.decision, reason: vars.reason }),
      }),
    onSuccess: (_d, vars) => {
      toast.success(vars.decision === "FINALISE" ? "Finalised" : "Sent back to the team")
      setDeciding(null)
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const attachLink = useMutation({
    mutationFn: (vars: { id: string; link: string }) =>
      apiFetch(`${base}/${vars.id}/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link: vars.link }),
      }),
    onSuccess: () => {
      toast.success("Link attached")
      setLinking(null)
      setLink("")
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const attachFile = useMutation({
    mutationFn: async (vars: { id: string; file: File }) => {
      const form = new FormData()
      form.append("file", vars.file)
      return apiFetch(`${base}/${vars.id}/file`, { method: "POST", body: form })
    },
    onSuccess: () => {
      toast.success("File attached")
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const withdraw = useMutation({
    mutationFn: (id: string) => apiFetch(`${base}/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Withdrawn")
      setWithdrawing(null)
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  /** Open an asset in a new tab, or save it. The URL is signed and short-lived. */
  async function openAsset(file: PlanFile, download: boolean) {
    try {
      const res = await apiFetch<{ data: { data: { url: string } } }>(
        `${base}/assets/${file.id}${download ? "?download=1" : ""}`,
      )
      window.open(res.data.data.url, "_blank", "noopener,noreferrer")
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const items = data?.items ?? []
  const canPlan = data?.canPlan ?? false

  const counts = {
    planned: items.reduce((n, i) => n + i.quantity, 0),
    made: items.reduce((n, i) => n + Math.min(i.deliveredQuantity, i.quantity), 0),
    waiting: items.filter((i) => i.status === "DELIVERED").length,
    finalised: items.filter((i) => i.status === "ACCEPTED").length,
  }

  const setLine = (i: number, patch: Partial<DraftLine>) =>
    setLines((prev) => prev.map((l, n) => (n === i ? { ...l, ...patch } : l)))

  const canSubmitPlan =
    from !== "" &&
    to !== "" &&
    to >= from &&
    lines.length > 0 &&
    lines.every((l) => l.type.trim() && l.title.trim() && Number(l.quantity) >= 1)

  // ── The files and links hanging off one item ───────────────────────────────
  function Assets({ item }: { item: PlanItem }) {
    if (item.files.length === 0 && item.links.length === 0) {
      return <span className="text-muted-foreground text-xs">—</span>
    }
    return (
      <div className="space-y-1">
        {item.files.map((f) => (
          <div key={f.id} className="flex items-center gap-1">
            <FileText className="text-muted-foreground h-3 w-3 shrink-0" />
            <span className="max-w-[11rem] truncate text-xs" title={f.fileName}>
              {f.fileName}
            </span>
            <span className="text-muted-foreground text-[10px] whitespace-nowrap">
              {formatFileSize(f.fileSize)}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => openAsset(f, false)}
              aria-label={`View ${f.fileName}`}
              title="View"
            >
              <Eye className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => openAsset(f, true)}
              aria-label={`Download ${f.fileName}`}
              title="Download"
            >
              <Download className="h-3 w-3" />
            </Button>
          </div>
        ))}
        {item.links.map((l) => (
          <a
            key={l}
            href={l}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary flex items-center gap-1 text-xs underline-offset-2 hover:underline"
          >
            <Link2 className="h-3 w-3 shrink-0" />
            <span className="max-w-[11rem] truncate" title={l}>
              {l}
            </span>
          </a>
        ))}
      </div>
    )
  }

  // ── Row actions, drawn from the same table the server checks ───────────────
  function Actions({ item }: { item: PlanItem }) {
    const actions = nextActions(item.status, "client")
    const canAttach = item.status !== "ACCEPTED"
    return (
      <div className="flex flex-wrap items-center justify-end gap-1">
        {canAttach && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setLinking(item)
                setLink("")
              }}
              aria-label={`Attach a link to ${item.title}`}
              title="Attach a link"
            >
              <Link2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={attachFile.isPending}
              onClick={() => {
                uploadFor.current = item.id
                fileInput.current?.click()
              }}
              aria-label={`Upload a file for ${item.title}`}
              title="Upload a file"
            >
              <Upload className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
        {actions.includes("REJECTED") && (
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={() => setDeciding({ item, finalise: false })}
          >
            <MessageSquareWarning className="h-3.5 w-3.5" />
            Changes
          </Button>
        )}
        {actions.includes("ACCEPTED") && (
          <Button className="gap-1.5" onClick={() => setDeciding({ item, finalise: true })}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            Finalise
          </Button>
        )}
        {item.canWithdraw && (
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => setWithdrawing(item)}
            aria-label={`Withdraw ${item.title}`}
            title="Withdraw this request"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    )
  }

  const columns: DataTableColumn<PlanItem>[] = [
    {
      header: "Item",
      cell: (r) => (
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-medium">{r.title}</span>
            {r.loggedByClient && (
              <span className="text-muted-foreground rounded-sm border px-1.5 text-[10px]">
                you asked for this
              </span>
            )}
          </div>
          {r.yourBrief && (
            <p className="text-muted-foreground max-w-[20rem] border-l-2 pl-2 text-xs">
              {r.yourBrief}
            </p>
          )}
          {r.status === "ACCEPTED" && r.acceptanceNote && (
            <p className="max-w-[20rem] rounded-sm bg-emerald-500/10 px-2 py-1 text-xs">
              {r.acceptanceNote}
            </p>
          )}
        </div>
      ),
    },
    { header: "Kind", cell: (r) => <span className="text-xs">{r.type}</span> },
    {
      header: "Planned for",
      cell: (r) => (
        <span className="text-xs whitespace-nowrap">{periodLabel(r.periodStart, r.periodEnd)}</span>
      ),
    },
    {
      header: "Due",
      cell: (r) => (
        <span className="text-xs whitespace-nowrap">{r.dueOn ? formatDate(r.dueOn) : "—"}</span>
      ),
    },
    {
      header: "Made",
      align: "right",
      cell: (r) => (
        <span className="text-xs whitespace-nowrap">
          {r.deliveredQuantity} of {r.quantity}
        </span>
      ),
    },
    {
      header: "Status",
      cell: (r) => (
        <StatusBadge
          status={r.status}
          colorMap={DELIVERABLE_STATUS_COLORS}
          labelMap={DELIVERABLE_STATUS_LABELS}
          size="xs"
        />
      ),
    },
    { header: "Assets", cell: (r) => <Assets item={r} /> },
    { header: "", align: "right", cell: (r) => <Actions item={r} /> },
  ]

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 rounded-sm" />
        <Skeleton className="h-64 rounded-sm" />
      </div>
    )
  }

  // A failed load must not look like an empty plan: without this the query
  // error was swallowed, and the page said "Nothing planned yet" over a
  // disabled button - two wrong statements, and nothing pointing at the cause.
  if (isError) {
    return (
      <div className="space-y-5">
        <h1 className="text-lg font-semibold">Content plan</h1>
        <EmptyState
          icon={AlertTriangle}
          variant="card"
          title="Could not load the plan"
          description={
            error instanceof Error && error.message
              ? error.message
              : "Something went wrong fetching it."
          }
          action={{ label: "Try again", onClick: () => void refetch() }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Content plan</h1>
          <p className="text-muted-foreground text-sm">
            What is planned between two dates, and what has been made against it. Finalise what is
            ready, or say what needs changing.
          </p>
        </div>
        <div className="space-y-1">
          <Button className="gap-1.5" onClick={() => setPlanning(true)} disabled={!canPlan}>
            <Plus className="h-4 w-4" />
            Plan items
          </Button>
          {!canPlan && (
            <p className="text-muted-foreground max-w-[14rem] text-[11px]">
              This project is not set up for planning yet - your account manager can sort that out.
            </p>
          )}
        </div>
      </div>

      {items.length > 0 && (
        <StatStrip
          items={[
            { label: "Planned", value: counts.planned },
            { label: "Made", value: counts.made, tone: "success" },
            { label: "Waiting on you", value: counts.waiting, tone: "warning" },
            { label: "Finalised", value: counts.finalised, tone: "success" },
          ]}
        />
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          variant="card"
          title="Nothing planned yet"
          description="Plan what you need and by when. Items appear here as the team picks them up, and you finalise each one when it is right."
        />
      ) : (
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(r) => r.id}
          showSerial
          minWidth="min-w-[1000px]"
          mobileCard={(r, i) => (
            <div className="space-y-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    <span className="text-muted-foreground">{i + 1}. </span>
                    {r.title}
                  </p>
                  <p className="text-muted-foreground text-[11px]">
                    {r.type} · {r.deliveredQuantity} of {r.quantity} made
                    {r.dueOn ? ` · due ${formatDate(r.dueOn)}` : ""}
                  </p>
                </div>
                <StatusBadge
                  status={r.status}
                  colorMap={DELIVERABLE_STATUS_COLORS}
                  labelMap={DELIVERABLE_STATUS_LABELS}
                  size="xs"
                />
              </div>
              <p className="text-muted-foreground text-[11px]">
                Planned for {periodLabel(r.periodStart, r.periodEnd)}
              </p>
              {r.yourBrief && (
                <p className="text-muted-foreground border-l-2 pl-2 text-xs">{r.yourBrief}</p>
              )}
              <Assets item={r} />
              <Actions item={r} />
            </div>
          )}
        />
      )}

      <input
        ref={fileInput}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          const id = uploadFor.current
          if (file && id) attachFile.mutate({ id, file })
          e.target.value = ""
          uploadFor.current = null
        }}
      />

      {/* ── Planning ──────────────────────────────────────────────────────── */}
      <FormDialog
        open={planning}
        onOpenChange={setPlanning}
        title="Plan items"
        description="Say what you need and how many. Your account manager routes it to the right people."
        submitLabel="Add to the plan"
        isPending={plan.isPending}
        submitDisabled={!canSubmitPlan}
        onSubmit={(e) => {
          e.preventDefault()
          plan.mutate({
            periodStart: from,
            periodEnd: to,
            lines: lines.map((l) => ({
              type: l.type.trim(),
              title: l.title.trim(),
              quantity: Number(l.quantity) || 1,
              description: l.description.trim(),
            })),
          })
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Start date</Label>
            {/* modal: the picker lives inside a dialog, and without it the
                popover closes the dialog behind it on the first click. */}
            <DateField value={from} onChange={setFrom} placeholder="First day" modal />
          </div>
          <div className="space-y-1.5">
            <Label>End date</Label>
            <DateField value={to} onChange={setTo} placeholder="Last day" modal />
          </div>
        </div>
        {to !== "" && from !== "" && to < from && (
          <p className="text-destructive text-xs">The period ends before it starts.</p>
        )}

        <div className="space-y-3">
          {lines.map((line, i) => (
            <div key={i} className="space-y-2 rounded-sm border p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-[11px] font-medium">Item {i + 1}</span>
                {lines.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setLines((prev) => prev.filter((_, n) => n !== i))}
                    aria-label={`Remove item ${i + 1}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`line-title-${i}`}>What is it?</Label>
                  <Input
                    id={`line-title-${i}`}
                    value={line.title}
                    maxLength={200}
                    placeholder="Launch film for the anniversary"
                    onChange={(e) => setLine(i, { title: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`line-type-${i}`}>Kind</Label>
                  <Input
                    id={`line-type-${i}`}
                    value={line.type}
                    maxLength={40}
                    placeholder="Reel, Blog, Banner"
                    onChange={(e) => setLine(i, { type: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`line-qty-${i}`}>How many</Label>
                  <Input
                    id={`line-qty-${i}`}
                    type="number"
                    min={1}
                    max={999}
                    value={line.quantity}
                    onChange={(e) => setLine(i, { quantity: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`line-desc-${i}`}>Description</Label>
                <Textarea
                  id={`line-desc-${i}`}
                  value={line.description}
                  rows={2}
                  maxLength={2000}
                  placeholder="What it should cover, the tone, anything the team needs to know."
                  onChange={(e) => setLine(i, { description: e.target.value })}
                />
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            className="gap-1.5"
            disabled={lines.length >= 60}
            onClick={() => setLines((prev) => [...prev, emptyLine()])}
          >
            <Plus className="h-3.5 w-3.5" />
            Add another item
          </Button>
        </div>
      </FormDialog>

      {/* ── Attaching a link ──────────────────────────────────────────────── */}
      <FormDialog
        open={!!linking}
        onOpenChange={(o) => !o && setLinking(null)}
        title="Attach a link"
        description={linking?.title}
        submitLabel="Attach"
        size="sm"
        isPending={attachLink.isPending}
        submitDisabled={!link.trim()}
        onSubmit={(e) => {
          e.preventDefault()
          if (linking) attachLink.mutate({ id: linking.id, link: link.trim() })
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="plan-link">Link</Label>
          <Input
            id="plan-link"
            value={link}
            maxLength={2000}
            placeholder="https://"
            onChange={(e) => setLink(e.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            The published post, the folder, the file - wherever the finished thing lives.
          </p>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!withdrawing}
        onOpenChange={(o) => !o && setWithdrawing(null)}
        title="Withdraw this request?"
        description={
          withdrawing
            ? `"${withdrawing.title}" is removed from the plan. Anything already attached to it stays in Documents & assets. You can ask for it again at any time.`
            : ""
        }
        confirmLabel="Withdraw"
        variant="destructive"
        isLoading={withdraw.isPending}
        onConfirm={() => withdrawing && withdraw.mutate(withdrawing.id)}
      />

      {/* ── The verdict ───────────────────────────────────────────────────── */}
      <FormDialog
        open={!!deciding}
        onOpenChange={(o) => !o && setDeciding(null)}
        title={deciding?.finalise ? "Finalise this item?" : "Request changes"}
        description={deciding?.item.title}
        submitLabel={deciding?.finalise ? "Finalise" : "Send back"}
        submitVariant={deciding?.finalise ? "default" : "destructive"}
        size="sm"
        isPending={decide.isPending}
        submitDisabled={!deciding?.finalise && !reason.trim()}
        onSubmit={(e) => {
          e.preventDefault()
          if (!deciding) return
          decide.mutate({
            id: deciding.item.id,
            decision: deciding.finalise ? "FINALISE" : "REQUEST_CHANGES",
            reason: reason.trim(),
          })
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="plan-reason">
            {deciding?.finalise ? "Note (optional)" : "What needs changing?"}
          </Label>
          <Textarea
            id="plan-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder={
              deciding?.finalise
                ? "Anything worth recording alongside the sign-off."
                : "Be specific - this goes straight to the team."
            }
          />
          {deciding?.finalise && (
            <p className="text-muted-foreground text-xs">
              The team can re-open a finalised item if something turns out to be wrong.
            </p>
          )}
        </div>
      </FormDialog>
    </div>
  )
}
