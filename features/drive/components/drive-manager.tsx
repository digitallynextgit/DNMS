"use client"

import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import {
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Folder,
  FolderOpen,
  HardDrive,
  Home,
  Loader2,
  MoveRight,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { PageHeader } from "@/components/shared/page-header"
import { SegmentedControl } from "@/components/shared/segmented-control"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { EmptyState } from "@/components/shared/empty-state"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { cn } from "@/lib/utils"
import { formatBytes } from "../lib/drive-plan"
import {
  useDriveBrowse,
  useDriveMove,
  useDriveStatus,
  useRunBackup,
  useSetRepositoryStorage,
  useStartMove,
} from "../hooks/use-google-drive"
import type { DriveBrowseItem, DriveMoveProject, DriveStatus } from "../types"
import { BackupLine, DriveUsage, DriveWarnings } from "./drive-storage-card"

type Tab = "files" | "move" | "backup"

const when = (iso: string | null) => (iso ? format(new Date(iso), "d MMM yyyy, h:mm a") : "-")

/** Storage page -> Google Drive: where uploads go, the DNMS folder, the move from Backblaze, backups. */
export function DriveManager({ onBack }: { onBack: () => void }) {
  const { data } = useDriveStatus()
  const [tab, setTab] = useState<Tab>("files")

  return (
    <div className="space-y-6">
      <PageHeader
        title="Google Drive"
        backLabel="All storage"
        onBack={onBack}
        description={data?.account ? data.account.email : "Repository files in Google Drive"}
        actions={
          data?.rootLink ? (
            <Button variant="outline" asChild>
              <a href={data.rootLink} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Open in Drive
              </a>
            </Button>
          ) : undefined
        }
      />

      {data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="bg-card space-y-3 rounded-sm border p-5">
            <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Drive storage
            </p>
            {data.quota ? (
              <>
                <DriveUsage quota={data.quota} />
                <DriveWarnings quota={data.quota} />
              </>
            ) : (
              <p className="text-destructive text-xs">{data.error ?? "Drive could not be read."}</p>
            )}
          </div>
          <StorageSwitch status={data} />
        </div>
      )}

      <SegmentedControl
        aria-label="Google Drive sections"
        value={tab}
        onChange={setTab}
        options={[
          { value: "files", label: "Files" },
          { value: "move", label: "Move to Drive" },
          { value: "backup", label: "Backup" },
        ]}
      />

      {tab === "files" && <DriveBrowser />}
      {tab === "move" && <MovePanel />}
      {tab === "backup" && data && <BackupPanel status={data} />}
    </div>
  )
}

function StorageSwitch({ status }: { status: DriveStatus }) {
  const set = useSetRepositoryStorage()
  const [confirm, setConfirm] = useState<"b2" | "drive" | null>(null)

  return (
    <div className="bg-card space-y-3 rounded-sm border p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            Repository uploads go to
          </p>
          <p className="text-muted-foreground text-xs">
            Files already stored keep opening from where they are, so switching back is safe.
          </p>
        </div>
        <SegmentedControl
          aria-label="Repository storage"
          value={status.storage}
          onChange={(v) => v !== status.storage && setConfirm(v)}
          options={[
            { value: "b2", label: "Backblaze" },
            { value: "drive", label: "Google Drive" },
          ]}
        />
      </div>
      <p className="text-muted-foreground text-[11px]">
        {status.repository.driveFiles} files ({formatBytes(status.repository.driveBytes)}) in Drive
        · {status.repository.b2Files} files ({formatBytes(status.repository.b2Bytes)}) on Backblaze
      </p>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={
          confirm === "drive"
            ? "Store new Repository files in Google Drive?"
            : "Store new Repository files in Backblaze?"
        }
        description={
          confirm === "drive"
            ? "From now on, uploads, Docs and Sheets go to each project's folder in Google Drive, shared with its team. Then use Move to Drive to bring the existing files across."
            : "New uploads go to Backblaze again. Files already in Drive stay there and keep opening."
        }
        confirmLabel={confirm === "drive" ? "Use Google Drive" : "Use Backblaze"}
        isLoading={set.isPending}
        onConfirm={() => confirm && set.mutate(confirm, { onSuccess: () => setConfirm(null) })}
      />
    </div>
  )
}

