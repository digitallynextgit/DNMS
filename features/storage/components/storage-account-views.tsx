"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import {
  HardDrive,
  Pencil,
  Trash2,
  Star,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Plug,
  MoreHorizontal,
} from "lucide-react"

import { apiFetch } from "@/lib/api-fetch"
import { cn, formatDate } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { StorageAccount } from "./storage-accounts"

interface Usage {
  totalFiles: number
  totalBytes: number
  freeTierBytes: number
  reachable: boolean
  error?: string
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  let n = bytes
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}

/** Per-account usage, so one slow or unreachable bucket can't hold up or blank the whole page. */
export function useAccountUsage(accountId: string) {
  return useQuery({
    queryKey: ["storage-account-usage", accountId],
    queryFn: async () =>
      (await apiFetch<{ data: Usage }>(`/api/admin/storage-accounts/${accountId}/usage`)).data,
    staleTime: 60_000,
  })
}

function UsageBar({ accountId }: { accountId: string }) {
  const { data, isPending } = useAccountUsage(accountId)

  if (isPending) {
    return (
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-1.5 w-full rounded-sm" />
      </div>
    )
  }
  if (!data?.reachable) {
    return (
      <p className="text-destructive flex items-center gap-1 text-[11px]">
        <AlertTriangle className="h-3 w-3 shrink-0" />
        Could not read this bucket
      </p>
    )
  }

  const pct = data.freeTierBytes ? (data.totalBytes / data.freeTierBytes) * 100 : 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs">
          <span className="font-medium">{formatBytes(data.totalBytes)}</span>
          <span className="text-muted-foreground"> of {formatBytes(data.freeTierBytes)}</span>
        </p>
        <span className="text-muted-foreground text-[11px] tabular-nums">{pct.toFixed(1)}%</span>
      </div>
      {/* Floored at 1% while non-zero, so a nearly empty bucket still shows a sliver. */}
      <Progress value={pct > 0 ? Math.max(pct, 1) : 0} className="h-1.5" />
      <p className="text-muted-foreground text-[11px]">
        {data.totalFiles} file{data.totalFiles === 1 ? "" : "s"} ·{" "}
        {formatBytes(Math.max(0, data.freeTierBytes - data.totalBytes))} free
      </p>
    </div>
  )
}

/** Default / off / verification state - shared, so the two views cannot drift. */
function AccountBadges({ account: a }: { account: StorageAccount }) {
  return (
    <>
      {a.isDefault && <Badge className="text-[10px]">Default</Badge>}
      {!a.isActive && (
        <Badge variant="secondary" className="text-[10px]">
          Off
        </Badge>
      )}
      {a.lastError ? (
        <Badge variant="outline" className="text-destructive gap-1 text-[10px]">
          <AlertTriangle className="h-3 w-3" />
          Test failed
        </Badge>
      ) : a.lastVerifiedAt ? (
        <Badge variant="outline" className="gap-1 text-[10px] text-emerald-600">
          <CheckCircle2 className="h-3 w-3" />
          Verified {formatDate(a.lastVerifiedAt, "dd MMM")}
        </Badge>
      ) : (
        <Badge variant="outline" className="text-muted-foreground text-[10px]">
          Not tested
        </Badge>
      )}
    </>
  )
}

export interface RowActions {
  onOpen: (a: StorageAccount) => void
  onEdit: (a: StorageAccount) => void
  onRemove: (a: StorageAccount) => void
  onTest: (a: StorageAccount) => void
  onMakeDefault: (a: StorageAccount) => void
}

