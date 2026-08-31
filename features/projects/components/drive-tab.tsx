"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  Upload,
  FileText,
  Sheet,
  FolderOpen,
  Trash2,
  Eye,
  Download,
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import { BulkActionBar } from "@/components/shared/bulk-action-bar"
import { useRowSelection } from "@/hooks/use-row-selection"
import { cn } from "@/lib/utils"
import { TONE } from "@/lib/constants"
import type { DriveFile } from "@/lib/google-drive"
import {
  DOC_TAGS,
  DOC_TAG_HINT,
  DOC_TAG_LABEL,
  DOC_TAG_STYLE,
  classifyDoc,
  type DocTag,
} from "../lib/doc-tag"
import {
  useProjectResources,
  useUploadResource,
  useDeleteResource,
  useUpdateResourceTag,
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
  /** Document kind. Stored for B2 rows; derived on the fly for Drive ones. */
  tag: DocTag
  /** Whether `tag` is a stored value that can be corrected, or a live guess. */
  tagIsStored: boolean
}

// Must match the server caps (drive/route.ts + resources/route.ts) AND stay <=
// nginx's client_max_body_size, or the upload dies at the proxy with a 413.
const MAX_UPLOAD_MB = 250
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

/**
 * Rows per page.
 *
 * The list is fetched WHOLE (both sources return everything they have), so this
 * paginates in the browser rather than at the API. That is the right trade here
 * because search, the filters and the sort all need the full set anyway - and a
 * project with 300 files was previously rendering 300 table rows at once.
 */
const PAGE_SIZE = 25

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

/** How many deletes run at once in a bulk action. */
const BULK_CONCURRENCY = 4

function TagChip({ tag, muted }: { tag: DocTag; muted?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-[3px] px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
        DOC_TAG_STYLE[tag],
        // A derived tag is shown at reduced weight: it is a guess about a file
        // we do not own a row for, and it cannot be corrected here.
        muted && "opacity-60",
      )}
    >
      {DOC_TAG_LABEL[tag]}
    </span>
  )
}

/**
 * A file on a phone.
 *
 * The automatic card the table falls back to would print every column as a
 * label/value row, including the empty header on the actions column. Nine rows
 * per file is not a list anyone can scan, so this leads with the two things
 * that identify a file - its name and its tag - and demotes the rest to one
 * line of metadata. The actions come from the table's own row rendering.
 */
function FileCard({ file, actions }: { file: UnifiedFile; actions: React.ReactNode }) {
  const m = TYPE_META[file.type]
  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex min-w-0 items-start gap-2">
        <m.icon className={cn("mt-0.5 h-4 w-4 shrink-0", m.tint)} />
        <p className="min-w-0 flex-1 text-sm font-medium break-words">{file.name}</p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <TagChip tag={file.tag} muted={!file.tagIsStored} />
        <StatusBadge
          status={file.source === "b2" ? "B2" : "DRIVE"}
          colorMap={SOURCE_COLORS}
          labelMap={SOURCE_LABELS}
          size="xs"
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground min-w-0 truncate text-xs">
          {TYPE_META[file.type].label} · {fmtBytes(file.size)}
          {file.modified ? ` · ${new Date(file.modified).toLocaleDateString("en-IN")}` : ""}
        </p>
        {/* The bespoke card replaces the automatic one, which would have
            rendered the actions column for us. Without this they vanish on
            phones - the row becomes unreadable AND unusable. */}
        <div className="-mr-2 shrink-0">{actions}</div>
      </div>
    </div>
  )
}