function DriveBrowser() {
  // The breadcrumb; empty = the DNMS folder itself.
  const [path, setPath] = useState<{ id: string; name: string }[]>([])
  const folderId = path.at(-1)?.id ?? null
  const { data, isLoading } = useDriveBrowse(folderId, true)

  const columns: DataTableColumn<DriveBrowseItem>[] = [
    {
      header: "Name",
      sortValue: (f) => f.name,
      className: "w-full max-w-0",
      headClassName: "w-full",
      cell: (f) => (
        <span className="flex min-w-0 items-center gap-2.5">
          {f.isFolder ? (
            <Folder className="h-4 w-4 shrink-0 text-amber-500" />
          ) : (
            <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
          )}
          <span className={cn("truncate", f.isFolder && "font-medium group-hover:underline")}>
            {f.name}
          </span>
        </span>
      ),
    },
    {
      header: "Size",
      align: "right",
      sortValue: (f) => f.size,
      className: "tabular-nums",
      cell: (f) => (f.size ? formatBytes(f.size) : "-"),
    },
    {
      header: "Modified",
      sortValue: (f) => f.modifiedTime,
      cell: (f) => (f.modifiedTime ? format(new Date(f.modifiedTime), "d MMM yyyy") : "-"),
    },
    {
      header: "",
      align: "right",
      cell: (f) =>
        f.isFolder ? null : (
          // The row opens folders; these must not bubble into it.
          <div
            className="flex items-center justify-end gap-0.5"
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            {f.webViewLink && (
              <Button variant="ghost" size="icon" asChild title="Open in Drive">
                <a
                  href={f.webViewLink}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${f.name} in Drive`}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            )}
            {!f.mimeType.startsWith("application/vnd.google-apps.") && (
              <Button variant="ghost" size="icon" asChild title="Download">
                <a
                  href={`/api/admin/google-drive/file?id=${encodeURIComponent(f.id)}`}
                  aria-label={`Download ${f.name}`}
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
              </Button>
            )}
          </div>
        ),
    },
  ]

  return (
    <div className="space-y-3">
      <nav aria-label="Folder" className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
        <button
          type="button"
          onClick={() => setPath([])}
          className={cn(
            "hover:bg-muted inline-flex items-center gap-1.5 rounded-sm px-1.5 py-1",
            path.length === 0 ? "text-foreground font-medium" : "text-muted-foreground",
          )}
        >
          <Home className="h-3.5 w-3.5" /> DNMS
        </button>
        {path.map((p, i) => (
          <span key={p.id} className="flex min-w-0 items-center gap-1">
            <ChevronRight className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
            <button
              type="button"
              onClick={() => setPath(path.slice(0, i + 1))}
              className={cn(
                "hover:bg-muted max-w-[220px] truncate rounded-sm px-1.5 py-1",
                i === path.length - 1 ? "text-foreground font-medium" : "text-muted-foreground",
              )}
              title={p.name}
            >
              {p.name}
            </button>
          </span>
        ))}
      </nav>

      {!isLoading && data && !data.folderId ? (
        <EmptyState
          variant="card"
          icon={FolderOpen}
          title="No DNMS folder yet."
          description="It's created in the account's Drive with the first Repository upload there."
        />
      ) : (
        <DataTable
          tableId="google-drive-browser"
          itemLabel="item"
          columns={columns}
          rows={data?.items ?? []}
          rowKey={(f) => f.id}
          loading={isLoading}
          onRowClick={(f) => f.isFolder && setPath([...path, { id: f.id, name: f.name }])}
          rowClassName={(f) => (f.isFolder ? "group" : undefined)}
          columnToggle={false}
          minWidth="min-w-[560px]"
          empty={<EmptyState compact icon={FolderOpen} title="This folder is empty." />}
        />
      )}
    </div>
  )
}

function MovePanel() {
  const { data, isLoading } = useDriveMove(true)
  const start = useStartMove()
  const qc = useQueryClient()
  const [confirmAll, setConfirmAll] = useState(false)
  const job = data?.job ?? null

  // When a move finishes, the card's file counts are stale.
  const finishedAt = job?.finishedAt ?? null
  useEffect(() => {
    if (finishedAt) qc.invalidateQueries({ queryKey: ["google-drive-status"] })
  }, [finishedAt, qc])

  const projects = data?.projects ?? []
  const left = projects.reduce((n, p) => n + p.b2Files + p.sharedFiles, 0)
  const leftBytes = projects.reduce((n, p) => n + p.b2Bytes, 0)
  const running = !!job?.running

  const columns: DataTableColumn<DriveMoveProject>[] = [
    {
      header: "Project",
      sortValue: (p) => p.name,
      className: "w-full max-w-0",
      headClassName: "w-full",
      cell: (p) => (
        <span className="block min-w-0">
          <span className="block truncate font-medium">{p.name}</span>
          {p.code && <span className="text-muted-foreground block text-[11px]">{p.code}</span>}
        </span>
      ),
    },
    {
      header: "On Backblaze",
      align: "right",
      sortValue: (p) => p.b2Files,
      className: "tabular-nums whitespace-nowrap",
      cell: (p) => (p.b2Files ? `${p.b2Files} · ${formatBytes(p.b2Bytes)}` : "-"),
    },
    {
      header: "Old Shared Drive",
      align: "right",
      sortValue: (p) => p.sharedFiles,
      className: "tabular-nums",
      cell: (p) => p.sharedFiles || "-",
    },
    {
      header: "In Drive",
      align: "right",
      sortValue: (p) => p.driveFiles,
      className: "tabular-nums",
      cell: (p) => p.driveFiles || "-",
    },
    {
      header: "",
      align: "right",
      cell: (p) =>
        p.b2Files + p.sharedFiles > 0 ? (
          <Button
            variant="outline"
            className="h-8 gap-1.5 px-3 text-xs"
            disabled={!data?.canMove || running || start.isPending}
            onClick={() => start.mutate(p.id)}
          >
            <MoveRight className="h-3.5 w-3.5" /> Move
          </Button>
        ) : (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">Done</span>
        ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="bg-card space-y-3 rounded-sm border p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium">
              {left > 0
                ? `${left} files still to move${leftBytes ? ` (${formatBytes(leftBytes)} on Backblaze)` : ""}`
                : isLoading
                  ? "Counting files…"
                  : "Everything is in Google Drive"}
            </p>
            <p className="text-muted-foreground text-xs">
              Each file is copied to its project&apos;s Drive folder and checked byte for byte
              before DNMS switches to it. The Backblaze copies stay as the first backup.
            </p>
          </div>
          <Button
            disabled={!data?.canMove || running || left === 0 || start.isPending}
            onClick={() => setConfirmAll(true)}
          >
            <MoveRight className="mr-1.5 h-3.5 w-3.5" /> Move everything
          </Button>
        </div>
        {data && !data.canMove && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Switch Repository uploads to Google Drive above first.
          </p>
        )}

        {job && (
          <div className="space-y-1.5">
            <Progress value={job.total ? (job.done / job.total) * 100 : running ? 0 : 100} />
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              {running && <Loader2 className="h-3 w-3 animate-spin" />}
              {running
                ? `Moving ${Math.min(job.done + 1, job.total)} of ${job.total}${job.current ? ` · ${job.current}` : ""}`
                : `Finished ${when(job.finishedAt)}: ${job.moved} moved${job.failed.length ? `, ${job.failed.length} failed` : ""}.`}
            </p>
            {job.failed.length > 0 && (
              <ul className="max-h-40 space-y-0.5 overflow-y-auto text-[11px]">
                {job.failed.slice(0, 50).map((f, i) => (
                  <li key={i} className="text-destructive">
                    {f.project} · {f.name}: {f.error}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <DataTable
        tableId="google-drive-move"
        itemLabel="project"
        columns={columns}
        rows={projects}
        rowKey={(p) => p.id}
        loading={isLoading}
        columnToggle={false}
        minWidth="min-w-[640px]"
        empty={<EmptyState compact icon={HardDrive} title="No Repository files yet." />}
      />

      <ConfirmDialog
        open={confirmAll}
        onOpenChange={setConfirmAll}
        title={`Move ${left} files to Google Drive?`}
        description="Runs in the background, project by project; you can leave this page. Files keep opening throughout, and a failed file is simply left where it was."
        confirmLabel="Move everything"
        onConfirm={() => start.mutate(null, { onSuccess: () => setConfirmAll(false) })}
        isLoading={start.isPending}
      />
    </div>
  )
}

function BackupPanel({ status }: { status: DriveStatus }) {
  const backup = useRunBackup()
  const last = status.backup.last
  const running = last?.status === "RUNNING"

  return (
    <div className="bg-card space-y-4 rounded-sm border p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">Nightly backup to Backblaze</p>
          <p className="text-muted-foreground text-xs">
            Every night at 2 AM IST, new and changed Repository files are copied from Drive to the
            default Backblaze bucket (folder drive-backup). Google Docs and Sheets are saved as Word
            and Excel files. A file deleted from Drive keeps its backup for 30 days.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={running || backup.isPending || !status.account}
          onClick={() => backup.mutate()}
        >
          {running ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          Back up now
        </Button>
      </div>

      <BackupLine backup={status.backup} />

      <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Backed up</dt>
        <dd>
          {status.backup.files} files · {formatBytes(status.backup.bytes)}
        </dd>
        <dt className="text-muted-foreground">Next run</dt>
        <dd>{when(status.backup.nextAt)}</dd>
        {last && (
          <>
            <dt className="text-muted-foreground">Last run</dt>
            <dd>
              {when(last.startedAt)} · checked {last.checked}, copied {last.copied}
              {last.failed ? `, ${last.failed} failed` : ""}
            </dd>
          </>
        )}
      </dl>
    </div>
  )
}