export function AccountCard({
  account: a,
  busy,
  onOpen,
  onEdit,
  onRemove,
  onTest,
  onMakeDefault,
}: { account: StorageAccount; busy: boolean } & RowActions) {
  return (
    <div
      className={cn(
        "group bg-card hover:border-foreground/20 hover:bg-muted/30 relative flex flex-col gap-3 rounded-sm border p-4 transition-colors",
        !a.isActive && "opacity-60",
      )}
    >
      {/* Stretched link: a sibling overlay makes the whole card clickable; buttons sit above it (z-10). */}
      <button
        type="button"
        onClick={() => onOpen(a)}
        aria-label={`Open ${a.label}`}
        className="focus-visible:ring-ring absolute inset-0 rounded-sm focus-visible:ring-2 focus-visible:outline-none"
      />

      <div className="flex items-start justify-between gap-2">
        <span className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-sm">
          <HardDrive className="text-muted-foreground h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-sm font-medium group-hover:underline">{a.label}</p>
          <p className="text-muted-foreground mt-0.5 truncate font-mono text-xs">{a.bucket}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative z-10 shrink-0"
              aria-label="More actions"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MoreHorizontal className="h-4 w-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="z-20">
            <DropdownMenuItem onClick={() => onOpen(a)}>Browse files</DropdownMenuItem>
            <DropdownMenuItem disabled={busy} onClick={() => onTest(a)}>
              Test connection
            </DropdownMenuItem>
            {!a.isDefault && a.isActive && (
              <DropdownMenuItem onClick={() => onMakeDefault(a)}>Make default</DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onEdit(a)}>Edit</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => onRemove(a)}>
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="relative z-10 flex flex-wrap items-center gap-1">
        <AccountBadges account={a} />
      </div>

      <div className="relative z-10">
        <UsageBar accountId={a.id} />
      </div>

      {a.lastError && <p className="text-destructive line-clamp-2 text-[11px]">{a.lastError}</p>}
    </div>
  )
}

function UsageCell({ accountId }: { accountId: string }) {
  const { data, isPending } = useAccountUsage(accountId)
  if (isPending) return <Skeleton className="h-4 w-24" />
  if (!data?.reachable) return <span className="text-destructive text-xs">Unreadable</span>

  const pct = data.freeTierBytes ? (data.totalBytes / data.freeTierBytes) * 100 : 0
  return (
    <div className="min-w-32 space-y-1">
      <p className="text-xs whitespace-nowrap">
        {formatBytes(data.totalBytes)}
        <span className="text-muted-foreground"> / {formatBytes(data.freeTierBytes)}</span>
      </p>
      <Progress value={pct > 0 ? Math.max(pct, 1) : 0} className="h-1" />
    </div>
  )
}

function FilesCell({ accountId }: { accountId: string }) {
  const { data, isPending } = useAccountUsage(accountId)
  if (isPending) return <Skeleton className="h-4 w-10" />
  return <span className="text-xs tabular-nums">{data?.reachable ? data.totalFiles : "-"}</span>
}

export function AccountTable({
  accounts,
  testingId,
  onOpen,
  onEdit,
  onRemove,
  onTest,
  onMakeDefault,
}: { accounts: StorageAccount[]; testingId: string | null } & RowActions) {
  const columns: DataTableColumn<StorageAccount>[] = [
    {
      header: "Name",
      className: "text-xs font-medium",
      sortValue: (a) => a.label,
      cell: (a) => a.label,
    },
    {
      header: "Bucket",
      className: "font-mono text-[11px]",
      sortValue: (a) => a.bucket,
      cell: (a) => a.bucket,
    },
    {
      header: "Region",
      className: "text-muted-foreground font-mono text-[11px]",
      sortValue: (a) => a.region,
      cell: (a) => a.region,
    },
    { header: "Files", align: "right", cell: (a) => <FilesCell accountId={a.id} /> },
    { header: "Used", cell: (a) => <UsageCell accountId={a.id} /> },
    {
      header: "Status",
      cell: (a) => (
        <div className="flex items-center gap-1">
          <AccountBadges account={a} />
        </div>
      ),
    },
    {
      header: "Actions",
      align: "right",
      cell: (a) => (
        // The row opens the bucket; these buttons must not.
        <div
          className="flex items-center justify-end gap-0.5"
          onClick={(e) => e.stopPropagation()}
          role="presentation"
        >
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Test ${a.label}`}
            title="Test connection"
            disabled={testingId === a.id}
            onClick={() => onTest(a)}
          >
            {testingId === a.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plug className="h-3.5 w-3.5" />
            )}
          </Button>
          {!a.isDefault && a.isActive && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Make ${a.label} the default`}
              title="Make default"
              onClick={() => onMakeDefault(a)}
            >
              <Star className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Edit ${a.label}`}
            onClick={() => onEdit(a)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Remove ${a.label}`}
            className="text-muted-foreground hover:text-destructive"
            onClick={() => onRemove(a)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <DataTable
      tableId="storage-accounts"
      itemLabel="bucket"
      columns={columns}
      rows={accounts}
      rowKey={(a) => a.id}
      onRowClick={onOpen}
      rowClassName={(a) => (a.isActive ? undefined : "opacity-60")}
      columnToggle={false}
    />
  )
}
