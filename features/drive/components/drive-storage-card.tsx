"use client"

import { format } from "date-fns"
import {
  AlertTriangle,
  CheckCircle2,
  HardDrive,
  Info,
  Loader2,
  MoreHorizontal,
  XCircle,
} from "lucide-react"

import { Link } from "@/components/tenant-link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { formatBytes, planFromLimit, storageWarnings } from "../lib/drive-plan"
import { useDriveStatus, useRunBackup } from "../hooks/use-google-drive"
import type { DriveStatus } from "../types"

/** The connected account's quota: used of total, and what's using it. */
export function DriveUsage({ quota }: { quota: NonNullable<DriveStatus["quota"]> }) {
  const pct = quota.limit ? (quota.usage / quota.limit) * 100 : 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs">
          <span className="font-medium">{formatBytes(quota.usage)}</span>
          <span className="text-muted-foreground">
            {" "}
            of {quota.limit ? formatBytes(quota.limit) : "unlimited"}
          </span>
        </p>
        {quota.limit && (
          <span className="text-muted-foreground text-[11px] tabular-nums">{pct.toFixed(1)}%</span>
        )}
      </div>
      {/* Floored at 1% while non-zero, so a nearly empty Drive still shows a sliver. */}
      <Progress
        value={pct > 0 ? Math.max(pct, 1) : 0}
        className={cn(
          "h-1.5",
          pct >= 95 ? "[&>div]:bg-destructive" : pct >= 80 && "[&>div]:bg-amber-500",
        )}
      />
      <p className="text-muted-foreground text-[11px]">
        Drive {formatBytes(quota.usageInDrive)} · Gmail &amp; Photos{" "}
        {formatBytes(Math.max(0, quota.usage - quota.usageInDrive))}
        {quota.usageInDriveTrash > 0 ? ` · Trash ${formatBytes(quota.usageInDriveTrash)}` : ""}
      </p>
    </div>
  )
}

export function DriveWarnings({ quota }: { quota: NonNullable<DriveStatus["quota"]> }) {
  const warnings = storageWarnings(quota)
  if (warnings.length === 0) return null
  return (
    <ul className="space-y-1">
      {warnings.map((w) => (
        <li
          key={w.message}
          className={cn(
            "flex items-start gap-1.5 text-[11px]",
            w.level === "critical"
              ? "text-destructive"
              : w.level === "warn"
                ? "text-amber-600 dark:text-amber-400"
                : "text-muted-foreground",
          )}
        >
          {w.level === "info" ? (
            <Info className="mt-px h-3 w-3 shrink-0" />
          ) : (
            <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
          )}
          {w.message}
        </li>
      ))}
    </ul>
  )
}

const when = (iso: string) => format(new Date(iso), "d MMM, h:mm a")

/** "Last backup" line: running, done (with what it copied), failed, or not yet. */
export function BackupLine({ backup }: { backup: DriveStatus["backup"] }) {
  const last = backup.last
  if (!last) {
    return (
      <p className="text-muted-foreground text-[11px]">
        No backup yet{backup.nextAt ? ` · first run ${when(backup.nextAt)}` : ""}
      </p>
    )
  }
  if (last.status === "RUNNING") {
    return (
      <p className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
        <Loader2 className="h-3 w-3 animate-spin" /> Backing up to Backblaze…
      </p>
    )
  }
  if (last.status === "FAILED") {
    return (
      <p className="text-destructive flex items-start gap-1.5 text-[11px]">
        <XCircle className="mt-px h-3 w-3 shrink-0" />
        Last backup failed {when(last.finishedAt ?? last.startedAt)}
        {last.error ? `: ${last.error}` : ""}
      </p>
    )
  }
  return (
    <p
      className={cn(
        "flex items-start gap-1.5 text-[11px]",
        last.failed ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
      )}
    >
      {last.failed ? (
        <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
      ) : (
        <CheckCircle2 className="mt-px h-3 w-3 shrink-0 text-emerald-600" />
      )}
      <span>
        Last backup {when(last.finishedAt ?? last.startedAt)} ·{" "}
        {last.copied ? `${last.copied} copied (${formatBytes(last.bytesCopied)})` : "nothing new"}
        {last.failed ? ` · ${last.failed} failed` : ""}
      </span>
    </p>
  )
}

/** The Google Drive card in the Storage grid; opens the Drive view. */
export function DriveStorageCard({ onOpen }: { onOpen: () => void }) {
  const { data, isPending } = useDriveStatus()
  const backup = useRunBackup()

  if (isPending) return <Skeleton className="h-52 rounded-sm" />
  if (!data) return null

  const connected = !!data.account
  const plan = data.quota ? planFromLimit(data.quota.limit) : null
  const running = data.backup.last?.status === "RUNNING"

  return (
    <div className="group bg-card hover:border-foreground/20 hover:bg-muted/30 relative flex flex-col gap-3 rounded-sm border p-4 transition-colors">
      {/* Stretched link: a sibling overlay makes the whole card clickable; buttons sit above it (z-10). */}
      {connected && (
        <button
          type="button"
          onClick={onOpen}
          aria-label="Open Google Drive"
          className="focus-visible:ring-ring absolute inset-0 rounded-sm focus-visible:ring-2 focus-visible:outline-none"
        />
      )}

      <div className="flex items-start justify-between gap-2">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-emerald-500/10">
          <HardDrive className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-sm font-medium group-hover:underline">Google Drive</p>
          <p className="text-muted-foreground mt-0.5 truncate font-mono text-xs">
            {data.account?.email ?? "Not connected"}
          </p>
        </div>
        {connected && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative z-10 shrink-0"
                aria-label="More actions"
              >
                {backup.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MoreHorizontal className="h-4 w-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-20">
              <DropdownMenuItem onClick={onOpen}>Browse files</DropdownMenuItem>
              {data.rootLink && (
                <DropdownMenuItem asChild>
                  <a href={data.rootLink} target="_blank" rel="noreferrer">
                    Open in Drive
                  </a>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem disabled={running} onClick={() => backup.mutate()}>
                Back up now
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/admin/integrations">Manage connection</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="relative z-10 flex flex-wrap items-center gap-1">
        {connected && data.storage === "drive" && <Badge className="text-[10px]">Repository</Badge>}
        {plan && (
          <Badge variant="outline" className="text-[10px]">
            {plan.label}
          </Badge>
        )}
        {data.error && (
          <Badge variant="outline" className="text-destructive gap-1 text-[10px]">
            <AlertTriangle className="h-3 w-3" /> Reconnect needed
          </Badge>
        )}
      </div>

      {connected ? (
        <div className="relative z-10 space-y-2">
          {data.quota && <DriveUsage quota={data.quota} />}
          {data.error && <p className="text-destructive line-clamp-2 text-[11px]">{data.error}</p>}
          <p className="text-muted-foreground text-[11px]">
            Repository: {data.repository.driveFiles} in Drive · {data.repository.b2Files} on
            Backblaze
          </p>
          {data.quota && <DriveWarnings quota={data.quota} />}
          <BackupLine backup={data.backup} />
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs">
            Connect the company&apos;s Google account to keep Repository files in its Drive, with a
            nightly backup here in Backblaze.
          </p>
          <Button variant="outline" asChild>
            <Link href="/admin/integrations">Connect in Integrations</Link>
          </Button>
        </div>
      )}
    </div>
  )
}
