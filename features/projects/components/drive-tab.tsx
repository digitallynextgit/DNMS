"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Cloud,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  HardDrive,
  Home,
  Info,
  Link2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Sheet as SheetIcon,
  Trash2,
  Upload,
  Users,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { isSafeHttpUrl } from "../lib/task-links"
import {
  useUploadResource,
  useDeleteResource,
  useUpdateResourceTag,
  getResourceDownloadUrl,
  type ProjectResource,
} from "../hooks/use-projects"
import {
  useUploadDriveFile,
  useCreateDriveFile,
  useDeleteDriveFile,
  useSyncDriveAccess,
} from "../hooks/use-project-drive"
import {
  useProjectFiles,
  useProjectFolders,
  useCreateFolder,
  useUpdateFolder,
  useDeleteFolder,
  useCreateLink,
  useUpdateLink,
  useDeleteLink,
  useUpdateResource,
  useUpdateDriveFile,
  type FilePerson,
  type ProjectFolderRow,
  type ProjectLink,
} from "../hooks/use-project-files"
import { NameDialog } from "./files/name-dialog"
import { LinkDialog, type LinkFormValues } from "./files/link-dialog"
import { FolderPickerDialog } from "./files/folder-picker-dialog"
import { FilePreviewSheet, type PreviewItem } from "./files/file-preview-sheet"

type Source = "b2" | "drive" | "link" | "folder"
type FileType = "doc" | "sheet" | "pdf" | "image" | "folder" | "link" | "other"
type SortKey = "name" | "type" | "size" | "modified" | "addedBy"

interface Person {
  name: string
  photo: string | null
  initials: string
}

/** One row of the Files table, whichever of the four sources it came from. */
interface UnifiedFile {
  id: string
  source: Source
  name: string
  size: number | null
  mimeType: string
  modified: string | null
  webViewLink?: string | null
  /** Links only. */
  url?: string
  type: FileType
  /** Folders have no tag; links may have none. */
  tag: DocTag | null
  /** Whether `tag` is a stored value that can be corrected, or a live guess. */
  tagIsStored: boolean
  addedBy: Person | null
  /** Uploader / creator - who may edit it besides managers. Null for Drive rows. */
  ownerId: string | null
  description?: string | null
  /** Folders only. */
  itemCount?: number
  driveFolderId?: string | null
}

// Must match the server caps (drive/route.ts + resources/route.ts) AND stay <=
// nginx's client_max_body_size, or the upload dies at the proxy with a 413.
const MAX_UPLOAD_MB = 250
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

/**
 * Rows per page. One folder is fetched whole (both sources return everything
 * they have), so this paginates in the browser: search, filters and sort all
 * need the full set anyway.
 */
const PAGE_SIZE = 25

/** How many deletes / moves run at once in a bulk action. */
const BULK_CONCURRENCY = 4

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

function classify(mime: string, source: Source): FileType {
  if (mime.includes("spreadsheet")) return "sheet"
  if (mime.includes("document") && source === "drive") return "doc"
  if (mime.includes("pdf")) return "pdf"
  if (mime.startsWith("image/")) return "image"
  return "other"
}

const TYPE_META: Record<FileType, { icon: React.ElementType; tint: string; label: string }> = {
  doc: { icon: FileText, tint: "text-blue-500", label: "Google Doc" },
  sheet: { icon: SheetIcon, tint: "text-emerald-500", label: "Google Sheet" },
  pdf: { icon: FileText, tint: "text-red-500", label: "PDF" },
  image: { icon: FileText, tint: "text-violet-500", label: "Image" },
  folder: { icon: Folder, tint: "text-amber-500", label: "Folder" },
  link: { icon: Link2, tint: "text-sky-500", label: "Link" },
  other: { icon: FileText, tint: "text-muted-foreground", label: "File" },
}

const SOURCE_COLORS: Record<string, string> = { B2: TONE.blue, DRIVE: TONE.emerald }
const SOURCE_LABELS: Record<string, string> = { B2: "Backblaze", DRIVE: "Drive" }

