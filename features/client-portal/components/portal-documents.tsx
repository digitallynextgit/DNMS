"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { AlertTriangle, Download, Eye, FileText, FolderOpen, Trash2, Upload } from "lucide-react"

import { apiFetch } from "@/lib/api-fetch"
import { formatDate, formatFileSize } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { EmptyState } from "@/components/shared/empty-state"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"

// =============================================================================
// The client's view of a project's shared documents and assets.
// =============================================================================
// Everything here was deliberately shared by a staff member - the underlying
// table also holds internal briefs and working files, which the server filters
// out. This component never sees them.
//
// A library, and only that. Approving a file used to happen here too; that
// decision now lives on the content plan, attached to the thing that was
// actually commissioned rather than to a loose file.
// =============================================================================

interface PortalFile {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
  description: string | null
  category: string
  folderId: string | null
  createdAt: string
  sharedAt: string | null
  uploadedBy: { firstName: string; lastName: string } | null
  uploadedByClient: { id: string; name: string } | null
}

interface DocumentsPayload {
  files: PortalFile[]
  folders: { id: string; name: string }[]
  projectName: string
}

export function PortalDocuments({ projectRef }: { projectRef: string }) {
  const qc = useQueryClient()
  const base = `/api/portal/projects/${projectRef}/documents`

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["portal-documents", projectRef],
    queryFn: async () => (await apiFetch<{ data: { data: DocumentsPayload } }>(base)).data.data,
    staleTime: 30_000,
  })

  const [withdrawing, setWithdrawing] = React.useState<PortalFile | null>(null)
  const fileInput = React.useRef<HTMLInputElement>(null)

  const invalidate = () => qc.invalidateQueries({ queryKey: ["portal-documents", projectRef] })

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append("file", file)
      return apiFetch(base, { method: "POST", body: form })
    },
    onSuccess: () => {
      toast.success("Uploaded - the team has been notified")
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const withdraw = useMutation({
    mutationFn: (fileId: string) => apiFetch(`${base}/${fileId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("File withdrawn")
      setWithdrawing(null)
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  /** Open a file in a new tab, or save it. The URL is signed and short-lived. */
  async function open(file: PortalFile, download: boolean) {
    try {
      const res = await apiFetch<{ data: { data: { url: string } } }>(
        `${base}/${file.id}/file${download ? "?download=1" : ""}`,
      )
      window.open(res.data.data.url, "_blank", "noopener,noreferrer")
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const files = data?.files ?? []
  const folderName = (id: string | null) =>
    id ? (data?.folders.find((f) => f.id === id)?.name ?? "Files") : "Files"

  const sharedBy = (f: PortalFile) =>
    f.uploadedByClient
      ? "you"
      : f.uploadedBy
        ? `${f.uploadedBy.firstName} ${f.uploadedBy.lastName}`.trim()
        : "the team"

  const columns: DataTableColumn<PortalFile>[] = [
    {
      header: "File",
      cell: (f) => (
        <div className="flex min-w-0 items-start gap-2">
          <FileText className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <button
              onClick={() => open(f, false)}
              className="hover:text-primary max-w-[22rem] truncate text-left text-sm font-medium underline-offset-2 hover:underline"
              title={f.fileName}
            >
              {f.fileName}
            </button>
            {f.description && (
              <p className="text-muted-foreground max-w-[22rem] text-xs">{f.description}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      header: "Folder",
      cell: (f) => <span className="text-xs whitespace-nowrap">{folderName(f.folderId)}</span>,
    },
    {
      header: "Size",
      align: "right",
      cell: (f) => (
        <span className="text-xs whitespace-nowrap">{formatFileSize(f.fileSize)}</span>
      ),
    },
    {
      header: "Shared by",
      cell: (f) => <span className="text-xs whitespace-nowrap">{sharedBy(f)}</span>,
    },
    {
      header: "Date",
      cell: (f) => (
        <span className="text-xs whitespace-nowrap">{formatDate(f.sharedAt ?? f.createdAt)}</span>
      ),
    },
    {
      header: "",
      align: "right",
      cell: (f) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => open(f, false)}
            aria-label={`View ${f.fileName}`}
            title="View"
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => open(f, true)}
            aria-label={`Download ${f.fileName}`}
            title="Download"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
          {/* A file you uploaded is yours to withdraw. A staff-published
              document is not yours to remove. */}
          {f.uploadedByClient && (
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => setWithdrawing(f)}
              aria-label={`Withdraw ${f.fileName}`}
              title="Withdraw"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 rounded-sm" />
        <Skeleton className="h-64 rounded-sm" />
      </div>
    )
  }

  // A failed load must not look like an empty library.
  if (isError) {
    return (
      <div className="space-y-5">
        <h1 className="text-lg font-semibold">Documents &amp; assets</h1>
        <EmptyState
          icon={AlertTriangle}
          variant="card"
          title="Could not load the files"
          description={
            error instanceof Error && error.message
              ? error.message
              : "Something went wrong fetching them."
          }
          action={{ label: "Try again", onClick: () => void refetch() }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Documents &amp; assets</h1>
          <p className="text-muted-foreground text-sm">
            Shared process documents and campaign assets. Upload anything the team needs from you.
          </p>
        </div>
        <div>
          <input
            ref={fileInput}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) upload.mutate(file)
              e.target.value = ""
            }}
          />
          <Button
            className="gap-1.5"
            onClick={() => fileInput.current?.click()}
            disabled={upload.isPending}
          >
            <Upload className="h-4 w-4" />
            {upload.isPending ? "Uploading…" : "Upload a file"}
          </Button>
        </div>
      </div>

      {files.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          variant="card"
          title="Nothing shared yet"
          description="Documents and assets appear here as the team shares them. You can upload files for the team at any time."
        />
      ) : (
        <DataTable
          columns={columns}
          rows={files}
          rowKey={(f) => f.id}
          showSerial
          minWidth="min-w-[860px]"
          mobileCard={(f, i) => (
            <div className="space-y-2 p-3">
              <div className="flex items-start gap-2">
                <FileText className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <button
                    onClick={() => open(f, false)}
                    className="hover:text-primary block truncate text-left text-sm font-medium"
                  >
                    <span className="text-muted-foreground">{i + 1}. </span>
                    {f.fileName}
                  </button>
                  <p className="text-muted-foreground text-[11px]">
                    {formatFileSize(f.fileSize)} · {folderName(f.folderId)} · shared by{" "}
                    {sharedBy(f)} · {formatDate(f.sharedAt ?? f.createdAt)}
                  </p>
                </div>
              </div>
              {f.description && <p className="text-muted-foreground text-xs">{f.description}</p>}
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => open(f, false)} title="View">
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => open(f, true)} title="Download">
                  <Download className="h-3.5 w-3.5" />
                </Button>
                {f.uploadedByClient && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setWithdrawing(f)}
                    title="Withdraw"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          )}
        />
      )}

      <ConfirmDialog
        open={!!withdrawing}
        onOpenChange={(o) => !o && setWithdrawing(null)}
        title="Withdraw this file?"
        description={
          withdrawing
            ? `${withdrawing.fileName} is removed from the project. You can upload it again at any time.`
            : ""
        }
        confirmLabel="Withdraw"
        variant="destructive"
        isLoading={withdraw.isPending}
        onConfirm={() => withdrawing && withdraw.mutate(withdrawing.id)}
      />
    </div>
  )
}
