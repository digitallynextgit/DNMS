"use client"

import { useState, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
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
} from "@/hooks/use-projects"
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
import { cn, formatDate, getInitials } from "@/lib/utils"

const CATEGORY_LABELS: Record<string, string> = {
  BRIEFS: "Briefs",
  ASSETS: "Assets",
  DELIVERABLES: "Deliverables",
  REFERENCES: "References",
  OTHER: "Other",
}

const CATEGORY_COLORS: Record<string, string> = {
  BRIEFS:
    "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
  ASSETS:
    "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
  DELIVERABLES:
    "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  REFERENCES:
    "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  OTHER: "bg-muted text-muted-foreground border-border",
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
        <Skeleton className="h-64 rounded" />
      ) : resources.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Inbox className="text-muted-foreground/40 mx-auto mb-2 h-8 w-8" />
            <p className="text-muted-foreground text-sm">No files uploaded yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-border border-b">
                  <tr className="text-muted-foreground text-left text-xs tracking-wider uppercase">
                    <th className="px-4 py-2.5 font-medium">File</th>
                    <th className="px-4 py-2.5 font-medium">Category</th>
                    <th className="px-4 py-2.5 font-medium">Scope</th>
                    <th className="px-4 py-2.5 font-medium">Size</th>
                    <th className="px-4 py-2.5 font-medium">Uploaded by</th>
                    <th className="px-4 py-2.5 font-medium">When</th>
                    <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {resources.map((r) => (
                    <ResourceRow
                      key={r.id}
                      resource={r}
                      projectId={projectId}
                      currentUserId={currentUserId}
                      isProjectAdmin={isProjectAdmin}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
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

function ResourceRow({
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
  const Icon = fileIcon(resource.mimeType)

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
    <tr className="hover:bg-muted/30 transition-colors">
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Icon className="text-muted-foreground h-5 w-5 shrink-0" />
          <div className="min-w-0">
            <p className="truncate font-medium">{resource.fileName}</p>
            {resource.description && (
              <p className="text-muted-foreground truncate text-xs">{resource.description}</p>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-2.5">
        <Badge variant="outline" className={cn("text-xs", CATEGORY_COLORS[resource.category])}>
          {CATEGORY_LABELS[resource.category]}
        </Badge>
      </td>
      <td className="px-4 py-2.5">
        {resource.team ? (
          <span className="text-xs">
            <Folder className="mr-1 inline h-3 w-3" />
            {resource.team.name}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">Project-level</span>
        )}
      </td>
      <td className="text-muted-foreground px-4 py-2.5 text-xs">
        {formatBytes(resource.fileSize)}
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <Avatar className="h-5 w-5">
            {resource.uploadedBy.profilePhoto && (
              <AvatarImage src={resource.uploadedBy.profilePhoto} />
            )}
            <AvatarFallback className="text-[8px]">
              {getInitials(resource.uploadedBy.firstName, resource.uploadedBy.lastName)}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs">
            {resource.uploadedBy.firstName} {resource.uploadedBy.lastName}
          </span>
        </div>
      </td>
      <td className="text-muted-foreground px-4 py-2.5 text-xs">
        {formatDate(resource.createdAt)}
      </td>
      <td className="px-4 py-2.5 text-right">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleDownload}>
          <Download className="h-3.5 w-3.5" />
        </Button>
        {canDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive h-7 w-7"
            onClick={() => {
              if (confirm(`Delete "${resource.fileName}"?`)) del.mutate(resource.id)
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </td>
    </tr>
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
    <Dialog open={open} onOpenChange={(o) => !o && (onClose(), reset())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload File</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>File (max 100 MB)</Label>
            <input
              ref={fileInput}
              type="file"
              className="text-foreground file:bg-muted file:text-foreground hover:file:bg-muted/80 block w-full text-sm file:mr-3 file:rounded file:border-0 file:px-3 file:py-1.5 file:text-xs file:font-medium"
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
            <div className="space-y-1.5">
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
            <div className="space-y-1.5">
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
          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset()
              onClose()
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!file || upload.isPending || (file && file.size > 100 * 1024 * 1024)}
          >
            {upload.isPending ? "Uploading..." : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
