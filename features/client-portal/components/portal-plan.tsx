"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  AlertTriangle,
  CalendarRange,
  ChevronDown,
  Copy,
  Download,
  Eye,
  FileText,
  FileVideo,
  Link2,
  Link2Off,
  Paperclip,
  Plus,
  Trash2,
  Upload,
} from "lucide-react"

import { apiFetch } from "@/lib/api-fetch"
import { exportToCsv } from "@/lib/export-csv"
import { exportToXlsx } from "@/lib/export-xlsx"
import { exportToDocx } from "@/lib/export-docx"
import { useRowSelection } from "@/hooks/use-row-selection"
import { BulkActionBar } from "@/components/shared/bulk-action-bar"
import {
  ALLOWED_FILE_TYPES,
  ALLOWED_FILE_EXTENSIONS,
  ALLOWED_VIDEO_TYPES,
  ALLOWED_VIDEO_EXTENSIONS,
} from "@/lib/constants"
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
import { DELIVERABLE_STATUS_COLORS, DELIVERABLE_STATUS_DOTS } from "@/lib/constants"
import {
  DELIVERABLE_STATUS_LABELS,
  allowedTransition,
  nextActions,
  type DeliverableStatus,
} from "@/features/projects/lib/deliverable-lifecycle"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

/** What the file picker offers, kept in step with what the server accepts. */
const UPLOAD_ACCEPT = [
  ...ALLOWED_FILE_TYPES,
  ...ALLOWED_FILE_EXTENSIONS,
  ...ALLOWED_VIDEO_TYPES,
  ...ALLOWED_VIDEO_EXTENSIONS,
].join(",")

interface PlanFile {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
  /** The public share URL, or null when the file has no live link. Video only. */
  shareUrl: string | null
  isPublicLink: boolean
  /** This client uploaded it, so it is theirs to remove. */
  isMine: boolean
}

