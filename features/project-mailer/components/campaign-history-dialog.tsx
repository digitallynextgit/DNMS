"use client"

/**
 * Per-recipient outcome for one campaign.
 *
 * The honest framing matters here and is stated in the UI, not just in this
 * comment: a row marked Sent means the RECEIVING MAIL SERVER ACCEPTED the
 * message, which is the last thing SMTP tells us. A dead mailbox is very often
 * accepted and then bounced minutes later, and that bounce goes to the sending
 * inbox - never back to DNMS. So this screen can prove what was rejected on the
 * spot; it cannot prove what landed.
 *
 * Calling that out is the difference between a useful list-cleaning tool and one
 * that quietly certifies 314 dead addresses as reachable.
 */

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { CheckCircle2, XCircle, Search, Download, Info } from "lucide-react"

import { apiFetch } from "@/lib/api-fetch"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
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

  React.useEffect(() => {
    if (campaign) {
      setSearch("")
      setFilter("all")
    }
  }, [campaign])

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

  /**
   * Export what is CURRENTLY filtered, not the whole campaign: the reason to
   * open this screen is usually "give me the ones that failed" so I can take
   * them off the list.
   */
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
      <DialogContent className="flex max-h-[88vh] max-w-3xl flex-col lg:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-sm">{campaign?.name}</DialogTitle>
          <DialogDescription className="text-xs">{campaign?.subject}</DialogDescription>
        </DialogHeader>

        {/* The distinction the whole screen turns on. */}
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

        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { key: "all", label: "All", n: counts.total },
              { key: "sent", label: "Accepted", n: counts.sent },
              { key: "failed", label: "Rejected", n: counts.failed },
              ...(counts.pending > 0
                ? [{ key: "pending" as const, label: "Waiting", n: counts.pending }]
                : []),
            ] as { key: Filter; label: string; n: number }[]
          ).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-[11px] transition-colors",
                filter === f.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground",
              )}
            >
              <span className="font-medium">{f.label}</span>
              <span className="tabular-nums opacity-70">{f.n}</span>
            </button>
          ))}

          <div className="relative ml-auto">
            <Search className="text-muted-foreground absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="h-8 w-40 pl-7 text-xs"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            disabled={rows.length === 0}
            onClick={exportCsv}
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-sm border">
          {isPending ? (
            <div className="space-y-1 p-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-9 rounded" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground p-4 text-center text-xs">
              Nothing matches that filter.
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-muted-foreground sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Email</th>
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-left font-medium">Outcome</th>
                  <th className="px-3 py-2 text-left font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="px-3 py-2">{s.email}</td>
                    <td className="text-muted-foreground px-3 py-2">{s.name ?? "-"}</td>
                    <td className="px-3 py-2">
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
                      {/* The provider's own words - "mailbox unavailable" is the
                          line that tells you to drop the address. */}
                      {s.error && (
                        <p className="text-destructive mt-0.5 text-[10px] break-words">{s.error}</p>
                      )}
                    </td>
                    <td className="text-muted-foreground px-3 py-2 whitespace-nowrap">
                      {s.sentAt ? (
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
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {sends.length >= 1000 && (
          <p className="text-muted-foreground text-[11px]">
            Showing the first 1,000 recipients of this campaign.
          </p>
        )}
        <Badge variant="outline" className="w-fit text-[10px]">
          {rows.length} shown
        </Badge>
      </DialogContent>
    </Dialog>
  )
}
