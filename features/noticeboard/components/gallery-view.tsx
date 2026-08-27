"use client"

/**
 * Photo gallery: album grid, and one album's photos and videos.
 *
 * Files are served through /api/gallery/photos/:id/file, which redirects to a
 * signed B2 URL - the bucket stays private, so a photo of the team is not a
 * public URL away from anyone who guesses a filename. `?download=1` signs the
 * same object with Content-Disposition: attachment so it saves rather than opens.
 *
 * Uploading and downloading are open to EVERY employee; only deletion is
 * restricted (your own uploads always, anyone else's with gallery:write).
 */

import * as React from "react"
import { Link } from "@/components/tenant-link"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import {
  Images,
  Plus,
  Upload,
  Download,
  Trash2,
  Loader2,
  FolderOpen,
  Calendar,
  Play,
  Video,
  ArrowUpDown,
  X,
} from "lucide-react"

import { apiFetch } from "@/lib/api-fetch"
import { usePermissions } from "@/features/admin/hooks/use-permissions"
import { PERMISSIONS } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { StatStrip } from "@/components/shared/stat-strip"
import { SearchInput } from "@/components/shared/search-input"
import { FilterToolbar, FilterSelect } from "@/components/shared/filter-bar"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface AlbumSummary {
  id: string
  slug: string
  title: string
  description: string | null
  eventDate: string | null
  createdAt: string
  /** Images only - videos are counted separately. */
  photoCount: number
  videoCount: number
  coverPhotoId: string | null
  coverIsVideo: boolean
  createdBy: { firstName: string; lastName: string } | null
}

type SortKey = "recent" | "oldest" | "name" | "largest"

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recent", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name", label: "Name (A-Z)" },
  { value: "largest", label: "Most files" },
]

/** "12 photos · 3 videos", dropping whichever side is zero. */
function countLabel(a: { photoCount: number; videoCount: number }): string {
  const parts: string[] = []
  if (a.photoCount) parts.push(`${a.photoCount} photo${a.photoCount === 1 ? "" : "s"}`)
  if (a.videoCount) parts.push(`${a.videoCount} video${a.videoCount === 1 ? "" : "s"}`)
  return parts.join(" · ") || "Empty"
}

/** An album's date for sorting: the event it records, else when it was made. */
const albumTime = (a: AlbumSummary) => new Date(a.eventDate ?? a.createdAt).getTime()

interface PhotoRow {
  id: string
  caption: string | null
  fileName: string
  contentType: string
  width: number | null
  height: number | null
  uploadedBy: { id: string; firstName: string; lastName: string } | null
}

const photoUrl = (id: string) => `/api/gallery/photos/${id}/file`
/** Small WebP variant for grid cells and covers - a fraction of the master's
 *  bytes. Falls back to the master server-side when a row has no thumb yet. The
 *  lightbox keeps photoUrl() so it opens the full-resolution image. */
const thumbUrl = (id: string) => `/api/gallery/photos/${id}/file?variant=thumb`
/** Same object, signed with Content-Disposition: attachment - see the file route. */
const downloadUrl = (id: string) => `/api/gallery/photos/${id}/file?download=1`
const isVideo = (contentType: string) => contentType.startsWith("video/")

const ACCEPT_TYPES =
  "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"

// ─── Album grid ─────────────────────────────────────────────────────────────

