"use client"

/**
 * Photo gallery: album grid, and one album's photos.
 *
 * Images are served through /api/gallery/photos/:id/file, which redirects to a
 * signed B2 URL - the bucket stays private, so a photo of the team is not a
 * public URL away from anyone who guesses a filename.
 */

import * as React from "react"
import Link from "next/link"
import { useQuery, useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { Images, Plus, Upload, Trash2, Loader2, FolderOpen, Calendar, X } from "lucide-react"

import { apiFetch } from "@/lib/api-fetch"
import { usePermissions } from "@/features/admin"
import { PERMISSIONS } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { StatStrip } from "@/components/shared/stat-strip"
import { SearchInput } from "@/components/shared/search-input"
import { FilterToolbar } from "@/components/shared/filter-bar"
import { EmptyState } from "@/components/shared/empty-state"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DateField } from "@/components/shared/date-field"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface AlbumSummary {
  id: string
  slug: string
  title: string
  description: string | null
  eventDate: string | null
  photoCount: number
  coverPhotoId: string | null
  createdBy: { firstName: string; lastName: string } | null
}

interface PhotoRow {
  id: string
  caption: string | null
  fileName: string
  width: number | null
  height: number | null
}

const photoUrl = (id: string) => `/api/gallery/photos/${id}/file`

// ─── Album grid ─────────────────────────────────────────────────────────────

