"use client"

import { useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  Upload,
  FileText,
  Sheet,
  FolderOpen,
  Trash2,
  ExternalLink,
  Users,
  RefreshCw,
  HardDrive,
  ChevronDown,
  Cloud,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { StatusBadge } from "@/components/shared/status-badge"
import { SearchInput } from "@/components/shared/search-input"
import { cn } from "@/lib/utils"
import { TONE } from "@/lib/constants"
import type { DriveFile } from "@/lib/google-drive"
import {
  useProjectResources,
  useUploadResource,
  useDeleteResource,
  getResourceDownloadUrl,
  type ProjectResource,
} from "../hooks/use-projects"
import {
  useProjectDrive,
  useUploadDriveFile,
  useCreateDriveFile,
  useDeleteDriveFile,
  useSyncDriveAccess,
} from "../hooks/use-project-drive"

type Source = "b2" | "drive"
type FileType = "doc" | "sheet" | "pdf" | "image" | "folder" | "other"

interface UnifiedFile {
  id: string
  source: Source
  name: string
  size: number | null
  mimeType: string
  modified: string | null
  webViewLink?: string | null
  isFolder?: boolean
  type: FileType
}

// Must match the server caps (drive/route.ts + resources/route.ts) AND stay <=
// nginx's client_max_body_size, or the upload dies at the proxy with a 413.
const MAX_UPLOAD_MB = 250
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

function fmtBytes(b: number | null): string {
  if (!b) return "-"
  if (b < 1024) return `${b} B`
  const u = ["KB", "MB", "GB"]
  let n = b / 1024
  let i = 0
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(1)} ${u[i]}`
}

function classify(mime: string, source: Source, isFolder?: boolean): FileType {
  if (isFolder) return "folder"
  if (mime.includes("spreadsheet")) return "sheet"
  if (mime.includes("document") && source === "drive") return "doc"
  if (mime.includes("pdf")) return "pdf"
  if (mime.startsWith("image/")) return "image"
  return "other"
}

const TYPE_META: Record<FileType, { icon: React.ElementType; tint: string; label: string }> = {
  doc: { icon: FileText, tint: "text-blue-500", label: "Google Doc" },
  sheet: { icon: Sheet, tint: "text-emerald-500", label: "Google Sheet" },
  pdf: { icon: FileText, tint: "text-red-500", label: "PDF" },
  image: { icon: FileText, tint: "text-violet-500", label: "Image" },
  folder: { icon: FolderOpen, tint: "text-amber-500", label: "Folder" },
  other: { icon: FileText, tint: "text-muted-foreground", label: "File" },
}

const SOURCE_COLORS: Record<string, string> = { B2: TONE.blue, DRIVE: TONE.emerald }
const SOURCE_LABELS: Record<string, string> = { B2: "Backblaze", DRIVE: "Drive" }

export function DriveTab({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const resources = useProjectResources(projectId, {})
  const drive = useProjectDrive(projectId)
  const uploadB2 = useUploadResource(projectId)
  const uploadDrive = useUploadDriveFile(projectId)
  const createFile = useCreateDriveFile(projectId)
  const delB2 = useDeleteResource(projectId)
  const delDrive = useDeleteDriveFile(projectId)
  const sync = useSyncDriveAccess(projectId)

  const inputRef = useRef<HTMLInputElement>(null)
  const targetRef = useRef<Source>("b2")
  const [deleteTarget, setDeleteTarget] = useState<UnifiedFile | null>(null)
  // Batch upload progress; null when idle.
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  // Filters
  const [search, setSearch] = useState("")
  const [sourceFilter, setSourceFilter] = useState<"all" | Source>("all")
  const [typeFilter, setTypeFilter] = useState<"all" | FileType>("all")

  const isLoading = resources.isLoading || drive.isLoading
  const driveConfigured = drive.data?.configured ?? false

  const allFiles = useMemo<UnifiedFile[]>(() => {
    const b2: UnifiedFile[] = (resources.data?.data ?? []).map((r: ProjectResource) => ({
      id: r.id,
      source: "b2",
      name: r.fileName,
      size: r.fileSize,
      mimeType: r.mimeType,
      modified: r.createdAt,
      type: classify(r.mimeType, "b2"),
    }))
    const dr: UnifiedFile[] = (drive.data?.files ?? []).map((f: DriveFile) => ({
      id: f.id,
      source: "drive",
      name: f.name,
      size: f.size,
      mimeType: f.mimeType,
      modified: f.modifiedTime,
      webViewLink: f.webViewLink,
      isFolder: f.isFolder,
      type: classify(f.mimeType, "drive", f.isFolder),
    }))
    return [...b2, ...dr].sort((a, b) => (b.modified ?? "").localeCompare(a.modified ?? ""))
  }, [resources.data, drive.data])

  const q = search.trim().toLowerCase()
  const rows = useMemo(
    () =>
      allFiles.filter((f) => {
        if (sourceFilter !== "all" && f.source !== sourceFilter) return false
        if (typeFilter !== "all" && f.type !== typeFilter) return false
        if (q && !f.name.toLowerCase().includes(q)) return false
        return true
      }),
    [allFiles, sourceFilter, typeFilter, q],
  )

  function pickFor(source: Source) {
    targetRef.current = source
    inputRef.current?.click()
  }

  async function onFilesPicked(files: File[]) {
    // Reject oversize files up front - otherwise the browser uploads the whole
    // thing before the server can say no.
    const tooBig = files.filter((f) => f.size > MAX_UPLOAD_BYTES)
    const queue = files.filter((f) => f.size <= MAX_UPLOAD_BYTES)
    if (tooBig.length === 1) {
      toast.error(
        `"${tooBig[0]!.name}" is ${fmtBytes(tooBig[0]!.size)} - the limit is ${MAX_UPLOAD_MB} MB.`,
      )
    } else if (tooBig.length > 1) {
      toast.error(`${tooBig.length} files are over the ${MAX_UPLOAD_MB} MB limit and were skipped.`)
    }
    if (queue.length === 0) return

    const target = targetRef.current
    const failed: string[] = []
    setProgress({ done: 0, total: queue.length })

    // Sequential ON PURPOSE: the server buffers each file fully in memory, so
    // uploading several 100 MB files at once could exhaust the box's RAM.
    for (let i = 0; i < queue.length; i++) {
      const file = queue[i]!
      try {
        if (target === "drive") await uploadDrive.mutateAsync(file)
        else await uploadB2.mutateAsync({ file, category: "OTHER" })
      } catch {
        // The hook already toasted the reason; just track it for the summary.
        failed.push(file.name)
      }
      setProgress({ done: i + 1, total: queue.length })
    }
    setProgress(null)

    const ok = queue.length - failed.length
    if (ok > 0 && failed.length === 0) {
      toast.success(ok === 1 ? `Uploaded "${queue[0]!.name}"` : `Uploaded ${ok} files`)
    } else if (ok > 0) {
      toast.warning(`${ok} uploaded · ${failed.length} failed`)
    }
  }
  async function openFile(f: UnifiedFile) {
    if (f.source === "drive") {
      if (f.webViewLink) window.open(f.webViewLink, "_blank")
      return
    }
    const url = await getResourceDownloadUrl(projectId, f.id).catch(() => "")
    if (url) window.open(url, "_blank")
  }

  const uploading = progress !== null || uploadB2.isPending || uploadDrive.isPending

  const columns: DataTableColumn<UnifiedFile>[] = [
    {
      header: "Name",
      cell: (f) => {
        const m = TYPE_META[f.type]
        return (
          <button
            type="button"
            onClick={() => openFile(f)}
            className="flex min-w-0 items-center gap-2.5 text-left"
          >
            <m.icon className={cn("h-4 w-4 shrink-0", m.tint)} />
            <span className="truncate font-medium hover:underline">{f.name}</span>
          </button>
        )
      },
    },
    { header: "Type", cell: (f) => TYPE_META[f.type].label },
    {
      header: "Storage",
      cell: (f) => (
        <StatusBadge
          status={f.source === "b2" ? "B2" : "DRIVE"}
          colorMap={SOURCE_COLORS}
          labelMap={SOURCE_LABELS}
          size="xs"
        />
      ),
    },
    { header: "Size", align: "right", className: "tabular-nums", cell: (f) => fmtBytes(f.size) },
    {
      header: "Modified",
      cell: (f) => (f.modified ? new Date(f.modified).toLocaleDateString("en-IN") : "-"),
    },
    {
      header: "",
      align: "right",
      cell: (f) => (
        <div className="flex items-center justify-end gap-0.5">
          <button
            type="button"
            onClick={() => openFile(f)}
            title="Open"
            className="text-muted-foreground hover:text-foreground hover:bg-muted flex h-8 w-8 items-center justify-center rounded"
          >
            <ExternalLink className="h-4 w-4" />
          </button>
          {canManage && (
            <button
              type="button"
              title={f.source === "drive" ? "Move to trash" : "Delete"}
              onClick={() => setDeleteTarget(f)}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex h-8 w-8 items-center justify-center rounded"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ]

  if (isLoading) return <ListSkeleton rows={4} height="h-14" className="mt-4" />

  return (
    <div className="mt-4 space-y-4">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          // Reset first: the picker won't re-fire for the same selection otherwise.
          e.target.value = ""
          if (files.length) void onFilesPicked(files)
        }}
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" loading={uploading} disabled={uploading}>
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              {progress ? `Uploading ${progress.done}/${progress.total}` : "Upload"}
              <ChevronDown className="ml-1 h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => pickFor("b2")}>
              <Cloud className="mr-2 h-4 w-4 text-blue-500" />
              Backblaze (B2)
              <span className="text-muted-foreground ml-2 text-xs">default</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => pickFor("drive")} disabled={!driveConfigured}>
              <HardDrive className="mr-2 h-4 w-4 text-emerald-500" />
              Google Drive
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {driveConfigured && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => createFile.mutate({ kind: "doc", name: "Untitled doc" })}
              loading={createFile.isPending && createFile.variables?.kind === "doc"}
            >
              <FileText className="mr-1.5 h-3.5 w-3.5" /> New Doc
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => createFile.mutate({ kind: "sheet", name: "Untitled sheet" })}
              loading={createFile.isPending && createFile.variables?.kind === "sheet"}
            >
              <Sheet className="mr-1.5 h-3.5 w-3.5" /> New Sheet
            </Button>
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          {driveConfigured && (
            <>
              <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                <Users className="h-3.5 w-3.5" />
                {drive.data?.memberCount ?? 0} with Drive access
              </span>
              {canManage && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  title="Re-sync Drive access to current members"
                  onClick={() => sync.mutate()}
                  loading={sync.isPending}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              )}
              {drive.data?.folderLink && (
                <Button size="sm" variant="outline" asChild>
                  <a href={drive.data.folderLink} target="_blank" rel="noreferrer">
                    <FolderOpen className="mr-1.5 h-3.5 w-3.5" /> Open Drive folder
                  </a>
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search files..."
          className="max-w-xs"
        />
        <Select
          value={sourceFilter}
          onValueChange={(v) => setSourceFilter(v as typeof sourceFilter)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Storage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All storage</SelectItem>
            <SelectItem value="b2">Backblaze (B2)</SelectItem>
            <SelectItem value="drive">Google Drive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="doc">Google Docs</SelectItem>
            <SelectItem value="sheet">Google Sheets</SelectItem>
            <SelectItem value="pdf">PDFs</SelectItem>
            <SelectItem value="image">Images</SelectItem>
            <SelectItem value="other">Other files</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-muted-foreground ml-auto text-xs tabular-nums">
          {rows.length} of {allFiles.length}
        </span>
      </div>

      {/* Table */}
      {allFiles.length === 0 ? (
        <EmptyState
          compact
          icon={FolderOpen}
          title="No files yet."
          description="Upload a file (Backblaze or Drive) or create a Doc/Sheet to get started."
        />
      ) : rows.length === 0 ? (
        <EmptyState compact icon={FolderOpen} title="No files match these filters." />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(f) => `${f.source}-${f.id}`}
          showSerial
          minWidth="min-w-[720px]"
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={deleteTarget?.source === "drive" ? "Move to trash?" : "Delete file?"}
        description={
          deleteTarget?.source === "drive"
            ? `"${deleteTarget?.name}" will be moved to the Shared Drive trash (recoverable from Drive).`
            : `"${deleteTarget?.name}" will be permanently deleted from Backblaze storage.`
        }
        variant="destructive"
        confirmLabel={deleteTarget?.source === "drive" ? "Move to trash" : "Delete"}
        isLoading={delB2.isPending || delDrive.isPending}
        onConfirm={() => {
          if (!deleteTarget) return
          const done = { onSuccess: () => setDeleteTarget(null) }
          if (deleteTarget.source === "drive") delDrive.mutate(deleteTarget.id, done)
          else delB2.mutate(deleteTarget.id, done)
        }}
      />
    </div>
  )
}
