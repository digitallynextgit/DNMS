"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { EmptyState } from "@/components/shared/empty-state"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { FormDialog } from "@/components/shared/form-dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  useProjectResources,
  useProjectTeams,
  useUploadResource,
  useDeleteResource,
  useShareResource,
  useReviewResource,
  getResourceDownloadUrl,
  type ProjectResource,
} from "@/features/projects/hooks/use-projects"
import {
  Upload,
  Download,
  Trash2,
  Eye,
  EyeOff,
  FileText,
  Folder,
  Inbox,
  FileCode,
  FileImage,
  FileVideo,
  FileArchive,
} from "lucide-react"
import { cn, formatDate } from "@/lib/utils"
import { StatusBadge } from "@/components/shared/status-badge"
import { RESOURCE_CATEGORY_COLORS } from "@/lib/constants"

const CATEGORY_LABELS: Record<string, string> = {
  BRIEFS: "Briefs",
  ASSETS: "Assets",
  DELIVERABLES: "Deliverables",
  REFERENCES: "References",
  OTHER: "Other",
}

function fileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return FileImage
  if (mimeType.startsWith("video/")) return FileVideo
  if (mimeType.includes("zip") || mimeType.includes("compressed")) return FileArchive
  if (mimeType.includes("javascript") || mimeType.includes("json") || mimeType.includes("xml"))
    return FileCode
  return FileText
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

interface Props {
  projectId: string
  currentUserId: string
  isProjectAdmin: boolean
}

