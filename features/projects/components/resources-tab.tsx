"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
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
  getResourceDownloadUrl,
  type ProjectResource,
} from "@/features/projects/hooks/use-projects"
import {
  Upload,
  Download,
  Trash2,
  FileText,
  Folder,
  Inbox,
  FileCode,
  FileImage,
  FileVideo,
  FileArchive,
} from "lucide-react"
import { formatDate } from "@/lib/utils"
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

  const columns: DataTableColumn<ProjectResource>[] = [
    {
      header: "File",
      cell: (r) => {
        const Icon = fileIcon(r.mimeType)
        return (
          <div className="flex items-center gap-2">
            <Icon className="text-muted-foreground h-5 w-5 shrink-0" />
            <div className="min-w-0">
              <p className="truncate font-medium">{r.fileName}</p>
              {r.description && (
                <p className="text-muted-foreground truncate text-xs">{r.description}</p>
              )}
            </div>
          </div>
        )
      },
    },
    {
      header: "Category",
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
      className: "text-muted-foreground text-xs",
      cell: (r) => formatBytes(r.fileSize),
    },
    {
      header: "Uploaded by",
      cell: (r) => (
        <div className="flex items-center gap-1.5">
          <AvatarDisplay
            src={r.uploadedBy.profilePhoto}
            firstName={r.uploadedBy.firstName}
            lastName={r.uploadedBy.lastName}
            size="xs"
          />
          <span className="text-xs">
            {r.uploadedBy.firstName} {r.uploadedBy.lastName}
          </span>
        </div>
      ),
    },
    {
      header: "When",
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs">Scope</Label>
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="h-8 w-44 text-sm">
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
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Category</Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-8 w-36 text-sm">
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
          </div>
        </div>
        <Button size="sm" onClick={() => setUploadOpen(true)}>
          <Upload className="mr-1 h-4 w-4" />
          Upload File
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 rounded-lg" />
      ) : resources.length === 0 ? (
        <EmptyState compact icon={Inbox} title="No files uploaded yet." />
      ) : (
        <DataTable columns={columns} rows={resources} rowKey={(r) => r.id} showSerial />
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

  async function handleDownload() {
    try {
      const url = await getResourceDownloadUrl(projectId, resource.id)
      window.open(url, "_blank")
    } catch (e) {
      // toast handled by hook
    }
  }

  const canDelete = resource.uploadedById === currentUserId || isProjectAdmin

  return (
    <>
      <Button variant="ghost" size="icon-sm" onClick={handleDownload}>
        <Download className="h-3.5 w-3.5" />
      </Button>
      {canDelete && (
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
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
        <Label>File (max 100 MB)</Label>
        <input
          ref={fileInput}
          type="file"
          className="text-foreground file:bg-muted file:text-foreground hover:file:bg-muted/80 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:px-3 file:py-1.5 file:text-xs file:font-medium"
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
