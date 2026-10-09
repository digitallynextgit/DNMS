"use client"

/**
 * Per-recipient outcome for one campaign. "Sent" only means the receiving server accepted it -
 * later bounces go to the sending inbox, never back to DNMS.
 */

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { CheckCircle2, XCircle, Download, Info } from "lucide-react"

import { apiFetch } from "@/lib/api-fetch"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { TableSearch } from "@/components/shared/table-search"
import { TableViewMenu } from "@/components/shared/table-view-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface Send {
  id: string
  email: string
  name: string | null
  status: "PENDING" | "SENDING" | "SENT" | "FAILED"
  error: string | null
  sentAt: string | null
}

type Filter = "all" | "sent" | "failed" | "pending"

const STATUS_LABEL: Record<Send["status"], string> = {
  SENT: "Accepted",
  FAILED: "Rejected",
  PENDING: "Waiting",
  SENDING: "Sending",
}

const COLUMNS: DataTableColumn<Send>[] = [
  {
    header: "Email",
    sortValue: (s) => s.email,
    className: "max-w-[280px] truncate",
    cell: (s) => <span title={s.email}>{s.email}</span>,
  },
  {
    header: "Name",
    sortValue: (s) => s.name,
    className: "text-muted-foreground",
    cell: (s) => s.name ?? "-",
  },
  {
    header: "Outcome",
    sortValue: (s) => STATUS_LABEL[s.status],
    cell: (s) => (
      <>
        <span
          className={cn(
            "inline-flex items-center gap-1",
            s.status === "SENT" && "text-emerald-600 dark:text-emerald-400",
            s.status === "FAILED" && "text-destructive",
          )}
        >
          {s.status === "SENT" ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : s.status === "FAILED" ? (
            <XCircle className="h-3.5 w-3.5" />
          ) : null}
          {STATUS_LABEL[s.status]}
        </span>
        {s.error && (
          <p className="text-destructive mt-0.5 max-w-[280px] truncate text-[10px]" title={s.error}>
            {s.error}
          </p>
        )}
      </>
    ),
  },
  {
    header: "When",
    sortValue: (s) => s.sentAt,
    className: "text-muted-foreground",
    cell: (s) =>
      s.sentAt ? (
        <span suppressHydrationWarning>
          {new Date(s.sentAt).toLocaleString(undefined, {
            day: "numeric",
            month: "short",
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
      ) : (
        "-"
      ),
  },
]

export function CampaignHistoryDialog({
  base,
  campaign,
  onOpenChange,
}: {
  base: string
  /** The campaign to show, or null when closed. */
  campaign: { id: string; name: string; subject: string } | null
  onOpenChange: (open: boolean) => void
}) {
  const [search, setSearch] = React.useState("")
  const [filter, setFilter] = React.useState<Filter>("all")

  const [shownFor, setShownFor] = React.useState<typeof campaign>(null)
  if (campaign !== shownFor) {
    setShownFor(campaign)
    if (campaign) {
      setSearch("")
      setFilter("all")
    }
  }

  const { data, isPending } = useQuery({
    queryKey: ["campaign-sends", campaign?.id],
    queryFn: async () =>
      (await apiFetch<{ data: { data: Send[] } }>(`${base}/campaigns/${campaign?.id}`)).data.data,
    enabled: !!campaign,
  })

  const sends = React.useMemo(() => data ?? [], [data])

  const counts = React.useMemo(() => {
    let sent = 0
    let failed = 0
    let pending = 0
    for (const s of sends) {
      if (s.status === "SENT") sent++
      else if (s.status === "FAILED") failed++
      else pending++
    }
    return { sent, failed, pending, total: sends.length }
  }, [sends])

  const rows = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    return sends.filter((s) => {
      if (filter === "sent" && s.status !== "SENT") return false
      if (filter === "failed" && s.status !== "FAILED") return false
      if (filter === "pending" && (s.status === "SENT" || s.status === "FAILED")) return false
      if (!q) return true
      return s.email.toLowerCase().includes(q) || (s.name ?? "").toLowerCase().includes(q)
    })
  }, [sends, search, filter])

  const outcomes: { value: Filter; label: string; count: number }[] = [
    { value: "all", label: "All", count: counts.total },
    { value: "sent", label: "Accepted", count: counts.sent },
    { value: "failed", label: "Rejected", count: counts.failed },
    ...(counts.pending > 0
      ? [{ value: "pending" as const, label: "Waiting", count: counts.pending }]
      : []),
  ]

  /** Exports what's currently filtered - usually "the ones that failed". */
  function exportCsv() {
    const header = "email,name,status,error,sent_at\n"
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
    const body = rows
      .map((r) =>
        [
          escape(r.email),
          escape(r.name ?? ""),
          escape(STATUS_LABEL[r.status]),
          escape(r.error ?? ""),
          escape(r.sentAt ?? ""),
        ].join(","),
      )
      .join("\n")

    const url = URL.createObjectURL(new Blob([header + body], { type: "text/csv;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `${(campaign?.name ?? "campaign").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${filter}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={!!campaign} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-w-3xl flex-col lg:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-sm">{campaign?.name}</DialogTitle>
          <DialogDescription className="text-xs">{campaign?.subject}</DialogDescription>
        </DialogHeader>

        <div className="text-muted-foreground bg-muted/40 flex items-start gap-2 rounded-sm border p-2.5 text-[11px]">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            <strong className="text-foreground">Accepted</strong> means the receiving mail server
            took the message - it is not proof it reached an inbox. A dead or fake address is often
            accepted and bounced afterwards, and that bounce goes to{" "}
            <strong className="text-foreground">your sending mailbox</strong>, not here. Only{" "}
            <strong className="text-foreground">Rejected</strong> rows were refused outright.
          </p>
        </div>

        <DataTable
          tableId="campaign-sends"
          itemLabel="recipient"
          columns={COLUMNS}
          rows={rows}
          rowKey={(s) => s.id}
          loading={isPending}
          skeletonRows={5}
          columnToggle={false}
          maxHeight="max-h-[50vh]"
          pageKey={`${campaign?.id}|${filter}|${search.trim()}`}
          toolbar={
            <>
              <TableViewMenu
                label="Outcome"
                value={filter}
                options={outcomes}
                onChange={setFilter}
              />
              <TableSearch value={search} onChange={setSearch} placeholder="Search name or email" />
            </>
          }
          // Its own CSV: separate status and error columns, named after the campaign and view.
          toolbarEnd={
            <Button
              className="gap-1.5"
              variant="outline"
              disabled={rows.length === 0}
              onClick={exportCsv}
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
          }
          empty="Nothing matches that filter."
          footerNote={
            sends.length >= 1000
              ? "Showing the first 1,000 recipients of this campaign."
              : undefined
          }
        />
      </DialogContent>
    </Dialog>
  )
}
