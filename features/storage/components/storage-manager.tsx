"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  HardDrive,
  Files,
  AlertTriangle,
  Trash2,
  Eye,
  Download,
  ImageIcon,
  FileText,
  Building2,
  FolderKanban,
  Folder,
} from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { StatusBadge } from "@/components/shared/status-badge"
import { SearchInput } from "@/components/shared/search-input"
import { EmptyState } from "@/components/shared/empty-state"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { TONE } from "@/lib/constants"
import { useStorageOverview, useDeleteStorageObject, useDeleteOrphans } from "../hooks/use-storage"
import { CATEGORY_LABELS, type StorageCategory, type StorageFile } from "../types"

function fmtBytes(bytes: number): string {
  if (!bytes) return "0 B"
  if (bytes < 1024) return `${bytes} B`
  const u = ["KB", "MB", "GB", "TB"]
  let n = bytes / 1024
  let i = 0
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(n < 10 ? 2 : 1)} ${u[i]}`
}

const CATEGORY_META: Record<StorageCategory, { icon: React.ElementType; tint: string }> = {
  "profile-photos": { icon: ImageIcon, tint: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  "employee-documents": {
    icon: FileText,
    tint: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  "company-documents": {
    icon: Building2,
    tint: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  "project-files": {
    icon: FolderKanban,
    tint: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  other: { icon: Folder, tint: "bg-muted text-muted-foreground" },
}

// The "Referenced / Orphaned" pill maps.
const STATUS_COLORS: Record<string, string> = { LIVE: TONE.green, ORPHAN: TONE.amber }
const STATUS_LABELS: Record<string, string> = { LIVE: "In use", ORPHAN: "Orphaned" }

export function StorageManager() {
  const { data, isLoading } = useStorageOverview()
  const del = useDeleteStorageObject()
  const delOrphans = useDeleteOrphans()

  const [search, setSearch] = useState("")
  const [category, setCategory] = useState<StorageCategory | "all">("all")
  const [status, setStatus] = useState<"all" | "live" | "orphan">("all")
  const [deleteTarget, setDeleteTarget] = useState<StorageFile | null>(null)
  const [cleanupOpen, setCleanupOpen] = useState(false)

  const files = data?.files ?? []
  const q = search.trim().toLowerCase()
  const rows = useMemo(
    () =>
      files.filter((f) => {
        if (category !== "all" && f.category !== category) return false
        if (status === "live" && !f.referenced) return false
        if (status === "orphan" && f.referenced) return false
        if (q && !`${f.name} ${f.owner ?? ""}`.toLowerCase().includes(q)) return false
        return true
      }),
    [files, category, status, q],
  )

  const usedPct = data && data.freeTierBytes ? (data.totalBytes / data.freeTierBytes) * 100 : 0

  const columns: DataTableColumn<StorageFile>[] = [
    {
      header: "File",
      cell: (f) => {
        const Icon = CATEGORY_META[f.category].icon
        return (
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded",
                CATEGORY_META[f.category].tint,
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <span className="min-w-0 font-medium break-all">{f.name}</span>
          </div>
        )
      },
    },
    { header: "Category", cell: (f) => CATEGORY_LABELS[f.category] },
    { header: "Owner", cell: (f) => f.owner ?? <span className="text-muted-foreground">-</span> },
    { header: "Size", align: "right", className: "tabular-nums", cell: (f) => fmtBytes(f.size) },
    {
      header: "Modified",
      cell: (f) => (f.lastModified ? new Date(f.lastModified).toLocaleDateString("en-IN") : "-"),
    },
    {
      header: "Status",
      cell: (f) => (
        <StatusBadge
          status={f.referenced ? "LIVE" : "ORPHAN"}
          colorMap={STATUS_COLORS}
          labelMap={STATUS_LABELS}
        />
      ),
    },
    {
      header: "",
      align: "right",
      cell: (f) => (
        <div className="flex items-center justify-end gap-0.5">
          <a
            href={f.url}
            target="_blank"
            rel="noreferrer"
            title="View"
            className="text-muted-foreground hover:text-foreground hover:bg-muted flex h-8 w-8 items-center justify-center rounded"
          >
            <Eye className="h-4 w-4" />
          </a>
          <a
            href={f.downloadUrl}
            download={f.name}
            title="Download"
            className="text-muted-foreground hover:text-foreground hover:bg-muted flex h-8 w-8 items-center justify-center rounded"
          >
            <Download className="h-4 w-4" />
          </a>
          <button
            type="button"
            title="Delete"
            onClick={() => setDeleteTarget(f)}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex h-8 w-8 items-center justify-center rounded"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  if (!isLoading && data && !data.configured) {
    return (
      <div className="space-y-6">
        <PageHeader title="Storage" description="Files stored in Backblaze B2." />
        <EmptyState
          variant="card"
          icon={HardDrive}
          title="Storage is not configured."
          description="Add your Backblaze B2 keys on the Integrations page to see files here."
          action={{ label: "Go to Integrations", href: "/admin/integrations" }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Storage"
        description={
          data?.bucket ? `Backblaze B2 · ${data.bucket}` : "Files stored in Backblaze B2."
        }
        actions={
          (data?.orphanCount ?? 0) > 0 ? (
            <Button variant="outline" size="sm" onClick={() => setCleanupOpen(true)}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Clean up {data?.orphanCount} orphan{data?.orphanCount === 1 ? "" : "s"}
            </Button>
          ) : undefined
        }
      />

      {/* Usage gauge */}
      <div className="bg-card rounded-lg border p-5">
        <div className="mb-2 flex items-end justify-between">
          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Storage used
            </p>
            <p className="text-2xl font-semibold tabular-nums">
              {fmtBytes(data?.totalBytes ?? 0)}
              <span className="text-muted-foreground text-sm font-normal">
                {" "}
                / {fmtBytes(data?.freeTierBytes ?? 0)} free tier
              </span>
            </p>
          </div>
          <span className="text-muted-foreground text-sm tabular-nums">{usedPct.toFixed(1)}%</span>
        </div>
        <Progress value={usedPct} />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Total Files"
          value={data?.totalFiles ?? 0}
          icon={Files}
          loading={isLoading}
        />
        <StatCard
          title="Storage Used"
          value={fmtBytes(data?.totalBytes ?? 0)}
          icon={HardDrive}
          loading={isLoading}
        />
        <StatCard
          title="Orphaned"
          value={`${data?.orphanCount ?? 0} · ${fmtBytes(data?.orphanBytes ?? 0)}`}
          description="No DB reference - safe to delete"
          icon={AlertTriangle}
          iconColor={(data?.orphanCount ?? 0) > 0 ? "text-amber-600" : undefined}
          iconBg={(data?.orphanCount ?? 0) > 0 ? "bg-amber-500/10" : undefined}
          loading={isLoading}
        />
      </div>

      {/* Category folders (drive-style, click to filter) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <FolderCard
          label="All files"
          count={data?.totalFiles ?? 0}
          size={data?.totalBytes ?? 0}
          icon={HardDrive}
          tint="bg-primary/10 text-primary"
          active={category === "all"}
          onClick={() => setCategory("all")}
          fmt={fmtBytes}
        />
        {(data?.categories ?? []).map((c) => (
          <FolderCard
            key={c.category}
            label={c.label}
            count={c.count}
            size={c.size}
            icon={CATEGORY_META[c.category].icon}
            tint={CATEGORY_META[c.category].tint}
            active={category === c.category}
            onClick={() => setCategory(c.category)}
            fmt={fmtBytes}
          />
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search files or owner..."
          className="max-w-xs"
        />
        <div className="bg-card inline-flex items-center rounded-lg border p-0.5 text-xs">
          {(["all", "live", "orphan"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn(
                "rounded px-2.5 py-1 font-medium transition-colors",
                status === s
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s === "all" ? "All" : s === "live" ? "In use" : "Orphaned"}
            </button>
          ))}
        </div>
      </div>

      {/* Files */}
      {isLoading || rows.length > 0 ? (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(f) => f.key}
          showSerial
          loading={isLoading}
          minWidth="min-w-[820px]"
        />
      ) : (
        <EmptyState variant="card" icon={Files} title="No files match this view." />
      )}

      {/* Single delete */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={deleteTarget?.referenced ? "Delete this file?" : "Delete orphaned file?"}
        description={
          deleteTarget?.referenced
            ? `"${deleteTarget?.name}" is in use (${deleteTarget?.owner ?? "linked"}). Deleting it removes the file AND its record from the app. This cannot be undone.`
            : `"${deleteTarget?.name}" is not referenced anywhere. Deleting it just frees the storage. This cannot be undone.`
        }
        variant="destructive"
        confirmLabel="Delete"
        isLoading={del.isPending}
        onConfirm={() =>
          deleteTarget && del.mutate(deleteTarget.key, { onSuccess: () => setDeleteTarget(null) })
        }
      />

      {/* Bulk orphan cleanup */}
      <ConfirmDialog
        open={cleanupOpen}
        onOpenChange={setCleanupOpen}
        title="Delete all orphaned files?"
        description={`This permanently deletes ${data?.orphanCount ?? 0} file(s) (${fmtBytes(data?.orphanBytes ?? 0)}) that no record in the app points at. Files currently in use are not touched. This cannot be undone.`}
        variant="destructive"
        confirmLabel="Delete orphans"
        isLoading={delOrphans.isPending}
        onConfirm={() => delOrphans.mutate(undefined, { onSuccess: () => setCleanupOpen(false) })}
      />
    </div>
  )
}

function FolderCard({
  label,
  count,
  size,
  icon: Icon,
  tint,
  active,
  onClick,
  fmt,
}: {
  label: string
  count: number
  size: number
  icon: React.ElementType
  tint: string
  active: boolean
  onClick: () => void
  fmt: (n: number) => string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "bg-card flex items-center gap-3 rounded-lg border p-3 text-left transition-colors",
        active ? "border-primary ring-primary/30 ring-1" : "hover:bg-muted/40",
      )}
    >
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", tint)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{label}</p>
        <p className="text-muted-foreground text-xs tabular-nums">
          {count} file{count === 1 ? "" : "s"} · {fmt(size)}
        </p>
      </div>
    </button>
  )
}