export function DriveTab({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const resources = useProjectResources(projectId, {})
  const drive = useProjectDrive(projectId)
  const uploadB2 = useUploadResource(projectId)
  const uploadDrive = useUploadDriveFile(projectId)
  const createFile = useCreateDriveFile(projectId)
  const delB2 = useDeleteResource(projectId)
  const delDrive = useDeleteDriveFile(projectId)
  const retag = useUpdateResourceTag(projectId)
  const sync = useSyncDriveAccess(projectId)

  const inputRef = useRef<HTMLInputElement>(null)
  const targetRef = useRef<Source>("b2")
  const [deleteTarget, setDeleteTarget] = useState<UnifiedFile | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  // Batch upload progress; null when idle.
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null)
  const [dlProgress, setDlProgress] = useState<{ done: number; total: number } | null>(null)

  // Filters
  const [search, setSearch] = useState("")
  const [sourceFilter, setSourceFilter] = useState<"all" | Source>("all")
  const [typeFilter, setTypeFilter] = useState<"all" | FileType>("all")
  const [tagFilter, setTagFilter] = useState<"all" | DocTag>("all")
  const [page, setPage] = useState(1)

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
      // Rows uploaded before tagging existed have no stored tag. Rather than
      // showing them as untagged - which would make the filter lie about what
      // it excludes - fall back to the same guess a fresh upload would get.
      tag: r.tag ?? classifyDoc({ name: r.fileName, mimeType: r.mimeType }),
      tagIsStored: r.tag !== null,
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
      // Drive files have no row of ours to store a tag on, so theirs is always
      // computed. Same function as the stored one, so the column is consistent.
      tag: classifyDoc({ name: f.name, mimeType: f.mimeType }),
      tagIsStored: false,
    }))
    return [...b2, ...dr].sort((a, b) => (b.modified ?? "").localeCompare(a.modified ?? ""))
  }, [resources.data, drive.data])

  const q = search.trim().toLowerCase()
  const rows = useMemo(
    () =>
      allFiles.filter((f) => {
        if (sourceFilter !== "all" && f.source !== sourceFilter) return false
        if (typeFilter !== "all" && f.type !== typeFilter) return false
        if (tagFilter !== "all" && f.tag !== tagFilter) return false
        if (q && !f.name.toLowerCase().includes(q)) return false
        return true
      }),
    [allFiles, sourceFilter, typeFilter, tagFilter, q],
  )

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  // Narrowing a filter can strand the viewer past the end of the list. Clamping
  // in an effect rather than during render keeps `page` the single source of
  // truth instead of having two places decide what the current page is.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])
  useEffect(() => {
    setPage(1)
  }, [q, sourceFilter, typeFilter, tagFilter])

  const paged = useMemo(() => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [rows, page])

  const rowKey = (f: UnifiedFile) => `${f.source}-${f.id}`
  const pageIds = useMemo(() => paged.map(rowKey), [paged])
  const selection = useRowSelection(pageIds)
  const selectedFiles = useMemo(
    () => rows.filter((f) => selection.isSelected(rowKey(f))),
    [rows, selection],
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

  /** Open it to read. Inline for stored files, Drive's own viewer for Drive. */
  async function viewFile(f: UnifiedFile) {
    if (f.source === "drive") {
      if (f.webViewLink) window.open(f.webViewLink, "_blank")
      return
    }
    const url = await getResourceDownloadUrl(projectId, f.id).catch(() => "")
    if (url) window.open(url, "_blank")
    else toast.error("Could not open that file.")
  }

  /**
   * Save it to disk.
   *
   * For stored files the server signs the URL with an attachment disposition,
   * so the browser saves rather than renders. Google-native Docs and Sheets
   * have no single file to download - they have to be exported to a format
   * first - so those offer View only, and the button is not rendered for them.
   */
  async function downloadFile(f: UnifiedFile) {
    if (f.source === "drive") {
      window.open(`https://drive.google.com/uc?export=download&id=${f.id}`, "_blank")
      return
    }
    const url = await getResourceDownloadUrl(projectId, f.id, { download: true }).catch(() => "")
    if (url) window.location.href = url
    else toast.error("Could not download that file.")
  }

  const canDownload = (f: UnifiedFile) => !f.isFolder && f.type !== "doc" && f.type !== "sheet"

  // What the Download button will ACTUALLY fetch. Counting it up front keeps the
  // label honest: a button reading "Download 25" that then saves 3 of them and
  // explains itself in a toast is a button nobody trusts twice.
  const downloadable = selectedFiles.filter((f) => f.source === "b2" && canDownload(f)).length

  /**
   * Download everything selected, as separate files.
   *
   * NOT a zip: zipping would mean streaming every object back through the
   * server to repackage it, which for the 100 MB of creatives sitting in here
   * is a lot of egress and a request that runs for minutes behind a proxy with
   * its own timeout. The browser can save N files directly from storage
   * instead, which is faster and costs the server nothing.
   *
   * The signed URLs carry `Content-Disposition: attachment`, so each click
   * saves rather than navigates. They are triggered one at a time with a gap:
   * fired in a tight loop, browsers drop all but the first few. Chrome asks
   * once whether to allow multiple downloads - that prompt is expected.
   *
   * STORED FILES ONLY. A Drive file has no signed URL of ours, and Google
   * answers a bulk fetch of one with an interstitial page rather than the
   * bytes. Rather than half-work, those are counted out and named in the toast,
   * with Drive's own folder as the place to get them.
   */
  async function runBulkDownload() {
    const selected = selectedFiles
    const targets = selected.filter((f) => f.source === "b2" && canDownload(f))
    const skipped = selected.length - targets.length
    if (targets.length === 0) {
      toast.error(
        skipped > 0
          ? "Those can only be downloaded from Drive - use Open Drive folder."
          : "Nothing to download.",
      )
      return
    }

    setDlProgress({ done: 0, total: targets.length })
    let failed = 0
    for (let i = 0; i < targets.length; i++) {
      const f = targets[i]!
      try {
        const url = await getResourceDownloadUrl(projectId, f.id, { download: true })
        const a = document.createElement("a")
        a.href = url
        a.download = f.name
        a.style.display = "none"
        document.body.appendChild(a)
        a.click()
        a.remove()
      } catch {
        failed++
      }
      setDlProgress({ done: i + 1, total: targets.length })
      // Breathing room between saves. Without it the browser treats the burst
      // as one runaway script and silently discards most of it.
      if (i < targets.length - 1) await new Promise((r) => setTimeout(r, 400))
    }
    setDlProgress(null)

    const ok = targets.length - failed
    const note = skipped > 0 ? ` · ${skipped} skipped (Drive)` : ""
    if (failed === 0) toast.success(`Downloading ${ok} ${ok === 1 ? "file" : "files"}${note}`)
    else if (ok > 0) toast.warning(`${ok} downloading · ${failed} failed${note}`)
    else toast.error("Nothing could be downloaded.")
  }

  /**
   * Delete everything selected.
   *
   * Runs the EXISTING per-file endpoints rather than a new bulk one, so the
   * permission check, the storage cleanup and the audit trail stay in exactly
   * one place - and an admin deleting 20 files leaves 20 audit rows, which is
   * what an audit log is for. Bounded concurrency because each delete is a
   * round-trip to object storage.
   */
  async function runBulkDelete() {
    const targets = selectedFiles
    if (targets.length === 0) return
    setBulkProgress({ done: 0, total: targets.length })
    let done = 0
    let failed = 0

    const worker = async (queue: UnifiedFile[]) => {
      for (;;) {
        const f = queue.pop()
        if (!f) return
        try {
          if (f.source === "drive") await delDrive.mutateAsync(f.id)
          else await delB2.mutateAsync(f.id)
        } catch {
          failed++
        }
        done++
        setBulkProgress({ done, total: targets.length })
      }
    }
    const queue = [...targets]
    await Promise.all(
      Array.from({ length: Math.min(BULK_CONCURRENCY, queue.length) }, () => worker(queue)),
    )

    setBulkProgress(null)
    setBulkOpen(false)
    selection.clear()
    const ok = targets.length - failed
    if (failed === 0) toast.success(`Deleted ${ok} ${ok === 1 ? "file" : "files"}`)
    else if (ok > 0) toast.warning(`${ok} deleted · ${failed} failed`)
    else toast.error("Nothing could be deleted.")
  }

  const uploading = progress !== null || uploadB2.isPending || uploadDrive.isPending

  const columns: DataTableColumn<UnifiedFile>[] = [
    {
      header: "Name",
      // The ONE column that flexes. `w-full max-w-0` is the CSS table recipe
      // for it: the cell claims whatever width the fixed columns leave, and
      // max-width:0 is what lets the child actually truncate. Without it a
      // 70-character filename widens the whole table and the panel grows a
      // horizontal scrollbar on a screen with room to spare.
      className: "w-full max-w-0",
      headClassName: "w-full",
      cell: (f) => {
        const m = TYPE_META[f.type]
        return (
          <button
            type="button"
            onClick={() => viewFile(f)}
            title={f.name}
            className="flex w-full min-w-0 items-center gap-2.5 text-left"
          >
            <m.icon className={cn("h-4 w-4 shrink-0", m.tint)} />
            <span className="truncate font-medium hover:underline">{f.name}</span>
          </button>
        )
      },
    },
    {
      header: "Tag",
      className: "whitespace-nowrap",
      cell: (f) =>
        // Only stored tags are editable, and only by someone who can manage the
        // project. A Drive file has no row of ours to write the change to, so
        // offering the menu there would be a control that silently does nothing.
        canManage && f.source === "b2" ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                title="Change tag"
                className="focus-visible:ring-ring rounded focus-visible:ring-2 focus-visible:outline-none"
              >
                <TagChip tag={f.tag} muted={!f.tagIsStored} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel className="text-xs">Document type</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {DOC_TAGS.map((t) => (
                <DropdownMenuItem
                  key={t}
                  onClick={() => retag.mutate({ fileId: f.id, tag: t })}
                  className="gap-2"
                >
                  <TagChip tag={t} />
                  <span className="text-muted-foreground truncate text-[11px]">
                    {DOC_TAG_HINT[t]}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <TagChip tag={f.tag} muted={!f.tagIsStored} />
        ),
    },
    { header: "Type", className: "whitespace-nowrap", cell: (f) => TYPE_META[f.type].label },
    {
      header: "Storage",
      className: "whitespace-nowrap",
      cell: (f) => (
        <StatusBadge
          status={f.source === "b2" ? "B2" : "DRIVE"}
          colorMap={SOURCE_COLORS}
          labelMap={SOURCE_LABELS}
          size="xs"
        />
      ),
    },
    {
      header: "Size",
      align: "right",
      className: "whitespace-nowrap tabular-nums",
      cell: (f) => fmtBytes(f.size),
    },
    {
      header: "Modified",
      className: "whitespace-nowrap",
      cell: (f) => (f.modified ? new Date(f.modified).toLocaleDateString("en-IN") : "-"),
    },
    {
      header: "",
      align: "right",
      className: "whitespace-nowrap",
      cell: (f) => rowActions(f),
    },
  ]

  function rowActions(f: UnifiedFile) {
    return (
      <div className="flex items-center justify-end gap-0.5">
        <button
          type="button"
          onClick={() => viewFile(f)}
          title={f.source === "drive" ? "View in Drive" : "View"}
          className="text-muted-foreground hover:text-foreground hover:bg-muted flex h-8 w-8 items-center justify-center rounded"
        >
          <Eye className="h-4 w-4" />
        </button>
        {canDownload(f) && (
          <button
            type="button"
            onClick={() => downloadFile(f)}
            title="Download"
            className="text-muted-foreground hover:text-foreground hover:bg-muted flex h-8 w-8 items-center justify-center rounded"
          >
            <Download className="h-4 w-4" />
          </button>
        )}
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
    )
  }

  if (isLoading) return <ListSkeleton rows={4} height="h-14" className="mt-4" />

  // How many of each tag are in the CURRENT result set, so the filter can say
  // what picking it will get you instead of leading to an empty table.
  const tagCounts = new Map<DocTag, number>()
  for (const f of allFiles) tagCounts.set(f.tag, (tagCounts.get(f.tag) ?? 0) + 1)

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
        <Select value={tagFilter} onValueChange={(v) => setTagFilter(v as typeof tagFilter)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tags</SelectItem>
            {DOC_TAGS.filter((t) => (tagCounts.get(t) ?? 0) > 0).map((t) => (
              <SelectItem key={t} value={t}>
                <span className="flex w-full items-center justify-between gap-3">
                  {DOC_TAG_LABEL[t]}
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {tagCounts.get(t)}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

      {/* Bulk actions. Delete is manager-only, matching the per-row button. */}
      {canManage && (
        <BulkActionBar count={selection.count} onClear={selection.clear} label="file(s) selected">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void runBulkDownload()}
            loading={dlProgress !== null}
            disabled={dlProgress !== null || bulkProgress !== null || downloadable === 0}
            title={downloadable === 0 ? "Drive files download from the Drive folder" : undefined}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            {dlProgress
              ? `Downloading ${dlProgress.done}/${dlProgress.total}`
              : `Download ${downloadable}`}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setBulkOpen(true)}
            disabled={bulkProgress !== null || dlProgress !== null}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Delete {selection.count}
          </Button>
        </BulkActionBar>
      )}

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
          rows={paged}
          rowKey={rowKey}
          showSerial
          serialOffset={(page - 1) * PAGE_SIZE}
          selection={canManage ? selection : undefined}
          minWidth="min-w-[860px]"
          mobileCard={(f) => <FileCard file={f} actions={rowActions(f)} />}
          pagination={{
            page,
            totalPages,
            total: rows.length,
            onPageChange: setPage,
            itemLabel: "file",
          }}
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

      {/* The bulk confirm spells out the split, because the two halves of a
          mixed selection do genuinely different things: Drive files go to a
          trash you can empty later, stored files are gone. */}
      <ConfirmDialog
        open={bulkOpen}
        onOpenChange={(o) => !o && setBulkOpen(false)}
        title={`Delete ${selectedFiles.length} ${selectedFiles.length === 1 ? "file" : "files"}?`}
        description={(() => {
          const b2 = selectedFiles.filter((f) => f.source === "b2").length
          const dr = selectedFiles.length - b2
          const parts: string[] = []
          if (b2)
            parts.push(`${b2} stored ${b2 === 1 ? "file" : "files"} will be permanently deleted`)
          if (dr)
            parts.push(
              `${dr} Drive ${dr === 1 ? "file" : "files"} will be moved to the Shared Drive trash`,
            )
          return `${parts.join(", and ")}. This cannot be undone from here.`
        })()}
        variant="destructive"
        confirmLabel={
          bulkProgress ? `Deleting ${bulkProgress.done}/${bulkProgress.total}` : "Delete all"
        }
        isLoading={bulkProgress !== null}
        onConfirm={() => void runBulkDelete()}
      />
    </div>
  )
}