interface PlanItem {
  id: string
  type: string
  title: string
  quantity: number
  deliveredQuantity: number
  status: DeliverableStatus
  /** Why it is stuck or discarded. Null on every other status. */
  statusReason: string | null
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
  /** Files + links already attached, against `quantity`. Counted on the server. */
  attached: number
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

/** One shared empty list, so "no items yet" is a stable reference. See its use. */
const NO_ITEMS: PlanItem[] = []

/**
 * The export, in one place - all three formats write the same columns.
 *
 * "Files" is a COUNT and "File names" is the list, because a spreadsheet cell
 * holding eight filenames cannot be summed and a column of 8s cannot tell you
 * what was delivered. Both, and each does one job.
 *
 * "Links" carries every URL on the row that will STILL WORK tomorrow: whatever
 * was pasted on the item, plus one url per file. The raw Backblaze url is never
 * among them - it is signed and dies within the hour, so a file full of them
 * would break overnight. See `fileUrl` for which url each file gets instead.
 */
const EXPORT_COLUMNS = [
  "Item",
  "Kind",
  "Planned for",
  "Due",
  "Planned",
  "Made",
  "Status",
  "Reason",
  "Files",
  "File names",
  "Links",
] as const

const todayYmd = () => new Date().toISOString().slice(0, 10)

/**
 * Does this move need a reason before it can be sent?
 *
 * Asked of the shared transition table rather than hard-coded as "stuck or
 * discarded", so the dialog and the server can never disagree about it.
 */
const transitionNeedsReason = (from: DeliverableStatus, to: DeliverableStatus): boolean => {
  const check = allowedTransition(from, to, "client")
  return check.ok && check.needs.includes("reason")
}

/** "14-18 Sep 2026" for a row's window, or a dash where it has none. */
function periodLabel(start: string | null, end: string | null): string {
  const a = parseDay(start)
  const b = parseDay(end)
  return a && b ? formatPeriod(a, b) : "—"
}

export function PortalPlan({ projectRef }: { projectRef: string }) {
  const qc = useQueryClient()
  const base = `/api/portal/projects/${projectRef}/plan`
  // Absolute urls for the export - a relative path in a spreadsheet is not a
  // link. Guarded for the server pass, where `window` does not exist.
  const origin = typeof window === "undefined" ? "" : window.location.origin

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["portal-plan", projectRef],
    queryFn: async () => (await apiFetch<{ data: { data: PlanPayload } }>(base)).data.data,
    staleTime: 30_000,
  })

  const [planning, setPlanning] = React.useState(false)
  const [from, setFrom] = React.useState(todayYmd)
  const [to, setTo] = React.useState(todayYmd)
  const [lines, setLines] = React.useState<DraftLine[]>([emptyLine()])

  /** The move waiting on a reason - "stuck" or "discarded". */
  const [stopping, setStopping] = React.useState<{ item: PlanItem; to: DeliverableStatus } | null>(
    null,
  )
  const [reason, setReason] = React.useState("")

  const [linking, setLinking] = React.useState<PlanItem | null>(null)
  const [link, setLink] = React.useState("")
  const [withdrawing, setWithdrawing] = React.useState<PlanItem | null>(null)
  const [revoking, setRevoking] = React.useState<PlanFile | null>(null)
  const [deletingAsset, setDeletingAsset] = React.useState<PlanFile | null>(null)
  /** The item whose files are open in the dialog. */
  const [viewingAssets, setViewingAssets] = React.useState<PlanItem | null>(null)
  const [deletingMany, setDeletingMany] = React.useState(false)
  /** Covers the dynamic import of the Excel/Word libraries, which is not instant. */
  const [exporting, setExporting] = React.useState(false)

  const uploadFor = React.useRef<string | null>(null)
  const fileInput = React.useRef<HTMLInputElement>(null)

  // `move()` clears the note when it opens the dialog, so there is no stale
  // value to reset here.

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

  const setStatus = useMutation({
    mutationFn: (vars: { id: string; status: DeliverableStatus; reason?: string }) =>
      apiFetch(`${base}/${vars.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: vars.status, reason: vars.reason ?? "" }),
      }),
    onSuccess: (_d, vars) => {
      toast.success(`Moved to ${DELIVERABLE_STATUS_LABELS[vars.status].toLowerCase()}`)
      setStopping(null)
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  /**
   * Apply a move, stopping off for a reason when the transition needs one.
   *
   * Which ones need it is read from the SAME table the server checks, so the
   * dialog cannot appear for a move that would not want it, or be skipped for
   * one that would then 422.
   */
  const move = (item: PlanItem, to: DeliverableStatus) => {
    if (transitionNeedsReason(item.status, to)) {
      setStopping({ item, to })
      setReason("")
      return
    }
    setStatus.mutate({ id: item.id, status: to })
  }

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
      // A video can be hundreds of MB and take minutes. Without a pending toast
      // the only feedback is one disabled button, which reads as "nothing
      // happened" and invites a second upload of the same file.
      const toastId = toast.loading(
        vars.file.size > 25 * 1024 * 1024
          ? `Uploading ${vars.file.name} - large files can take a few minutes`
          : `Uploading ${vars.file.name}`,
      )
      try {
        return await apiFetch<{
          data: { data: { shareUrl: string | null; isVideo: boolean } }
        }>(`${base}/${vars.id}/file`, { method: "POST", body: form })
      } finally {
        toast.dismiss(toastId)
      }
    },
    onSuccess: (res) => {
      const d = res.data.data
      if (d.isVideo && d.shareUrl) {
        // Offer the link immediately - copying it is the reason the video was
        // uploaded, and making them find the row again to do it is friction for
        // nothing.
        toast.success("Video attached and shareable", {
          duration: 12_000,
          action: { label: "Copy link", onClick: () => copyShareLink(d.shareUrl!) },
        })
      } else {
        toast.success("File attached")
      }
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteAsset = useMutation({
    mutationFn: (fileId: string) => apiFetch(`${base}/assets/${fileId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("File removed")
      setDeletingAsset(null)
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const revokeShare = useMutation({
    mutationFn: (fileId: string) =>
      apiFetch(`${base}/assets/${fileId}/share`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Link revoked - it no longer opens for anyone")
      setRevoking(null)
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  /**
   * Export the selected rows as CSV, in the browser.
   *
   * No server round trip - everything on screen is already here, and a download
   * endpoint would need its own auth, its own shape and its own drift.
   */
  /**
   * A url for one file that is still good next week.
   *
   * Prefers the PUBLIC share link when the file has one, because that opens for
   * anybody the spreadsheet is forwarded to. Otherwise the portal permalink,
   * which is permanent but asks the reader to sign in - the right default for
   * work that was never published.
   *
   * Never a signed Backblaze url: those expire in an hour, and a file full of
   * links that break overnight is worse than a file with none.
   */
  const fileUrl = (f: PlanFile): string => f.shareUrl ?? `${origin}${base}/assets/${f.id}/open`

  const exportRows = () =>
    (selectedItems.length > 0 ? selectedItems : items).map((i) => [
      i.title,
      i.type,
      periodLabel(i.periodStart, i.periodEnd),
      // yyyy-MM-dd rather than "14 Sep 2026": a spreadsheet sorts the first and
      // treats the second as text.
      i.dueOn ?? "",
      i.quantity,
      i.deliveredQuantity,
      DELIVERABLE_STATUS_LABELS[i.status],
      i.statusReason ?? "",
      i.files.length,
      // NEWLINES, not "; ": eight urls on one line runs off the page in every
      // format. All three writers handle a line break inside a cell - CSV quotes
      // it, Excel wraps it, Word makes it its own paragraph.
      i.files.map((f) => f.fileName).join("\n"),
      // One working url per file, plus whatever links were pasted on the row.
      [...i.links, ...i.files.map(fileUrl)].join("\n"),
    ])

  async function runExport(kind: "xlsx" | "csv" | "docx") {
    const rows = exportRows()
    if (rows.length === 0) return
    const base = `content-plan-${new Date().toISOString().slice(0, 10)}`
    setExporting(true)
    try {
      if (kind === "csv") exportToCsv([...EXPORT_COLUMNS], rows, `${base}.csv`)
      else if (kind === "xlsx")
        await exportToXlsx([...EXPORT_COLUMNS], rows, `${base}.xlsx`, "Content plan")
      else
        await exportToDocx(
          [...EXPORT_COLUMNS],
          rows,
          `${base}.docx`,
          data?.projectName ? `Content plan - ${data.projectName}` : "Content plan",
        )
      toast.success(`Exported ${rows.length} row${rows.length === 1 ? "" : "s"}`)
    } catch (e) {
      // A dynamic import can fail on a flaky connection, and a silent no-op
      // looks exactly like a button that does not work.
      toast.error(e instanceof Error ? e.message : "Export failed")
    } finally {
      setExporting(false)
    }
  }

  const removeMany = useMutation({
    mutationFn: async (ids: string[]) => {
      // Sequential on purpose: these are deletes, and a half-applied burst is
      // harder to explain than a slightly slower one. The list is small - it is
      // whatever somebody ticked by hand.
      const failed: string[] = []
      for (const id of ids) {
        try {
          await apiFetch(`${base}/${id}`, { method: "DELETE" })
        } catch {
          failed.push(id)
        }
      }
      return { ok: ids.length - failed.length, failed: failed.length }
    },
    onSuccess: ({ ok, failed }) => {
      if (failed > 0) toast.warning(`Withdrew ${ok}; ${failed} could not be withdrawn`)
      else toast.success(`Withdrew ${ok} item${ok === 1 ? "" : "s"}`)
      setDeletingMany(false)
      selection.clear()
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

  /** Put a public Drive link on the clipboard. */
  async function copyShareLink(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Link copied - anyone with it can watch, no sign-in needed")
    } catch {
      // Clipboard access is denied outside a secure context and in some
      // embedded browsers. Showing the URL still lets them copy it by hand.
      toast.error(`Could not copy. The link is: ${url}`, { duration: 15_000 })
    }
  }

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

  // `?? NO_ITEMS` rather than `?? []`: the selection hook keys its callbacks off
  // the id list, and a fresh [] on every render would rebuild them each time.
  // This way `items` is always a stable reference - the query's array, or the
  // one module-level empty - and needs no memo of its own.
  const items = data?.items ?? NO_ITEMS
  const canPlan = data?.canPlan ?? false

  // Selection: for exporting and removing rows. Deliberately NOT wired to
  // status - a status change is a statement about one piece of work, and the
  // reason Stuck and Discarded demand is rarely the same for several at once.
  const itemIds = React.useMemo(() => (data?.items ?? NO_ITEMS).map((i) => i.id), [data])
  const selection = useRowSelection(itemIds)
  const selectedItems = items.filter((i) => selection.isSelected(i.id))
  // The same rule the single-row button obeys, asked of every selected row.
  const removable = selectedItems.filter((i) => i.canWithdraw)

  // Units, not rows, for planned/made - "10 posters" is one row and ten things.
  // "Waiting on you" and "Finalised" went with the approval loop; in its place
  // the two states somebody has to do something about.
  const counts = {
    planned: items.reduce((n, i) => n + i.quantity, 0),
    made: items.reduce((n, i) => n + Math.min(i.deliveredQuantity, i.quantity), 0),
    inProgress: items.filter((i) => i.status === "IN_PROGRESS").length,
    stuck: items.filter((i) => i.status === "STUCK").length,
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
  //
  // The CELL is only ever one line: a count that opens a dialog. Expanding the
  // list in place made a row nine lines tall, which moved every column below it
  // and pushed the rest of the plan off the screen - the table stopped being a
  // table the moment anybody looked at their files.
  function Assets({ item }: { item: PlanItem }) {
    const total = item.files.length + item.links.length
    if (total === 0) return <span className="text-muted-foreground text-xs">—</span>

    return (
      <button
        type="button"
        onClick={() => setViewingAssets(item)}
        className="text-muted-foreground hover:text-foreground -ml-1 flex items-center gap-1 rounded-sm px-1 py-0.5 text-xs"
        aria-label={`Open the files attached to ${item.title}`}
        title="Open the files"
      >
        <Paperclip className="h-3 w-3 shrink-0" />
        {item.files.length > 0 && (
          <span className="whitespace-nowrap">
            {item.files.length} file{item.files.length === 1 ? "" : "s"}
          </span>
        )}
        {item.files.length > 0 && item.links.length > 0 && <span aria-hidden>·</span>}
        {item.links.length > 0 && (
          <span className="whitespace-nowrap">
            {item.links.length} link{item.links.length === 1 ? "" : "s"}
          </span>
        )}
      </button>
    )
  }

  /** The same files and links, with room to read them, in a dialog. */
  function AssetsBody({ item }: { item: PlanItem }) {
    return (
      <div className="space-y-4">
        {item.files.length > 0 && (
          <div className="space-y-1">
            {item.files.map((f) => {
              const isVideo = f.mimeType.startsWith("video/")
              const Icon = isVideo ? FileVideo : FileText
              return (
                <div
                  key={f.id}
                  className="hover:bg-accent/40 flex items-center gap-2 rounded-sm px-1 py-1"
                >
                  <Icon className="text-muted-foreground h-4 w-4 shrink-0" />
                  {/* A dialog has the width the cell never did, so the name gets
                      to be readable instead of "WhatsApp Image 2026-09-1...". */}
                  <span className="min-w-0 flex-1 truncate text-sm" title={f.fileName}>
                    {f.fileName}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap">
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
                  {f.isPublicLink && f.shareUrl && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyShareLink(f.shareUrl!)}
                        aria-label={`Copy the shareable link for ${f.fileName}`}
                        title="Copy shareable link - anyone with it can watch, no sign-in"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      {/* The link is only defensible because it can be taken back,
                      so the way to take it back has to be right here. */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive h-6 w-6"
                        disabled={revokeShare.isPending}
                        onClick={() => setRevoking(f)}
                        aria-label={`Revoke the shareable link for ${f.fileName}`}
                        title="Revoke the shareable link"
                      >
                        <Link2Off className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                  {/* Only on their own uploads - the same question the server asks,
                  so this button can never produce a 404. */}
                  {f.isMine && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive h-6 w-6"
                      disabled={deleteAsset.isPending}
                      onClick={() => setDeletingAsset(f)}
                      aria-label={`Delete ${f.fileName}`}
                      title="Delete this file"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {item.links.length > 0 && (
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs font-medium">Links</p>
            {item.links.map((l) => (
              <div key={l} className="flex items-center gap-2 rounded-sm px-1 py-1">
                <Link2 className="text-muted-foreground h-4 w-4 shrink-0" />
                <a
                  href={l}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary min-w-0 flex-1 truncate text-sm underline-offset-2 hover:underline"
                  title={l}
                >
                  {l}
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  /**
   * The status, and the way to change it.
   *
   * The moves offered come from `nextActions(status, "client")` - the same table
   * the server checks the request against - so a button here can never be one
   * the server then refuses.
   */
  function StatusCell({ item }: { item: PlanItem }) {
    const moves = nextActions(item.status, "client")
    const badge = (
      <StatusBadge
        status={item.status}
        colorMap={DELIVERABLE_STATUS_COLORS}
        labelMap={DELIVERABLE_STATUS_LABELS}
        size="xs"
      />
    )

    return (
      <div className="min-w-0 space-y-1">
        {moves.length === 0 ? (
          badge
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={setStatus.isPending}
                className="flex items-center gap-1 rounded-sm disabled:opacity-60"
                aria-label={`Change the status of ${item.title}`}
                title="Change the status"
              >
                {badge}
                <ChevronDown className="text-muted-foreground h-3 w-3 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {moves.map((to) => (
                <DropdownMenuItem key={to} onSelect={() => move(item, to)} className="gap-2">
                  {/* The same colour the badge will wear once it is chosen, so
                      picking a status and reading it back are the same act. */}
                  <span
                    aria-hidden
                    className={`h-2 w-2 shrink-0 rounded-full ${DELIVERABLE_STATUS_DOTS[to]}`}
                  />
                  {DELIVERABLE_STATUS_LABELS[to]}
                  {transitionNeedsReason(item.status, to) && (
                    <span className="text-muted-foreground ml-auto pl-2 text-[10px]">
                      needs a reason
                    </span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {/* The reason is the whole point of those two states - a row that says
            "Stuck" without saying on what is no more useful than "To do". */}
        {item.statusReason && (
          <p
            className="text-muted-foreground max-w-[12rem] text-[11px] leading-snug"
            title={item.statusReason}
          >
            {item.statusReason}
          </p>
        )}
      </div>
    )
  }

  // ── Row actions: attaching work, and withdrawing a request ────────────────
  // Moving the row between states lives in the Status column now, not here.
  function Actions({ item }: { item: PlanItem }) {
    // A finalised row is the staff side's to re-open; a discarded one is not
    // collecting attachments either.
    const canAttach = item.status !== "ACCEPTED" && item.status !== "DISCARDED"
    // The same budget the server enforces: an item planned for N takes N
    // attachments, files and links together. Disabling here means nobody sits
    // through a 200 MB upload that was always going to be refused.
    const full = item.attached >= item.quantity
    const capacityNote = `${item.attached} of ${item.quantity} attached`
    return (
      <div className="flex flex-wrap items-center justify-end gap-1">
        {canAttach && (
          <>
            {full && (
              <span className="text-muted-foreground mr-1 text-[10px] whitespace-nowrap">
                {capacityNote}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              disabled={full}
              onClick={() => {
                setLinking(item)
                setLink("")
              }}
              aria-label={`Attach a link to ${item.title}`}
              title={
                full
                  ? `${capacityNote} - remove one first, or ask the team to raise the quantity`
                  : "Attach a link"
              }
            >
              <Link2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={attachFile.isPending || full}
              onClick={() => {
                uploadFor.current = item.id
                fileInput.current?.click()
              }}
              aria-label={`Upload a file for ${item.title}`}
              title={
                full
                  ? `${capacityNote} - remove one first, or ask the team to raise the quantity`
                  : "Upload a file"
              }
            >
              <Upload className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
        {/* Finalise / Changes used to live here. The portal tracks where work
            has got to rather than passing a verdict on it, so the status
            dropdown in the Status column is now the whole flow - and the two
            verdict moves went back to the staff side. */}
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
        // Same shape as "Planned for" beside it. These read as two different
        // kinds of date when one says "14 Sep 2026" and the next "14/09/2026".
        <span className="text-xs whitespace-nowrap">
          {r.dueOn ? formatDate(r.dueOn, "d MMM yyyy") : "—"}
        </span>
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
      cell: (r) => <StatusCell item={r} />,
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
            { label: "In progress", value: counts.inProgress },
            { label: "Stuck", value: counts.stuck, tone: "warning" },
          ]}
        />
      )}

      {items.length > 0 && (
        <BulkActionBar count={selection.count} onClear={selection.clear}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="gap-1.5"
                disabled={exporting || items.length === 0}
              >
                <Download className="h-3.5 w-3.5" />
                Export
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem
                onClick={() => void runExport("xlsx")}
                className="flex-col items-start gap-0.5"
              >
                <span>Excel (.xlsx)</span>
                <span className="text-muted-foreground text-[11px]">
                  Header frozen, links wrapped
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => void runExport("csv")}
                className="flex-col items-start gap-0.5"
              >
                <span>CSV</span>
                <span className="text-muted-foreground text-[11px]">Opens anywhere</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => void runExport("docx")}
                className="flex-col items-start gap-0.5"
              >
                <span>Word (.docx)</span>
                <span className="text-muted-foreground text-[11px]">
                  A table to read and annotate
                </span>
              </DropdownMenuItem>
              {/* Says what is in the file BEFORE it is opened - the difference
                  between a selection and the whole plan is the kind of thing
                  people notice after they have sent it on. */}
              <p className="text-muted-foreground border-t px-2 py-1.5 text-[11px]">
                {selection.count > 0
                  ? `${selection.count} selected row${selection.count === 1 ? "" : "s"}`
                  : `All ${items.length} row${items.length === 1 ? "" : "s"}`}
              </p>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="destructive"
            className="gap-1.5"
            // Withdrawing is only ever allowed on your OWN untouched requests,
            // so a selection containing none of those has nothing to do.
            disabled={removable.length === 0 || removeMany.isPending}
            title={
              removable.length === 0
                ? "None of these can be withdrawn - they are the team's, or already underway"
                : `Withdraw ${removable.length} of ${selection.count}`
            }
            onClick={() => setDeletingMany(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Withdraw{removable.length !== selection.count && ` (${removable.length})`}
          </Button>
        </BulkActionBar>
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
          selection={selection}
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
        // Named types rather than a bare "video/*": the picker should offer
        // exactly what the server will take, so a rejection happens before a
        // 200 MB upload rather than after it.
        accept={UPLOAD_ACCEPT}
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

      <ConfirmDialog
        open={!!revoking}
        onOpenChange={(o) => !o && setRevoking(null)}
        title="Revoke this share link?"
        description={
          revoking
            ? `The link to "${revoking.fileName}" stops working for everyone you sent it to. The video itself stays here. Uploading it again creates a new link.`
            : ""
        }
        confirmLabel="Revoke link"
        variant="destructive"
        isLoading={revokeShare.isPending}
        onConfirm={() => revoking && revokeShare.mutate(revoking.id)}
      />

      {/* ── The files, with room to read them ─────────────────────────────── */}
      <FormDialog
        open={!!viewingAssets}
        onOpenChange={(o) => !o && setViewingAssets(null)}
        title={viewingAssets ? `Files for "${viewingAssets.title}"` : ""}
        description={
          viewingAssets
            ? `${viewingAssets.attached} of ${viewingAssets.quantity} attached`
            : undefined
        }
        submitLabel="Done"
        // Nothing to submit - everything here acts immediately. The footer
        // button is just the way out.
        onSubmit={(e) => {
          e.preventDefault()
          setViewingAssets(null)
        }}
      >
        {/* Read from `items` rather than the captured item, so deleting a file
            updates the open dialog instead of leaving a row that 404s. */}
        {viewingAssets &&
          (() => {
            const live = items.find((i) => i.id === viewingAssets.id)
            if (!live || live.files.length + live.links.length === 0) {
              return <p className="text-muted-foreground text-sm">Nothing attached any more.</p>
            }
            return <AssetsBody item={live} />
          })()}
      </FormDialog>

      <ConfirmDialog
        open={deletingMany}
        onOpenChange={(o) => !o && setDeletingMany(false)}
        title={`Withdraw ${removable.length} item${removable.length === 1 ? "" : "s"}?`}
        description={
          removable.length === selection.count
            ? "They are removed from the plan. Anything already attached to them stays in Documents & assets."
            : `${removable.length} of the ${selection.count} selected can be withdrawn - the rest are the team's own, or already underway, and are left alone.`
        }
        confirmLabel="Withdraw"
        variant="destructive"
        isLoading={removeMany.isPending}
        onConfirm={() => removeMany.mutate(removable.map((i) => i.id))}
      />

      <ConfirmDialog
        open={!!deletingAsset}
        onOpenChange={(o) => !o && setDeletingAsset(null)}
        title="Delete this file?"
        description={
          deletingAsset
            ? `"${deletingAsset.fileName}" is removed from the item and deleted from storage.${
                deletingAsset.isPublicLink ? " Its share link stops working for everyone." : ""
              } This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        variant="destructive"
        isLoading={deleteAsset.isPending}
        onConfirm={() => deletingAsset && deleteAsset.mutate(deletingAsset.id)}
      />

      {/* ── Stopping work: why ────────────────────────────────────────────── */}
      <FormDialog
        open={!!stopping}
        onOpenChange={(o) => !o && setStopping(null)}
        title={stopping?.to === "STUCK" ? "What is it waiting on?" : "Why was it dropped?"}
        description={stopping?.item.title}
        submitLabel={stopping?.to === "STUCK" ? "Mark as stuck" : "Discard"}
        submitVariant={stopping?.to === "DISCARDED" ? "destructive" : "default"}
        size="sm"
        isPending={setStatus.isPending}
        submitDisabled={!reason.trim()}
        onSubmit={(e) => {
          e.preventDefault()
          if (!stopping) return
          setStatus.mutate({
            id: stopping.item.id,
            status: stopping.to,
            reason: reason.trim(),
          })
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="plan-reason">
            {stopping?.to === "STUCK" ? "What is blocking it?" : "Why is it being dropped?"}
          </Label>
          <Textarea
            id="plan-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder={
              stopping?.to === "STUCK"
                ? "Waiting on the venue photos, for example. The team sees this."
                : "Cancelled by the organisers, for example."
            }
          />
          <p className="text-muted-foreground text-xs">
            {stopping?.to === "STUCK"
              ? "It stays on the plan and still counts as owed - being stuck is exactly what this flags."
              : "It stops counting as owed, and stops counting as made. You can put it back on the plan later."}
          </p>
        </div>
      </FormDialog>
    </div>
  )
}