export function GalleryView() {
  const { can } = usePermissions()
  const canManage = can(PERMISSIONS.GALLERY_WRITE)

  const [search, setSearch] = React.useState("")
  const [creating, setCreating] = React.useState(false)
  const [removing, setRemoving] = React.useState<AlbumSummary | null>(null)

  const { data, isPending, refetch } = useQuery({
    queryKey: ["gallery", "albums", search],
    queryFn: async () =>
      (
        await apiFetch<{
          data: {
            data: {
              albums: AlbumSummary[]
              stats: { totalAlbums: number; totalPhotos: number; recentUploads: number }
            }
          }
        }>(`/api/gallery/albums${search ? `?search=${encodeURIComponent(search)}` : ""}`)
      ).data.data,
  })

  const remove = useMutation({
    mutationFn: (a: AlbumSummary) => apiFetch(`/api/gallery/albums/${a.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Album deleted")
      setRemoving(null)
      refetch()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const albums = data?.albums ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Photo Gallery"
        description="Team events, celebrations and moments"
        actions={
          canManage ? (
            <Button size="sm" className="gap-1.5" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              New album
            </Button>
          ) : undefined
        }
      />

      <StatStrip
        loading={isPending}
        items={[
          { label: "Albums", value: data?.stats.totalAlbums ?? 0, icon: FolderOpen },
          { label: "Photos", value: data?.stats.totalPhotos ?? 0, icon: Images },
          { label: "Added this week", value: data?.stats.recentUploads ?? 0, icon: Upload },
        ]}
      />

      <FilterToolbar hasActiveFilters={!!search} onClear={() => setSearch("")}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search albums" />
      </FilterToolbar>

      {isPending && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-52 rounded-sm" />
          ))}
        </div>
      )}

      {!isPending && albums.length === 0 && (
        <EmptyState
          icon={Images}
          title={search ? "No albums match" : "No albums yet"}
          description={
            search ? "Try a different search." : "Create one and upload the team's event photos."
          }
          variant="card"
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {albums.map((a) => (
          <div key={a.id} className="bg-card group overflow-hidden rounded-sm border">
            <Link href={`/gallery/${a.slug}`} className="block">
              <div className="bg-muted relative aspect-[4/3] overflow-hidden">
                {a.coverPhotoId ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoUrl(a.coverPhotoId)}
                    alt={a.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="text-muted-foreground flex h-full items-center justify-center">
                    <Images className="h-8 w-8" />
                  </div>
                )}
              </div>
            </Link>
            <div className="space-y-1 p-3">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/gallery/${a.slug}`} className="min-w-0">
                  <p className="truncate text-sm font-medium hover:underline">{a.title}</p>
                </Link>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${a.title}`}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => setRemoving(a)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-[11px]">
                {a.eventDate && (
                  <span className="inline-flex items-center gap-1" suppressHydrationWarning>
                    <Calendar className="h-3 w-3" />
                    {new Date(a.eventDate).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                )}
                <span>
                  {a.photoCount} photo{a.photoCount === 1 ? "" : "s"}
                </span>
              </p>
            </div>
          </div>
        ))}
      </div>

      {creating && (
        <AlbumDialog
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false)
            refetch()
          }}
        />
      )}

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Delete this album?"
        description={
          removing
            ? `"${removing.title}" and its ${removing.photoCount} photo(s) are permanently deleted, including the stored files.`
            : ""
        }
        confirmLabel="Delete album"
        variant="destructive"
        isLoading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing)}
      />
    </div>
  )
}

function AlbumDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [eventDate, setEventDate] = React.useState("")

  const save = useMutation({
    mutationFn: () =>
      apiFetch("/api/gallery/albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, eventDate }),
      }),
    onSuccess: () => {
      toast.success("Album created - open it to add photos")
      onDone()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md lg:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">New album</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">
              Name<span className="text-destructive"> *</span>
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Diwali 2026"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Event date</Label>
            <DateField value={eventDate} onChange={setEventDate} modal />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="text-sm"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" className="h-9 text-xs" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="h-9 text-xs"
            disabled={title.trim().length < 2 || save.isPending}
            onClick={() => save.mutate()}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── One album ──────────────────────────────────────────────────────────────

export function AlbumView({ albumRef }: { albumRef: string }) {
  const { can } = usePermissions()
  const canManage = can(PERMISSIONS.GALLERY_WRITE)
  const fileRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)
  const [lightbox, setLightbox] = React.useState<PhotoRow | null>(null)
  const [removing, setRemoving] = React.useState<PhotoRow | null>(null)

  const { data, isPending, refetch } = useQuery({
    queryKey: ["gallery", "album", albumRef],
    queryFn: async () =>
      (
        await apiFetch<{
          data: {
            data: {
              id: string
              title: string
              description: string | null
              eventDate: string | null
              photos: PhotoRow[]
            }
          }
        }>(`/api/gallery/albums/${albumRef}`)
      ).data.data,
  })

  const remove = useMutation({
    mutationFn: (p: PhotoRow) => apiFetch(`/api/gallery/photos/${p.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Photo deleted")
      setRemoving(null)
      refetch()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  /** All files go up in ONE request - see the route: 30 photos, 30 chances to fail. */
  async function upload(files: FileList) {
    setUploading(true)
    try {
      const form = new FormData()
      for (const f of Array.from(files)) form.append("files", f)
      const res = await fetch(`/api/gallery/albums/${albumRef}/photos`, {
        method: "POST",
        body: form,
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error ?? "Upload failed")

      const { uploaded, skipped } = json.data as {
        uploaded: number
        skipped: { fileName: string; reason: string }[]
      }
      toast.success(`${uploaded} photo${uploaded === 1 ? "" : "s"} added`)
      // Anything rejected is named, not silently dropped.
      for (const s of skipped) toast.error(`${s.fileName}: ${s.reason}`)
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const photos = data?.photos ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/gallery"
        backLabel="Back to gallery"
        title={data?.title ?? "Album"}
        description={data?.description ?? `${photos.length} photo${photos.length === 1 ? "" : "s"}`}
        actions={
          canManage ? (
            <Button
              size="sm"
              className="gap-1.5"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Add photos
            </Button>
          ) : undefined
        }
      />

      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        aria-hidden
        onChange={(e) => e.target.files?.length && upload(e.target.files)}
      />

      {isPending && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="aspect-square rounded-sm" />
          ))}
        </div>
      )}

      {!isPending && photos.length === 0 && (
        <EmptyState
          icon={Images}
          title="No photos yet"
          description={canManage ? "Use Add photos to upload." : "Nothing has been added yet."}
          variant="card"
        />
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
        {photos.map((p) => (
          <div
            key={p.id}
            className="group relative aspect-square overflow-hidden rounded-sm border"
          >
            <button type="button" onClick={() => setLightbox(p)} className="h-full w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl(p.id)}
                alt={p.caption ?? p.fileName}
                loading="lazy"
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
            </button>
            {canManage && (
              <Button
                variant="destructive"
                size="icon-sm"
                aria-label={`Delete ${p.fileName}`}
                className="absolute top-1.5 right-1.5 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => setRemoving(p)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox. Plain fixed overlay rather than a Dialog so the image can use
          the full viewport without fighting the dialog's max-width. */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightbox(null)}
          role="presentation"
        >
          <Button
            variant="secondary"
            size="icon-sm"
            aria-label="Close"
            className="absolute top-4 right-4"
            onClick={() => setLightbox(null)}
          >
            <X className="h-4 w-4" />
          </Button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl(lightbox.id)}
            alt={lightbox.caption ?? lightbox.fileName}
            className="max-h-full max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Delete this photo?"
        description="The file is removed from storage as well. This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        isLoading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing)}
      />
    </div>
  )
}