export function GalleryView() {
  const { can } = usePermissions()
  const canManage = can(PERMISSIONS.GALLERY_WRITE)

  const [search, setSearch] = React.useState("")
  // "" = every album; "video" = only those with a video; "photo" = only those
  // with a photo. Applied client-side: the list is capped at 200 albums, so
  // filtering and sorting here is instant and costs no round trip.
  const [media, setMedia] = React.useState("")
  const [sort, setSort] = React.useState<SortKey>("recent")
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
              stats: {
                totalAlbums: number
                totalPhotos: number
                totalVideos: number
                recentUploads: number
              }
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

  const albums = React.useMemo(() => {
    const list = (data?.albums ?? []).filter((a) => {
      if (media === "video") return a.videoCount > 0
      if (media === "photo") return a.photoCount > 0
      return true
    })
    // Sorted copy - filter() already returned a new array, but sort() mutating
    // the query cache's array would be a real bug if that ever changed.
    return [...list].sort((a, b) => {
      switch (sort) {
        case "oldest":
          return albumTime(a) - albumTime(b)
        case "name":
          return a.title.localeCompare(b.title)
        case "largest":
          return b.photoCount + b.videoCount - (a.photoCount + a.videoCount)
        default:
          return albumTime(b) - albumTime(a)
      }
    })
  }, [data?.albums, media, sort])

  const filtersActive = !!search || !!media || sort !== "recent"

  return (
    <div className="space-y-6">
      <PageHeader
        title="Photo Gallery"
        description="Team events, celebrations and moments"
        actions={
          // Anyone can start an album - uploads are open to everyone, and an
          // upload needs somewhere to go.
          <Button size="sm" className="gap-1.5" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            New album
          </Button>
        }
      />

      <StatStrip
        loading={isPending}
        items={[
          { label: "Albums", value: data?.stats.totalAlbums ?? 0, icon: FolderOpen },
          { label: "Photos", value: data?.stats.totalPhotos ?? 0, icon: Images },
          { label: "Videos", value: data?.stats.totalVideos ?? 0, icon: Video },
          { label: "Added this week", value: data?.stats.recentUploads ?? 0, icon: Upload },
        ]}
      />

      <FilterToolbar
        hasActiveFilters={filtersActive}
        onClear={() => {
          setSearch("")
          setMedia("")
          setSort("recent")
        }}
      >
        <SearchInput value={search} onChange={setSearch} placeholder="Search albums" />

        {/* Filters sit at the far right of the search row; `ml-auto` on the
            first of them pushes the pair over without a wrapper that would
            break FilterToolbar's flex-wrap on narrow screens. */}
        <FilterSelect
          value={media}
          onChange={setMedia}
          allLabel="All media"
          className="ml-auto w-36"
          options={[
            { value: "photo", label: "With photos" },
            { value: "video", label: "With videos" },
          ]}
        />
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="w-40">
            <ArrowUpDown className="text-muted-foreground mr-1 h-3.5 w-3.5 shrink-0" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
          title={filtersActive ? "No albums match" : "No albums yet"}
          description={
            filtersActive
              ? "Try a different search or filter."
              : "Create one and upload the team's event photos."
          }
          variant="card"
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {albums.map((a) => (
          <div key={a.id} className="bg-card group overflow-hidden rounded-sm border">
            <Link href={`/gallery/${a.slug}`} className="block">
              <div className="bg-muted relative aspect-[4/3] overflow-hidden">
                {!a.coverPhotoId ? (
                  <div className="text-muted-foreground flex h-full items-center justify-center">
                    <Images className="h-8 w-8" />
                  </div>
                ) : a.coverIsVideo ? (
                  // preload="metadata" is enough for the browser to paint the
                  // first frame as a poster - no separate thumbnail to generate.
                  <video
                    src={photoUrl(a.coverPhotoId)}
                    muted
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumbUrl(a.coverPhotoId)}
                    alt={a.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
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
                <span>{countLabel(a)}</span>
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
            ? `"${removing.title}" and its ${removing.photoCount + removing.videoCount} file(s) are permanently deleted, including the stored files.`
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
              aria-label="Diwali 2026"
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
  const { data: session } = useSession()
  const myId = session?.user?.id
  // Mirrors deletePhoto() on the server: your own upload always, anyone else's
  // only with gallery:write.
  const canDelete = (p: PhotoRow) => canManage || (!!myId && p.uploadedBy?.id === myId)
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
      toast.success(`${uploaded} file${uploaded === 1 ? "" : "s"} added`)
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
        description={data?.description ?? `${photos.length} file${photos.length === 1 ? "" : "s"}`}
        actions={
          // Open to every employee: the people at the event are the ones holding
          // the photos.
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
            Add photos or videos
          </Button>
        }
      />

      <input
        ref={fileRef}
        type="file"
        multiple
        accept={ACCEPT_TYPES}
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
          title="Nothing here yet"
          description="Use Add photos or videos to upload."
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
              {isVideo(p.contentType) ? (
                <video
                  src={photoUrl(p.id)}
                  muted
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbUrl(p.id)}
                  alt={p.caption ?? p.fileName}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              )}
            </button>

            {/* A still frame is indistinguishable from a photo without this. */}
            {isVideo(p.contentType) && (
              <span className="pointer-events-none absolute bottom-1.5 left-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white">
                <Play className="h-3 w-3 fill-current" />
              </span>
            )}

            <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
              <Button asChild variant="secondary" size="icon-sm" title="Download">
                <a href={downloadUrl(p.id)} download={p.fileName}>
                  <Download className="h-3.5 w-3.5" />
                  <span className="sr-only">Download {p.fileName}</span>
                </a>
              </Button>
              {canDelete(p) && (
                <Button
                  variant="destructive"
                  size="icon-sm"
                  aria-label={`Delete ${p.fileName}`}
                  onClick={() => setRemoving(p)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
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
          <div className="absolute top-4 right-4 flex gap-2">
            <Button asChild variant="secondary" size="icon-sm" title="Download">
              <a
                href={downloadUrl(lightbox.id)}
                download={lightbox.fileName}
                onClick={(e) => e.stopPropagation()}
              >
                <Download className="h-4 w-4" />
                <span className="sr-only">Download {lightbox.fileName}</span>
              </a>
            </Button>
            <Button
              variant="secondary"
              size="icon-sm"
              aria-label="Close"
              onClick={() => setLightbox(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {isVideo(lightbox.contentType) ? (
            // autoPlay is deliberate: you clicked a video thumbnail. Controls
            // stay on so it can be paused, scrubbed or made full-screen.
            <video
              src={photoUrl(lightbox.id)}
              controls
              autoPlay
              playsInline
              className="max-h-full max-w-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl(lightbox.id)}
              alt={lightbox.caption ?? lightbox.fileName}
              className="max-h-full max-w-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={
          removing && isVideo(removing.contentType) ? "Delete this video?" : "Delete this photo?"
        }
        description="The file is removed from storage as well. This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        isLoading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing)}
      />
    </div>
  )
}
