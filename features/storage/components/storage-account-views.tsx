"use client"

/**
 * The two presentations of a storage account: card and table row.
 *
 * Split out of storage-accounts.tsx so the container keeps only state and
 * mutations - both views render the same badges and the same usage numbers, and
 * a divergence between them would show up as two different truths on one screen.
 */

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

/**
 * Each account fetches its OWN usage.
 *
 * Listing a bucket is a network round trip, so folding it into the accounts list
 * would make the page wait on the slowest bucket - and one unreachable bucket
 * would empty the whole screen. This way the cards appear immediately and fill
 * in, and a broken bucket reports itself on its own card.
 */
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
      {/* Floored at 1% while non-zero: a 0.4%-full bucket should still draw a
          visible sliver rather than an apparently broken empty track. */}
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
    // Same shell as a project card (app/(dashboard)/projects/projects-client.tsx):
    // `group`, rounded-[2px], border, and the hover pair that lifts border and
    // background together.
    <div
      className={cn(
        // Byte-for-byte the project card's shell. No accent border for the
        // default account: a tinted border is what made this card read as
        // heavier than a project card, and the "Default" badge already says it.
        "group bg-card hover:border-foreground/20 hover:bg-muted/30 relative flex flex-col gap-3 rounded-[2px] border p-4 transition-colors",
        !a.isActive && "opacity-60",
      )}
    >
      {/* Stretched link: an absolutely-positioned overlay makes the WHOLE card
          clickable while keeping the markup valid. It is a sibling of the inner
          buttons, not their parent, so Edit/Remove/Test need no stopPropagation -
          they simply sit above it with `relative z-10`. */}
      <button
        type="button"
        onClick={() => onOpen(a)}
        aria-label={`Open ${a.label}`}
        className="focus-visible:ring-ring absolute inset-0 rounded-[2px] focus-visible:ring-2 focus-visible:outline-none"
      />

      <div className="flex items-start justify-between gap-2">
        <span className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-[2px]">
          <HardDrive className="text-muted-foreground h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-sm font-medium group-hover:underline">{a.label}</p>
          <p className="text-muted-foreground mt-0.5 truncate font-mono text-xs">{a.bucket}</p>
        </div>
        {/* One overflow menu, exactly like a project card - four ghost buttons
            competing with the content is what made this card busier than the
            projects grid it sits beside. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
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
  return (
    <div className="overflow-x-auto rounded-sm border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th className="px-3 py-2.5 text-left text-xs font-medium">Name</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium">Bucket</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium">Region</th>
            <th className="px-3 py-2.5 text-right text-xs font-medium">Files</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium">Used</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium">Status</th>
            <th className="px-3 py-2.5 text-right text-xs font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((a) => (
            <tr
              key={a.id}
              onClick={() => onOpen(a)}
              className={cn(
                "hover:bg-muted/40 cursor-pointer border-t transition-colors",
                !a.isActive && "opacity-60",
              )}
            >
              <td className="px-3 py-2.5 text-xs font-medium">{a.label}</td>
              <td className="px-3 py-2.5 font-mono text-[11px]">{a.bucket}</td>
              <td className="text-muted-foreground px-3 py-2.5 font-mono text-[11px]">
                {a.region}
              </td>
              <td className="px-3 py-2.5 text-right">
                <FilesCell accountId={a.id} />
              </td>
              <td className="px-3 py-2.5">
                <UsageCell accountId={a.id} />
              </td>
              <td className="px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-1">
                  <AccountBadges account={a} />
                </div>
              </td>
              <td className="px-3 py-2.5">
                <div className="flex items-center justify-end gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Test ${a.label}`}
                    title="Test connection"
                    disabled={testingId === a.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      onTest(a)
                    }}
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
                      size="icon-sm"
                      aria-label={`Make ${a.label} the default`}
                      title="Make default"
                      onClick={(e) => {
                        e.stopPropagation()
                        onMakeDefault(a)
                      }}
                    >
                      <Star className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit ${a.label}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onEdit(a)
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${a.label}`}
                    className="text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemove(a)
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