function person(p: FilePerson | ProjectResource["uploadedBy"]): Person {
  const first = p.firstName ?? ""
  const last = p.lastName ?? ""
  return {
    name: `${first} ${last}`.trim(),
    photo: (p as { profilePhoto?: string | null }).profilePhoto ?? null,
    initials: `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase() || "?",
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

function byName(a: UnifiedFile, b: UnifiedFile): number {
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
}

function compare(a: UnifiedFile, b: UnifiedFile, key: SortKey): number {
  switch (key) {
    case "name":
      return byName(a, b)
    case "type":
      return TYPE_META[a.type].label.localeCompare(TYPE_META[b.type].label)
    case "size":
      return (a.size ?? -1) - (b.size ?? -1)
    case "modified":
      return (a.modified ?? "").localeCompare(b.modified ?? "")
    case "addedBy":
      return (a.addedBy?.name ?? "").localeCompare(b.addedBy?.name ?? "")
  }
}

function TagChip({ tag, muted }: { tag: DocTag; muted?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
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

function PersonCell({ p }: { p: Person | null }) {
  if (!p) return <span className="text-muted-foreground">-</span>
  return (
    <span className="flex min-w-0 items-center gap-2" title={p.name}>
      {p.photo ? (
        // Profile photos come from our own storage with per-user URLs, so a
        // plain img is fine here.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.photo} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="bg-muted text-muted-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold">
          {p.initials}
        </span>
      )}
      <span className="truncate">{p.name}</span>
    </span>
  )
}

function StorageCell({ f }: { f: UnifiedFile }) {
  if (f.source === "folder") return <span className="text-muted-foreground">-</span>
  if (f.source === "link") {
    return (
      <span className="inline-flex items-center rounded-sm bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-sky-600 uppercase dark:text-sky-400">
        Link
      </span>
    )
  }
  return (
    <StatusBadge
      status={f.source === "b2" ? "B2" : "DRIVE"}
      colorMap={SOURCE_COLORS}
      labelMap={SOURCE_LABELS}
      size="xs"
    />
  )
}

/**
 * A row on a phone. Leads with the two things that identify it - name and
 * tag - and demotes the rest to one line of metadata. The actions come from
 * the table's own row rendering.
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
        {file.tag && <TagChip tag={file.tag} muted={!file.tagIsStored} />}
        <StorageCell f={file} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground min-w-0 truncate text-xs">
          {file.source === "folder"
            ? `${file.itemCount ?? 0} ${file.itemCount === 1 ? "item" : "items"}`
            : file.source === "link"
              ? hostOf(file.url ?? "")
              : `${m.label} · ${fmtBytes(file.size)}`}
          {file.modified ? ` · ${new Date(file.modified).toLocaleDateString("en-IN")}` : ""}
        </p>
        <div className="-mr-2 shrink-0">{actions}</div>
      </div>
    </div>
  )
}

const iconBtn =
  "text-muted-foreground hover:text-foreground hover:bg-muted flex h-8 w-8 items-center justify-center rounded-sm"

export function DriveTab({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const { data: session } = useSession()
  const me = session?.user?.id ?? null

  // The folder being viewed lives in the URL (`?folder=`), so a link to a
  // folder can be shared and the browser's back button walks back up.
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const folderId = searchParams.get("folder")
  const setFolderParam = useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(Array.from(searchParams.entries()))
      if (id) next.set("folder", id)
      else next.delete("folder")
      router.replace(`${pathname}?${next.toString()}`, { scroll: false })
    },
    [router, pathname, searchParams],
  )

  const listing = useProjectFiles(projectId, folderId)
  const data = listing.data
  useEffect(() => {
    if (listing.isError && folderId) {
      toast.error("That folder no longer exists.")
      setFolderParam(null)
    }
  }, [listing.isError, folderId, setFolderParam])

  const uploadB2 = useUploadResource(projectId)
  const uploadDrive = useUploadDriveFile(projectId)
  const createDoc = useCreateDriveFile(projectId)
  const delB2 = useDeleteResource(projectId)
  const delDrive = useDeleteDriveFile(projectId)
  const retag = useUpdateResourceTag(projectId)
  const sync = useSyncDriveAccess(projectId)
  const createFolder = useCreateFolder(projectId)
  const updateFolder = useUpdateFolder(projectId)
  const deleteFolder = useDeleteFolder(projectId)
  const createLink = useCreateLink(projectId)
  const updateLink = useUpdateLink(projectId)
  const deleteLink = useDeleteLink(projectId)
  const updateResource = useUpdateResource(projectId)
  const updateDriveFile = useUpdateDriveFile(projectId)

  const inputRef = useRef<HTMLInputElement>(null)
  const targetRef = useRef<"b2" | "drive">("b2")

  // Dialogs
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<UnifiedFile | null>(null)
  const [linkDialog, setLinkDialog] = useState<{
    open: boolean
    edit: UnifiedFile | null
    presetUrl?: string
  }>({ open: false, edit: null })
  const [moveTargets, setMoveTargets] = useState<UnifiedFile[] | null>(null)
  const [detailsTarget, setDetailsTarget] = useState<UnifiedFile | null>(null)
  const [preview, setPreview] = useState<PreviewItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UnifiedFile | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  // The picker needs the whole tree; only fetch it once someone asks to move.
  const allFolders = useProjectFolders(projectId, { enabled: moveTargets !== null })

  // Progress of batch actions; null when idle.
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null)
  const [dlProgress, setDlProgress] = useState<{ done: number; total: number } | null>(null)
  const [moveProgress, setMoveProgress] = useState<{ done: number; total: number } | null>(null)

  // Filters + sort
  const [search, setSearch] = useState("")
  const [sourceFilter, setSourceFilter] = useState<"all" | "b2" | "drive" | "link">("all")
  const [typeFilter, setTypeFilter] = useState<"all" | FileType>("all")
  const [tagFilter, setTagFilter] = useState<"all" | DocTag>("all")
  const [sortKey, setSortKey] = useState<SortKey>("modified")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  // Page is keyed to the filter set (see below), so changing a filter or
  // folder lands on page 1 without an effect.
  const [pageState, setPageState] = useState<{ key: string; page: number }>({ key: "", page: 1 })

  const driveConfigured = data?.drive.configured ?? false
  const currentFolderName = data?.folder?.name ?? null

  const allRows = useMemo<UnifiedFile[]>(() => {
    if (!data) return []
    const folders: UnifiedFile[] = data.folders.map((f: ProjectFolderRow) => ({
      id: f.id,
      source: "folder",
      name: f.name,
      size: null,
      mimeType: "",
      modified: f.updatedAt,
      type: "folder",
      tag: null,
      tagIsStored: false,
      addedBy: person(f.createdBy),
      ownerId: f.createdById,
      itemCount: f.itemCount,
      driveFolderId: f.driveFolderId,
    }))
    const b2: UnifiedFile[] = data.files.map((r: ProjectResource) => ({
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
      addedBy: person(r.uploadedBy),
      ownerId: r.uploadedById,
      description: r.description,
    }))
    const drive: UnifiedFile[] = data.driveFiles.map((f: DriveFile) => ({
      id: f.id,
      source: "drive",
      name: f.name,
      size: f.size,
      mimeType: f.mimeType,
      modified: f.modifiedTime,
      webViewLink: f.webViewLink,
      type: classify(f.mimeType, "drive"),
      // Drive files have no row of ours to store a tag on, so theirs is always
      // computed. Same function as the stored one, so the column is consistent.
      tag: classifyDoc({ name: f.name, mimeType: f.mimeType }),
      tagIsStored: false,
      addedBy: f.modifiedBy
        ? { name: f.modifiedBy, photo: null, initials: f.modifiedBy[0]! }
        : null,
      ownerId: null,
    }))
    const links: UnifiedFile[] = data.links.map((l: ProjectLink) => ({
      id: l.id,
      source: "link",
      name: l.title,
      size: null,
      mimeType: "",
      modified: l.updatedAt,
      url: l.url,
      type: "link",
      tag: l.tag,
      tagIsStored: l.tag !== null,
      addedBy: person(l.createdBy),
      ownerId: l.createdById,
      description: l.description,
    }))
    return [...folders, ...b2, ...drive, ...links]
  }, [data])

  const q = search.trim().toLowerCase()
  const rows = useMemo(() => {
    const filtered = allRows.filter((f) => {
      if (f.source === "folder") {
        // Folders carry no tag/type/storage, so any of those filters hides
        // them rather than showing rows the filter cannot say anything about.
        if (sourceFilter !== "all" || typeFilter !== "all" || tagFilter !== "all") return false
        return !q || f.name.toLowerCase().includes(q)
      }
      if (sourceFilter !== "all" && f.source !== sourceFilter) return false
      if (typeFilter !== "all" && f.type !== typeFilter) return false
      if (tagFilter !== "all" && f.tag !== tagFilter) return false
      if (
        q &&
        !(
          f.name.toLowerCase().includes(q) ||
          f.url?.toLowerCase().includes(q) ||
          f.description?.toLowerCase().includes(q)
        )
      )
        return false
      return true
    })
    const dir = sortDir === "asc" ? 1 : -1
    // Folders always lead, like every file manager; they only follow the
    // chosen direction when the sort IS by name.
    const folders = filtered
      .filter((f) => f.source === "folder")
      .sort((a, b) => byName(a, b) * (sortKey === "name" ? dir : 1))
    const items = filtered
      .filter((f) => f.source !== "folder")
      .sort((a, b) => compare(a, b, sortKey) * dir || byName(a, b))
    return [...folders, ...items]
  }, [allRows, sourceFilter, typeFilter, tagFilter, q, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  // Derived, not synced: a page number only means anything for the filter set
  // it was chosen under, so it is stored WITH that set and falls back to 1 the
  // moment the set changes. Clamping covers a filter that narrows the list.
  const filterKey = `${folderId ?? ""}|${q}|${sourceFilter}|${typeFilter}|${tagFilter}`
  const page = pageState.key === filterKey ? Math.min(pageState.page, totalPages) : 1
  const setPage = (p: number) => setPageState({ key: filterKey, page: p })

  const paged = useMemo(() => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [rows, page])
  const rowKey = (f: UnifiedFile) => `${f.source}-${f.id}`
  const pageIds = useMemo(() => paged.map(rowKey), [paged])
  const selection = useRowSelection(pageIds)
  const selectedRows = useMemo(
    () => rows.filter((f) => selection.isSelected(rowKey(f))),
    [rows, selection],
  )
  /** Navigate into a folder. Clears the selection on the way: rows picked in
   *  one folder must not silently ride along into the next. */
  const goToFolder = (id: string | null) => {
    selection.clear()
    setFolderParam(id)
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else {
      setSortKey(key)
      setSortDir(key === "modified" || key === "size" ? "desc" : "asc")
    }
  }

  // ── Permissions (the API enforces; these only decide what to show) ──────────
  const canEdit = (f: UnifiedFile) =>
    canManage || f.source === "drive" || (f.ownerId !== null && f.ownerId === me)
  const canDelete = (f: UnifiedFile) => (f.source === "drive" ? canManage : canEdit(f))
  const canDownload = (f: UnifiedFile) =>
    (f.source === "b2" || f.source === "drive") && f.type !== "doc" && f.type !== "sheet"

  // ── Uploads ────────────────────────────────────────────────────────────────
  function pickFor(source: "b2" | "drive") {
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
        if (target === "drive") await uploadDrive.mutateAsync({ file, folderId })
        else await uploadB2.mutateAsync({ file, category: "OTHER", folderId })
      } catch {
        // The hook already toasted the reason; just track it for the summary.
        failed.push(file.name)
      }
      setProgress({ done: i + 1, total: queue.length })
    }
    setProgress(null)

    const ok = queue.length - failed.length
    const where = currentFolderName ? ` to "${currentFolderName}"` : ""
    if (ok > 0 && failed.length === 0) {
      toast.success(
        ok === 1 ? `Uploaded "${queue[0]!.name}"${where}` : `Uploaded ${ok} files${where}`,
      )
    } else if (ok > 0) {
      toast.warning(`${ok} uploaded · ${failed.length} failed`)
    }
  }

  // ── Drag-and-drop + paste ──────────────────────────────────────────────────
  const dragDepth = useRef(0)
  const [dragging, setDragging] = useState(false)
  const dragHasPayload = (dt: DataTransfer | null) =>
    !!dt && Array.from(dt.types).some((t) => t === "Files" || t === "text/uri-list")

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    const files = Array.from(e.dataTransfer.files ?? [])
    if (files.length > 0) {
      targetRef.current = "b2"
      void onFilesPicked(files)
      return
    }
    const uri = (
      e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain")
    ).trim()
    if (isSafeHttpUrl(uri)) setLinkDialog({ open: true, edit: null, presetUrl: uri })
  }

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return
      // A dialog already open owns the clipboard.
      if (document.querySelector("[role='dialog']")) return
      const text = e.clipboardData?.getData("text")?.trim() ?? ""
      if (!isSafeHttpUrl(text)) return
      e.preventDefault()
      setLinkDialog({ open: true, edit: null, presetUrl: text })
    }
    document.addEventListener("paste", onPaste)
    return () => document.removeEventListener("paste", onPaste)
  }, [])

  // ── Row actions ────────────────────────────────────────────────────────────
  /** Open it: folders navigate, links and Drive files open in a tab, stored
   *  PDFs/images preview in place, anything else opens in a tab. */
  async function openItem(f: UnifiedFile) {
    if (f.source === "folder") return goToFolder(f.id)
    if (f.source === "link") return void window.open(f.url, "_blank", "noopener")
    if (f.source === "drive") {
      if (f.webViewLink) window.open(f.webViewLink, "_blank")
      return
    }
    if (f.type === "pdf" || f.type === "image") {
      try {
        const [url, downloadUrl] = await Promise.all([
          getResourceDownloadUrl(projectId, f.id),
          getResourceDownloadUrl(projectId, f.id, { download: true }),
        ])
        setPreview({
          name: f.name,
          kind: f.type,
          url,
          downloadUrl,
          subtitle: `${TYPE_META[f.type].label} · ${fmtBytes(f.size)}`,
        })
      } catch {
        toast.error("Could not open that file.")
      }
      return
    }
    const url = await getResourceDownloadUrl(projectId, f.id).catch(() => "")
    if (url) window.open(url, "_blank")
    else toast.error("Could not open that file.")
  }

  /** Save to disk. Stored files get a signed attachment URL; Drive files use
   *  Drive's export link. Google-native Docs/Sheets have no single file to save. */
  async function downloadFile(f: UnifiedFile) {
    if (f.source === "drive") {
      window.open(`https://drive.google.com/uc?export=download&id=${f.id}`, "_blank")
      return
    }
    const url = await getResourceDownloadUrl(projectId, f.id, { download: true }).catch(() => "")
    if (url) window.location.href = url
    else toast.error("Could not download that file.")
  }

  async function copyLink(f: UnifiedFile) {
    let text = ""
    let note = ""
    if (f.source === "folder") {
      const u = new URL(window.location.href)
      u.searchParams.set("folder", f.id)
      text = u.toString()
    } else if (f.source === "link") text = f.url ?? ""
    else if (f.source === "drive") text = f.webViewLink ?? ""
    else {
      text = await getResourceDownloadUrl(projectId, f.id).catch(() => "")
      note = " - valid for 15 minutes"
    }
    if (!text) return void toast.error("Nothing to copy for that item.")
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`Link copied${note}`)
    } catch {
      toast.error("Could not copy - your browser blocked clipboard access.")
    }
  }

  function renameItem(f: UnifiedFile, name: string) {
    const done = {
      onSuccess: () => {
        setRenameTarget(null)
        toast.success(`Renamed to "${name}"`)
      },
    }
    if (f.source === "folder") updateFolder.mutate({ folderId: f.id, name }, done)
    else if (f.source === "link") updateLink.mutate({ linkId: f.id, title: name }, done)
    else if (f.source === "drive") updateDriveFile.mutate({ fileId: f.id, name }, done)
    else updateResource.mutate({ fileId: f.id, fileName: name }, done)
  }

  /** Move one or many rows into a folder (null = top level). Runs the per-item
   *  endpoints with bounded concurrency; failures were already toasted by the hook. */
  async function moveItems(targets: UnifiedFile[], toFolder: string | null) {
    setMoveProgress({ done: 0, total: targets.length })
    let done = 0
    let failed = 0
    const worker = async (queue: UnifiedFile[]) => {
      for (;;) {
        const f = queue.pop()
        if (!f) return
        try {
          if (f.source === "folder")
            await updateFolder.mutateAsync({ folderId: f.id, parentId: toFolder })
          else if (f.source === "link")
            await updateLink.mutateAsync({ linkId: f.id, folderId: toFolder })
          else if (f.source === "drive")
            await updateDriveFile.mutateAsync({ fileId: f.id, folderId: toFolder })
          else await updateResource.mutateAsync({ fileId: f.id, folderId: toFolder })
        } catch {
          failed++
        }
        done++
        setMoveProgress({ done, total: targets.length })
      }
    }
    const queue = [...targets]
    await Promise.all(
      Array.from({ length: Math.min(BULK_CONCURRENCY, queue.length) }, () => worker(queue)),
    )
    setMoveProgress(null)
    setMoveTargets(null)
    selection.clear()
    const ok = targets.length - failed
    const dest = toFolder
      ? `"${allFolders.data?.find((x) => x.id === toFolder)?.name ?? "folder"}"`
      : "the top level"
    if (failed === 0) toast.success(`Moved ${ok} ${ok === 1 ? "item" : "items"} to ${dest}`)
    else if (ok > 0) toast.warning(`${ok} moved · ${failed} failed`)
    else toast.error("Nothing could be moved.")
  }

  function deleteItem(f: UnifiedFile) {
    const done = { onSuccess: () => setDeleteTarget(null) }
    if (f.source === "folder") deleteFolder.mutate(f.id, done)
    else if (f.source === "link") deleteLink.mutate(f.id, done)
    else if (f.source === "drive") delDrive.mutate(f.id, done)
    else delB2.mutate(f.id, done)
  }

  // What the Download button will ACTUALLY fetch. Counting it up front keeps the
  // label honest: a button reading "Download 25" that then saves 3 of them and
  // explains itself in a toast is a button nobody trusts twice.
  const downloadable = selectedRows.filter((f) => f.source === "b2" && canDownload(f)).length

  /**
   * Download everything selected, as separate files - NOT a zip (that would
   * stream every object back through the server). Signed URLs carry an
   * attachment disposition; they are triggered one at a time with a gap
   * because browsers drop a burst. STORED FILES ONLY: Drive answers a bulk
   * fetch with an interstitial page, so those are counted out in the toast.
   */
  async function runBulkDownload() {
    const targets = selectedRows.filter((f) => f.source === "b2" && canDownload(f))
    const skipped = selectedRows.length - targets.length
    if (targets.length === 0) {
      toast.error(
        skipped > 0
          ? "Only stored (Backblaze) files can be downloaded here."
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
      if (i < targets.length - 1) await new Promise((r) => setTimeout(r, 400))
    }
    setDlProgress(null)
    const ok = targets.length - failed
    const note = skipped > 0 ? ` · ${skipped} skipped` : ""
    if (failed === 0) toast.success(`Downloading ${ok} ${ok === 1 ? "file" : "files"}${note}`)
    else if (ok > 0) toast.warning(`${ok} downloading · ${failed} failed${note}`)
    else toast.error("Nothing could be downloaded.")
  }

  /** Delete everything selected through the per-item endpoints, so permission
   *  checks, storage cleanup and the audit trail stay in one place. */
  async function runBulkDelete() {
    const targets = selectedRows
    if (targets.length === 0) return
    setBulkProgress({ done: 0, total: targets.length })
    let done = 0
    let failed = 0
    const worker = async (queue: UnifiedFile[]) => {
      for (;;) {
        const f = queue.pop()
        if (!f) return
        try {
          if (f.source === "folder") await deleteFolder.mutateAsync(f.id)
          else if (f.source === "link") await deleteLink.mutateAsync(f.id)
          else if (f.source === "drive") await delDrive.mutateAsync(f.id)
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
    if (failed === 0) toast.success(`Deleted ${ok} ${ok === 1 ? "item" : "items"}`)
    else if (ok > 0) toast.warning(`${ok} deleted · ${failed} failed`)
    else toast.error("Nothing could be deleted.")
  }

  const uploading = progress !== null || uploadB2.isPending || uploadDrive.isPending
  const renaming =
    updateFolder.isPending ||
    updateLink.isPending ||
    updateDriveFile.isPending ||
    updateResource.isPending

  // ── Columns ────────────────────────────────────────────────────────────────
  // A plain element factory, not a component: defining a component inside
  // render would remount the header (and drop its focus) on every state change.
  const sortHeader = (label: string, k: SortKey) => {
    const active = sortKey === k
    const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown
    return (
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className={cn(
          "hover:text-foreground inline-flex items-center gap-1 whitespace-nowrap",
          active && "text-foreground",
        )}
        title={`Sort by ${label.toLowerCase()}`}
      >
        {label}
        <Icon className={cn("h-3 w-3", !active && "opacity-50")} />
      </button>
    )
  }

  const columns: DataTableColumn<UnifiedFile>[] = [
    {
      header: sortHeader("Name", "name"),
      // The ONE column that flexes. `w-full max-w-0` is the CSS table recipe
      // for it: the cell claims whatever width the fixed columns leave, and
      // max-width:0 is what lets the child actually truncate.
      className: "w-full max-w-0",
      headClassName: "w-full",
      cell: (f) => {
        const m = TYPE_META[f.type]
        const sub =
          f.source === "folder"
            ? `${f.itemCount ?? 0} ${f.itemCount === 1 ? "item" : "items"}`
            : f.source === "link"
              ? hostOf(f.url ?? "")
              : null
        return (
          <button
            type="button"
            onClick={() => void openItem(f)}
            title={f.source === "link" ? f.url : f.name}
            className="flex w-full min-w-0 items-center gap-2.5 text-left"
          >
            <m.icon className={cn("h-4 w-4 shrink-0", m.tint)} />
            <span className="min-w-0">
              <span className="block truncate font-medium hover:underline">{f.name}</span>
              {sub && (
                <span className="text-muted-foreground block truncate text-[11px]">{sub}</span>
              )}
            </span>
          </button>
        )
      },
    },
    {
      header: "Tag",
      className: "whitespace-nowrap",
      cell: (f) => {
        if (f.source === "folder") return <span className="text-muted-foreground">-</span>
        // Only stored tags are editable (B2 files and links), and only by
        // someone allowed to edit the row. A Drive file has no row of ours to
        // write the change to, so offering the menu there would silently do nothing.
        const editable = (f.source === "b2" || f.source === "link") && canEdit(f)
        const chip = f.tag ? (
          <TagChip tag={f.tag} muted={!f.tagIsStored} />
        ) : (
          <span className="text-muted-foreground text-xs">No tag</span>
        )
        if (!editable) return chip
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                title="Change tag"
                className="focus-visible:ring-ring rounded-sm focus-visible:ring-2 focus-visible:outline-none"
              >
                {chip}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel className="text-xs">Document type</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {DOC_TAGS.map((t) => (
                <DropdownMenuItem
                  key={t}
                  onClick={() =>
                    f.source === "link"
                      ? updateLink.mutate({ linkId: f.id, tag: t })
                      : retag.mutate({ fileId: f.id, tag: t })
                  }
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
        )
      },
    },
    {
      header: sortHeader("Type", "type"),
      className: "whitespace-nowrap",
      cell: (f) => TYPE_META[f.type].label,
    },
    { header: "Storage", className: "whitespace-nowrap", cell: (f) => <StorageCell f={f} /> },
    {
      header: sortHeader("Added by", "addedBy"),
      className: "max-w-[160px] whitespace-nowrap",
      cell: (f) => <PersonCell p={f.addedBy} />,
    },
    {
      header: sortHeader("Size", "size"),
      align: "right",
      className: "whitespace-nowrap tabular-nums",
      cell: (f) => fmtBytes(f.size),
    },
    {
      header: sortHeader("Modified", "modified"),
      className: "whitespace-nowrap",
      cell: (f) => (f.modified ? new Date(f.modified).toLocaleDateString("en-IN") : "-"),
    },
    { header: "", align: "right", className: "whitespace-nowrap", cell: (f) => rowActions(f) },
  ]

  function rowActions(f: UnifiedFile) {
    const editable = canEdit(f)
    return (
      <div className="flex items-center justify-end gap-0.5">
        <button
          type="button"
          onClick={() => void openItem(f)}
          title={
            f.source === "folder"
              ? "Open folder"
              : f.source === "drive"
                ? "View in Drive"
                : f.source === "link"
                  ? "Open link"
                  : "View"
          }
          className={iconBtn}
        >
          {f.source === "link" ? <ExternalLink className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
        {canDownload(f) && (
          <button
            type="button"
            onClick={() => void downloadFile(f)}
            title="Download"
            className={iconBtn}
          >
            <Download className="h-4 w-4" />
          </button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" title="More" className={iconBtn}>
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => void openItem(f)}>
              {f.source === "folder" ? (
                <FolderOpen className="mr-2 h-4 w-4" />
              ) : (
                <ExternalLink className="mr-2 h-4 w-4" />
              )}
              Open
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void copyLink(f)}>
              <Copy className="mr-2 h-4 w-4" /> Copy link
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDetailsTarget(f)}>
              <Info className="mr-2 h-4 w-4" /> Details
            </DropdownMenuItem>
            {editable && (
              <>
                <DropdownMenuSeparator />
                {f.source === "link" ? (
                  <DropdownMenuItem onClick={() => setLinkDialog({ open: true, edit: f })}>
                    <Pencil className="mr-2 h-4 w-4" /> Edit link
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => setRenameTarget(f)}>
                    <Pencil className="mr-2 h-4 w-4" /> Rename
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setMoveTargets([f])}>
                  <FolderInput className="mr-2 h-4 w-4" /> Move to...
                </DropdownMenuItem>
              </>
            )}
            {canDelete(f) && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setDeleteTarget(f)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {f.source === "drive" ? "Move to trash" : "Delete"}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }

  if (listing.isLoading && !data) return <ListSkeleton rows={4} height="h-14" className="mt-4" />

  // How many of each tag are in the CURRENT folder, so the filter can say
  // what picking it will get you instead of leading to an empty table.
  const tagCounts = new Map<DocTag, number>()
  for (const f of allRows) if (f.tag) tagCounts.set(f.tag, (tagCounts.get(f.tag) ?? 0) + 1)

  const path = data?.path ?? []
  const folderLabel = currentFolderName ?? "Files"
  const deleteCopy = (f: UnifiedFile | null) => {
    if (!f) return { title: "", description: "", label: "Delete" }
    switch (f.source) {
      case "folder":
        return {
          title: "Delete folder?",
          description: `"${f.name}" will be deleted. A folder can only be deleted when it is empty.`,
          label: "Delete folder",
        }
      case "link":
        return {
          title: "Remove link?",
          description: `"${f.name}" will be removed from this project. The page it points to is not affected.`,
          label: "Remove",
        }
      case "drive":
        return {
          title: "Move to trash?",
          description: `"${f.name}" will be moved to the Shared Drive trash (recoverable from Drive).`,
          label: "Move to trash",
        }
      default:
        return {
          title: "Delete file?",
          description: `"${f.name}" will be permanently deleted from Backblaze storage.`,
          label: "Delete",
        }
    }
  }
  const del = deleteCopy(deleteTarget)
  const deleting =
    delB2.isPending || delDrive.isPending || deleteFolder.isPending || deleteLink.isPending

  return (
    <div
      className="relative mt-4 space-y-4"
      onDragEnter={(e) => {
        if (!dragHasPayload(e.dataTransfer)) return
        e.preventDefault()
        dragDepth.current++
        setDragging(true)
      }}
      onDragOver={(e) => {
        if (dragHasPayload(e.dataTransfer)) e.preventDefault()
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (dragDepth.current === 0) setDragging(false)
      }}
      onDrop={onDrop}
    >
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

      {dragging && (
        <div className="border-primary bg-background/90 pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-sm border-2 border-dashed">
          <div className="text-center">
            <Upload className="text-primary mx-auto mb-2 h-8 w-8" />
            <p className="font-medium">Drop to upload to {folderLabel}</p>
            <p className="text-muted-foreground text-xs">
              Files go to Backblaze · drop a URL to save it as a link
            </p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button loading={uploading} disabled={uploading}>
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              {progress ? `Uploading ${progress.done}/${progress.total}` : "Upload"}
              <ChevronDown className="ml-1 h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
              Into {folderLabel}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" loading={createDoc.isPending}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New
              <ChevronDown className="ml-1 h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
              In {folderLabel}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setNewFolderOpen(true)}>
              <FolderPlus className="mr-2 h-4 w-4 text-amber-500" /> Folder
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLinkDialog({ open: true, edit: null })}>
              <Link2 className="mr-2 h-4 w-4 text-sky-500" /> Link
            </DropdownMenuItem>
            {driveConfigured && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => createDoc.mutate({ kind: "doc", name: "Untitled doc", folderId })}
                >
                  <FileText className="mr-2 h-4 w-4 text-blue-500" /> Google Doc
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    createDoc.mutate({ kind: "sheet", name: "Untitled sheet", folderId })
                  }
                >
                  <SheetIcon className="mr-2 h-4 w-4 text-emerald-500" /> Google Sheet
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ml-auto flex items-center gap-2">
          {driveConfigured && (
            <>
              <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                <Users className="h-3.5 w-3.5" />
                {data?.drive.memberCount ?? 0} with Drive access
              </span>
              {canManage && (
                <Button
                  size="icon"
                  variant="ghost"
                  title="Re-sync Drive access to current members"
                  onClick={() => sync.mutate()}
                  loading={sync.isPending}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              )}
              {data?.drive.folderLink && (
                <Button variant="outline" asChild>
                  <a href={data.drive.folderLink} target="_blank" rel="noreferrer">
                    <FolderOpen className="mr-1.5 h-3.5 w-3.5" /> Open in Drive
                  </a>
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Breadcrumb */}
      <nav aria-label="Folder" className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
        <button
          type="button"
          onClick={() => goToFolder(null)}
          className={cn(
            "hover:bg-muted inline-flex items-center gap-1.5 rounded-sm px-1.5 py-1",
            !folderId ? "text-foreground font-medium" : "text-muted-foreground",
          )}
        >
          <Home className="h-3.5 w-3.5" /> Files
        </button>
        {path.map((p, i) => {
          const last = i === path.length - 1
          return (
            <span key={p.id} className="flex min-w-0 items-center gap-1">
              <ChevronRight className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
              <button
                type="button"
                onClick={() => goToFolder(p.id)}
                className={cn(
                  "hover:bg-muted max-w-[220px] truncate rounded-sm px-1.5 py-1",
                  last ? "text-foreground font-medium" : "text-muted-foreground",
                )}
                title={p.name}
              >
                {p.name}
              </button>
            </span>
          )
        })}
        {listing.isFetching && (
          <RefreshCw className="text-muted-foreground ml-1 h-3 w-3 animate-spin" />
        )}
      </nav>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={`Search in ${folderLabel}...`}
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
            <SelectItem value="link">Links</SelectItem>
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
            <SelectItem value="link">Links</SelectItem>
            <SelectItem value="other">Other files</SelectItem>
          </SelectContent>
        </Select>
        {(q || tagFilter !== "all" || sourceFilter !== "all" || typeFilter !== "all") && (
          <Button
            variant="ghost"
            size="default"
            onClick={() => {
              setSearch("")
              setTagFilter("all")
              setSourceFilter("all")
              setTypeFilter("all")
            }}
          >
            Clear
          </Button>
        )}
        <span className="text-muted-foreground ml-auto text-xs tabular-nums">
          {rows.length} of {allRows.length}
        </span>
      </div>

      {/* Bulk actions. Delete needs manage rights (matching the per-row rule
          for Drive files); move and download are open to everyone. */}
      <BulkActionBar count={selection.count} onClear={selection.clear} label="selected">
        <Button
          variant="outline"
          onClick={() => void runBulkDownload()}
          loading={dlProgress !== null}
          disabled={dlProgress !== null || bulkProgress !== null || downloadable === 0}
          title={downloadable === 0 ? "Only stored (Backblaze) files download here" : undefined}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          {dlProgress
            ? `Downloading ${dlProgress.done}/${dlProgress.total}`
            : `Download ${downloadable}`}
        </Button>
        <Button
          variant="outline"
          onClick={() => setMoveTargets(selectedRows)}
          disabled={bulkProgress !== null || dlProgress !== null}
        >
          <FolderInput className="mr-1.5 h-3.5 w-3.5" /> Move {selection.count}
        </Button>
        {canManage && (
          <Button
            variant="destructive"
            onClick={() => setBulkOpen(true)}
            disabled={bulkProgress !== null || dlProgress !== null}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete {selection.count}
          </Button>
        )}
      </BulkActionBar>

      {/* Table */}
      {allRows.length === 0 ? (
        <EmptyState
          compact
          icon={FolderOpen}
          title={folderId ? "This folder is empty." : "No files yet."}
          description="Drop files here, or use Upload / New to add a file, folder or link."
        />
      ) : rows.length === 0 ? (
        <EmptyState compact icon={FolderOpen} title="Nothing matches these filters." />
      ) : (
        <div className={cn(listing.isFetching && listing.isPlaceholderData && "opacity-60")}>
          <DataTable
            columns={columns}
            rows={paged}
            rowKey={rowKey}
            showSerial
            serialOffset={(page - 1) * PAGE_SIZE}
            selection={selection}
            minWidth="min-w-[980px]"
            mobileCard={(f) => <FileCard file={f} actions={rowActions(f)} />}
            pagination={{
              page,
              totalPages,
              total: rows.length,
              onPageChange: setPage,
              itemLabel: "item",
            }}
          />
        </div>
      )}

      {/* ── Dialogs ─────────────────────────────────────────────────────── */}
      <NameDialog
        open={newFolderOpen}
        onOpenChange={setNewFolderOpen}
        title="New folder"
        description={
          folderId ? `Inside "${folderLabel}".` : "At the top level of this project's files."
        }
        label="Folder name"
        placeholder="e.g. Contracts, Creatives, Research"
        submitLabel="Create folder"
        pending={createFolder.isPending}
        onSubmit={(name) =>
          createFolder.mutate(
            { name, parentId: folderId },
            { onSuccess: () => setNewFolderOpen(false) },
          )
        }
      />

      <NameDialog
        open={renameTarget !== null}
        onOpenChange={(o) => !o && setRenameTarget(null)}
        title={renameTarget?.source === "folder" ? "Rename folder" : "Rename file"}
        label="Name"
        initial={renameTarget?.name ?? ""}
        submitLabel="Rename"
        pending={renaming}
        onSubmit={(name) => renameTarget && renameItem(renameTarget, name)}
      />

      <LinkDialog
        open={linkDialog.open}
        onOpenChange={(o) => !o && setLinkDialog({ open: false, edit: null })}
        folderName={currentFolderName}
        initial={
          linkDialog.edit
            ? {
                title: linkDialog.edit.name,
                url: linkDialog.edit.url ?? "",
                tag: linkDialog.edit.tag,
                description: linkDialog.edit.description ?? null,
              }
            : linkDialog.presetUrl
              ? { url: linkDialog.presetUrl }
              : undefined
        }
        pending={createLink.isPending || updateLink.isPending}
        onSubmit={(values: LinkFormValues) => {
          const close = { onSuccess: () => setLinkDialog({ open: false, edit: null }) }
          if (linkDialog.edit) {
            updateLink.mutate(
              { linkId: linkDialog.edit.id, ...values },
              {
                onSuccess: () => {
                  close.onSuccess()
                  toast.success("Link updated")
                },
              },
            )
          } else {
            createLink.mutate({ ...values, folderId }, close)
          }
        }}
      />

      <FolderPickerDialog
        open={moveTargets !== null}
        onOpenChange={(o) => !o && setMoveTargets(null)}
        folders={allFolders.data ?? []}
        loading={allFolders.isLoading}
        title={
          moveTargets && moveTargets.length === 1
            ? `Move "${moveTargets[0]!.name}"`
            : `Move ${moveTargets?.length ?? 0} items`
        }
        description="Pick the folder to move into. Drive files move in Drive too."
        currentFolderId={folderId}
        excludeFolderIds={moveTargets?.filter((f) => f.source === "folder").map((f) => f.id)}
        submitLabel={
          moveProgress ? `Moving ${moveProgress.done}/${moveProgress.total}` : "Move here"
        }
        pending={moveProgress !== null}
        onPick={(to) => moveTargets && void moveItems(moveTargets, to)}
      />

      <Dialog open={detailsTarget !== null} onOpenChange={(o) => !o && setDetailsTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="truncate pr-6">{detailsTarget?.name}</DialogTitle>
            <DialogDescription>
              {detailsTarget ? TYPE_META[detailsTarget.type].label : ""}
            </DialogDescription>
          </DialogHeader>
          {detailsTarget && (
            <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Location</dt>
              <dd className="truncate">{["Files", ...path.map((p) => p.name)].join(" / ")}</dd>
              <dt className="text-muted-foreground">Storage</dt>
              <dd>
                <StorageCell f={detailsTarget} />
              </dd>
              {detailsTarget.source !== "folder" && (
                <>
                  <dt className="text-muted-foreground">Tag</dt>
                  <dd>
                    {detailsTarget.tag ? (
                      <TagChip tag={detailsTarget.tag} muted={!detailsTarget.tagIsStored} />
                    ) : (
                      "-"
                    )}
                  </dd>
                </>
              )}
              {detailsTarget.size !== null && (
                <>
                  <dt className="text-muted-foreground">Size</dt>
                  <dd className="tabular-nums">{fmtBytes(detailsTarget.size)}</dd>
                </>
              )}
              {detailsTarget.mimeType && (
                <>
                  <dt className="text-muted-foreground">MIME type</dt>
                  <dd className="truncate">{detailsTarget.mimeType}</dd>
                </>
              )}
              {detailsTarget.url && (
                <>
                  <dt className="text-muted-foreground">URL</dt>
                  <dd className="truncate">
                    <a
                      href={detailsTarget.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                    >
                      {detailsTarget.url}
                    </a>
                  </dd>
                </>
              )}
              {detailsTarget.source === "folder" && (
                <>
                  <dt className="text-muted-foreground">Contains</dt>
                  <dd>
                    {detailsTarget.itemCount ?? 0}{" "}
                    {detailsTarget.itemCount === 1 ? "item" : "items"}
                    {detailsTarget.driveFolderId ? " · mirrored in Drive" : ""}
                  </dd>
                </>
              )}
              <dt className="text-muted-foreground">
                {detailsTarget.source === "drive" ? "Last edited by" : "Added by"}
              </dt>
              <dd>
                <PersonCell p={detailsTarget.addedBy} />
              </dd>
              <dt className="text-muted-foreground">Modified</dt>
              <dd>
                {detailsTarget.modified
                  ? new Date(detailsTarget.modified).toLocaleString("en-IN")
                  : "-"}
              </dd>
              {detailsTarget.description && (
                <>
                  <dt className="text-muted-foreground">Notes</dt>
                  <dd className="whitespace-pre-wrap">{detailsTarget.description}</dd>
                </>
              )}
            </dl>
          )}
        </DialogContent>
      </Dialog>

      <FilePreviewSheet item={preview} onClose={() => setPreview(null)} />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={del.title}
        description={del.description}
        variant="destructive"
        confirmLabel={del.label}
        isLoading={deleting}
        onConfirm={() => deleteTarget && deleteItem(deleteTarget)}
      />

      {/* The bulk confirm spells out the split, because the halves of a mixed
          selection do genuinely different things: Drive files go to a trash
          you can empty later, stored files and links are gone. */}
      <ConfirmDialog
        open={bulkOpen}
        onOpenChange={(o) => !o && setBulkOpen(false)}
        title={`Delete ${selectedRows.length} ${selectedRows.length === 1 ? "item" : "items"}?`}
        description={(() => {
          const n = (s: Source) => selectedRows.filter((f) => f.source === s).length
          const parts: string[] = []
          const b2 = n("b2")
          const dr = n("drive")
          const li = n("link")
          const fo = n("folder")
          if (b2)
            parts.push(`${b2} stored ${b2 === 1 ? "file" : "files"} will be permanently deleted`)
          if (dr)
            parts.push(
              `${dr} Drive ${dr === 1 ? "file" : "files"} will be moved to the Shared Drive trash`,
            )
          if (li) parts.push(`${li} ${li === 1 ? "link" : "links"} will be removed`)
          if (fo)
            parts.push(`${fo} ${fo === 1 ? "folder" : "folders"} will be deleted (only if empty)`)
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