export function ResourcesTab({ projectId, currentUserId, isProjectAdmin }: Props) {
  const [teamFilter, setTeamFilter] = useState<string>("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [uploadOpen, setUploadOpen] = useState(false)

  const filters: { teamId?: string; category?: string } = {}
  if (teamFilter === "project") filters.teamId = "null"
  else if (teamFilter !== "all") filters.teamId = teamFilter
  if (categoryFilter !== "all") filters.category = categoryFilter

  const { data, isLoading } = useProjectResources(projectId, filters)
  const { data: teamsData } = useProjectTeams(projectId)
  const teams = teamsData?.data ?? []
  const resources = data?.data ?? []

  const filtered = teamFilter !== "all" || categoryFilter !== "all"
  const uploaderName = (r: ProjectResource) =>
    r.uploadedBy
      ? `${r.uploadedBy.firstName} ${r.uploadedBy.lastName}`
      : (r.uploadedByClient?.name ?? "Client")

  const columns: DataTableColumn<ProjectResource>[] = [
    {
      header: "File",
      sortValue: (r) => r.fileName,
      className: "max-w-[280px]",
      cell: (r) => {
        const Icon = fileIcon(r.mimeType)
        return (
          <div className="flex min-w-0 items-center gap-2">
            <Icon className="text-muted-foreground h-5 w-5 shrink-0" />
            <div className="min-w-0">
              <p className="truncate font-medium" title={r.fileName}>
                {r.fileName}
              </p>
              {r.description && (
                <p className="text-muted-foreground truncate text-xs" title={r.description}>
                  {r.description}
                </p>
              )}
            </div>
          </div>
        )
      },
    },
    {
      header: "Category",
      sortValue: (r) => CATEGORY_LABELS[r.category] ?? r.category,
      cell: (r) => (
        <StatusBadge
          status={r.category}
          colorMap={RESOURCE_CATEGORY_COLORS}
          label={CATEGORY_LABELS[r.category]}
        />
      ),
    },
    {
      header: "Scope",
      sortValue: (r) => r.team?.name ?? "Project-level",
      cell: (r) =>
        r.team ? (
          <span className="text-xs">
            <Folder className="mr-1 inline h-3 w-3" />
            {r.team.name}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">Project-level</span>
        ),
    },
    {
      header: "Size",
      align: "right",
      sortValue: (r) => r.fileSize,
      className: "text-muted-foreground text-xs tabular-nums",
      cell: (r) => formatBytes(r.fileSize),
    },
    {
      header: "Uploaded by",
      sortValue: uploaderName,
      // uploadedBy is null for client-portal uploads (a client isn't an employee).
      cell: (r) => (
        <div className="flex items-center gap-1.5">
          <AvatarDisplay
            src={r.uploadedBy?.profilePhoto ?? null}
            firstName={r.uploadedBy?.firstName ?? r.uploadedByClient?.name ?? "Client"}
            lastName={r.uploadedBy?.lastName ?? ""}
            size="xs"
          />
          <span className="text-xs">{uploaderName(r)}</span>
          {!r.uploadedBy && <span className="text-muted-foreground text-[10px]">· client</span>}
        </div>
      ),
    },
    {
      header: "When",
      sortValue: (r) => r.createdAt,
      className: "text-muted-foreground text-xs",
      cell: (r) => formatDate(r.createdAt),
    },
    {
      header: "",
      align: "right",
      cell: (r) => (
        <ResourceActions
          resource={r}
          projectId={projectId}
          currentUserId={currentUserId}
          isProjectAdmin={isProjectAdmin}
        />
      ),
    },
  ]

  const uploadButton = (
    <Button onClick={() => setUploadOpen(true)}>
      <Upload className="mr-1 h-4 w-4" />
      Upload File
    </Button>
  )

  return (
    <div className="space-y-4">
      {/* The filters live in the table, so it stays up whenever one is set, even while loading. */}
      {!isLoading && resources.length === 0 && !filtered ? (
        <EmptyState
          compact
          icon={Inbox}
          title="No files uploaded yet."
          action={{ label: "Upload File", onClick: () => setUploadOpen(true) }}
        />
      ) : (
        <DataTable
          tableId="project-resources"
          itemLabel="file"
          columns={columns}
          rows={resources}
          rowKey={(r) => r.id}
          showSerial
          loading={isLoading}
          pageKey={`${teamFilter}|${categoryFilter}`}
          toolbar={
            <>
              <Select value={teamFilter} onValueChange={setTeamFilter}>
                <SelectTrigger className="h-9 w-44" aria-label="Scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All resources</SelectItem>
                  <SelectItem value="project">Project-level only</SelectItem>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-9 w-40" aria-label="Category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          }
          toolbarEnd={uploadButton}
          empty="No files match these filters."
        />
      )}

      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        projectId={projectId}
        teams={teams}
      />
    </div>
  )
}

function ResourceActions({
  resource,
  projectId,
  currentUserId,
  isProjectAdmin,
}: {
  resource: ProjectResource
  projectId: string
  currentUserId: string
  isProjectAdmin: boolean
}) {
  const del = useDeleteResource(projectId)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [changesOpen, setChangesOpen] = useState(false)
  const [changeNote, setChangeNote] = useState("")

  async function handleDownload() {
    try {
      const url = await getResourceDownloadUrl(projectId, resource.id)
      window.open(url, "_blank")
    } catch (e) {
      // toast handled by hook
    }
  }

  const canDelete = resource.uploadedById === currentUserId || isProjectAdmin
  const shared = resource.isClientVisible === true

  // Portal sharing is a project-manager act; the API enforces it, hiding the button is a courtesy.
  const share = useShareResource(projectId)
  const review = useReviewResource(projectId)

  // Only client uploads still awaiting a decision; staff-shared files are the client's to approve.
  const needsOurReview =
    isProjectAdmin && !!resource.uploadedByClient && resource.reviewStatus === "IN_REVIEW"

  return (
    <>
      {isProjectAdmin && (
        <Button
          variant="ghost"
          size="icon"
          disabled={share.isPending}
          onClick={() => share.mutate({ fileId: resource.id, isClientVisible: !shared })}
          aria-label={
            shared
              ? `Stop sharing ${resource.fileName}`
              : `Share ${resource.fileName} with the client`
          }
          title={
            shared
              ? "Shared with the client - click to stop sharing"
              : "Share with the client portal"
          }
          className={cn(shared && "text-emerald-600 hover:text-emerald-700")}
        >
          {shared ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </Button>
      )}
      {needsOurReview && (
        <>
          <Button
            variant="outline"
            disabled={review.isPending}
            onClick={() => review.mutate({ fileId: resource.id, reviewStatus: "APPROVED" })}
            title="Accept this client upload"
          >
            Accept
          </Button>
          <Button
            variant="ghost"
            disabled={review.isPending}
            onClick={() => setChangesOpen(true)}
            title="Ask the client for changes"
          >
            Changes
          </Button>
        </>
      )}
      <Button variant="ghost" size="icon" onClick={handleDownload} aria-label="Download">
        <Download className="h-3.5 w-3.5" />
      </Button>
      {canDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
      <FormDialog
        open={changesOpen}
        onOpenChange={setChangesOpen}
        title="Request changes"
        description={resource.fileName}
        submitLabel="Send request"
        submitVariant="destructive"
        submitDisabled={!changeNote.trim()}
        isPending={review.isPending}
        size="sm"
        onSubmit={(e) => {
          e.preventDefault()
          review.mutate(
            {
              fileId: resource.id,
              reviewStatus: "CHANGES_REQUESTED",
              reviewNote: changeNote.trim(),
            },
            {
              onSuccess: () => {
                setChangesOpen(false)
                setChangeNote("")
              },
            },
          )
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="staff-change-note">What needs changing?</Label>
          <Textarea
            id="staff-change-note"
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="The client sees this in their portal."
          />
        </div>
      </FormDialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete file"
        description={`Delete "${resource.fileName}"?`}
        confirmLabel="Delete"
        variant="destructive"
        isLoading={del.isPending}
        onConfirm={() => del.mutate(resource.id, { onSuccess: () => setConfirmOpen(false) })}
      />
    </>
  )
}

function UploadDialog({
  open,
  onClose,
  projectId,
  teams,
}: {
  open: boolean
  onClose: () => void
  projectId: string
  teams: Array<{ id: string; name: string }>
}) {
  const [file, setFile] = useState<File | null>(null)
  const [teamId, setTeamId] = useState<string>("project")
  const [category, setCategory] = useState("OTHER")
  const [description, setDescription] = useState("")
  const fileInput = useRef<HTMLInputElement>(null)
  const upload = useUploadResource(projectId)

  function reset() {
    setFile(null)
    setTeamId("project")
    setCategory("OTHER")
    setDescription("")
    if (fileInput.current) fileInput.current.value = ""
  }

  function handleUpload() {
    if (!file) return
    upload.mutate(
      {
        file,
        teamId: teamId === "project" ? null : teamId,
        category,
        description: description.trim() || undefined,
      },
      {
        onSuccess: () => {
          reset()
          onClose()
        },
      },
    )
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose()
          reset()
        }
      }}
      title="Upload File"
      isPending={upload.isPending}
      submitDisabled={!file || file.size > 100 * 1024 * 1024}
      submitLabel="Upload"
      onSubmit={(e) => {
        e.preventDefault()
        handleUpload()
      }}
    >
      <div className="space-y-2">
        <Label required>File (max 100 MB)</Label>
        <input
          ref={fileInput}
          type="file"
          className="text-foreground file:bg-muted file:text-foreground hover:file:bg-muted/80 block w-full text-sm file:mr-3 file:rounded-sm file:border-0 file:px-3 file:py-1.5 file:text-xs file:font-medium"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {file && (
          <p className="text-muted-foreground text-xs">
            {file.name} - {formatBytes(file.size)}
            {file.size > 100 * 1024 * 1024 && (
              <span className="text-destructive ml-2">⚠️ Exceeds 100 MB</span>
            )}
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Scope</Label>
          <Select value={teamId} onValueChange={setTeamId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="project">Project-level</SelectItem>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Description (optional)</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </div>
    </FormDialog>
  )
}
