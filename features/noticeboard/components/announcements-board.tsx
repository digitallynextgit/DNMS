"use client"

/**
 * The announcements board.
 *
 * Reading is open to everyone; the compose/edit controls only render for
 * `announcement:write` holders - and the API enforces the same, so hiding the
 * button is convenience, not security.
 */

import * as React from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { Megaphone, Plus, Pencil, Trash2, Clock, AlertTriangle, Shapes } from "lucide-react"

import { apiFetch } from "@/lib/api-fetch"
import { cn } from "@/lib/utils"
import { usePermissions } from "@/features/admin/hooks/use-permissions"
import { PERMISSIONS } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { StatStrip } from "@/components/shared/stat-strip"
import { FilterToolbar, FilterSelect } from "@/components/shared/filter-bar"
import { EmptyState } from "@/components/shared/empty-state"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DateField } from "@/components/shared/date-field"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { SUGGESTED_CATEGORIES } from "../schemas/noticeboard.schema"
import { PRIORITY_TONE, type Announcement } from "./noticeboard-widgets"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

interface BoardData {
  items: Announcement[]
  categories: string[]
  stats: { total: number; newThisWeek: number; highPriority: number; categoriesActive: number }
}

export function AnnouncementsBoard() {
  const { can } = usePermissions()
  const canManage = can(PERMISSIONS.ANNOUNCEMENT_WRITE)

  const [month, setMonth] = React.useState<number | null>(null)
  const [category, setCategory] = React.useState<string | null>(null)
  const [composing, setComposing] = React.useState<Announcement | "new" | null>(null)
  const [removing, setRemoving] = React.useState<Announcement | null>(null)

  const year = new Date().getFullYear()
  const qs = new URLSearchParams()
  if (month) {
    qs.set("month", String(month))
    qs.set("year", String(year))
  }
  if (category) qs.set("category", category)

  const { data, isPending, refetch } = useQuery({
    queryKey: ["announcements", "board", month, category],
    queryFn: async () =>
      (await apiFetch<{ data: { data: BoardData } }>(`/api/announcements?${qs}`)).data.data,
  })

  const remove = useMutation({
    mutationFn: (a: Announcement) => apiFetch(`/api/announcements/${a.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Announcement deleted")
      setRemoving(null)
      refetch()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const items = data?.items ?? []
  const stats = data?.stats

  const hasFilters = month !== null || category !== null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements"
        description="Company-wide notices and updates"
        actions={
          canManage ? (
            <Button size="sm" className="gap-1.5" onClick={() => setComposing("new")}>
              <Plus className="h-4 w-4" />
              New announcement
            </Button>
          ) : undefined
        }
      />

      <StatStrip
        loading={isPending}
        items={[
          { label: "Total", value: stats?.total ?? 0, icon: Megaphone },
          { label: "New this week", value: stats?.newThisWeek ?? 0, icon: Clock },
          {
            label: "Important",
            value: stats?.highPriority ?? 0,
            icon: AlertTriangle,
            tone: (stats?.highPriority ?? 0) > 0 ? "warning" : "default",
          },
          { label: "Categories", value: stats?.categoriesActive ?? 0, icon: Shapes },
        ]}
      />

      {/* Month and category are SELECTS in the shared toolbar, not a chip strip
          plus a sidebar: every other list page in DNMS filters this way, and two
          filters do not earn 240px of permanent screen width. */}
      <FilterToolbar
        hasActiveFilters={hasFilters}
        onClear={() => {
          setMonth(null)
          setCategory(null)
        }}
      >
        <FilterSelect
          value={month ? String(month) : ""}
          onChange={(v) => setMonth(v ? Number(v) : null)}
          allLabel="All months"
          options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
        />
        <FilterSelect
          value={category ?? ""}
          onChange={(v) => setCategory(v || null)}
          allLabel="All categories"
          options={(data?.categories ?? []).map((c) => ({ value: c, label: c }))}
        />
      </FilterToolbar>

      <div className="space-y-3">
        {isPending && <Skeleton className="h-40 rounded-sm" />}

        {!isPending && items.length === 0 && (
          <EmptyState
            icon={Megaphone}
            title="Nothing on the board"
            description={
              month || category
                ? "No announcements match this filter."
                : "When HR posts an announcement it will appear here."
            }
            variant="card"
          />
        )}

        {items.map((a) => (
          <article key={a.id} className="bg-card rounded-sm border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-medium">{a.title}</h3>
                  <Badge className={cn("text-[10px]", PRIORITY_TONE[a.priority])}>
                    {a.priority === "HIGH" ? "Important" : a.priority === "LOW" ? "FYI" : "Notice"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {a.category}
                  </Badge>
                  {/* Only managers ever see these two states. */}
                  {!a.isPublished && (
                    <Badge variant="secondary" className="text-[10px]">
                      Draft
                    </Badge>
                  )}
                  {a.expiresAt && new Date(a.expiresAt) < new Date() && (
                    <Badge variant="secondary" className="text-[10px]">
                      Expired
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground mt-1 text-[11px]" suppressHydrationWarning>
                  {new Date(a.publishedAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                  {a.createdBy && ` · ${a.createdBy.firstName} ${a.createdBy.lastName}`}
                </p>
              </div>
              {canManage && (
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit ${a.title}`}
                    onClick={() => setComposing(a)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${a.title}`}
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setRemoving(a)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
            {/* whitespace-pre-wrap: line breaks typed by HR are meaningful. */}
            <p className="mt-2 text-sm whitespace-pre-wrap">{a.body}</p>
          </article>
        ))}
      </div>

      {composing && (
        <ComposeDialog
          announcement={composing === "new" ? null : composing}
          categories={data?.categories ?? []}
          onClose={() => setComposing(null)}
          onDone={() => {
            setComposing(null)
            refetch()
          }}
        />
      )}

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Delete this announcement?"
        description={removing ? `"${removing.title}" is removed for everyone.` : ""}
        confirmLabel="Delete"
        variant="destructive"
        isLoading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing)}
      />
    </div>
  )
}

function ComposeDialog({
  announcement,
  categories,
  onClose,
  onDone,
}: {
  announcement: Announcement | null
  categories: string[]
  onClose: () => void
  onDone: () => void
}) {
  const editing = !!announcement
  const [title, setTitle] = React.useState(announcement?.title ?? "")
  const [body, setBody] = React.useState(announcement?.body ?? "")
  const [category, setCategory] = React.useState(announcement?.category ?? "Information")
  const [priority, setPriority] = React.useState(announcement?.priority ?? "NORMAL")
  const [isPublished, setIsPublished] = React.useState(announcement?.isPublished ?? true)
  const [expiresAt, setExpiresAt] = React.useState(
    announcement?.expiresAt ? announcement.expiresAt.slice(0, 10) : "",
  )

  const options = [...new Set([...SUGGESTED_CATEGORIES, ...categories])]

  const save = useMutation({
    mutationFn: () =>
      apiFetch(editing ? `/api/announcements/${announcement.id}` : "/api/announcements", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, category, priority, isPublished, expiresAt }),
      }),
    onSuccess: () => {
      toast.success(editing ? "Announcement updated" : "Announcement posted")
      onDone()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl lg:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {editing ? "Edit announcement" : "New announcement"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Everyone signed in to DNMS can read this.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">
              Title<span className="text-destructive"> *</span>
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Office closed on 15 August"
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">
              Message<span className="text-destructive"> *</span>
            </Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              placeholder="Write the announcement…"
              className="text-sm"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map((c) => (
                    <SelectItem key={c} value={c} className="text-xs">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as Announcement["priority"])}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW" className="text-xs">
                    FYI
                  </SelectItem>
                  <SelectItem value="NORMAL" className="text-xs">
                    Notice
                  </SelectItem>
                  <SelectItem value="HIGH" className="text-xs">
                    Important
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Remove after</Label>
              <DateField value={expiresAt} onChange={setExpiresAt} placeholder="Never" modal />
            </div>
          </div>

          <label className="flex items-center gap-2">
            <Switch checked={isPublished} onCheckedChange={setIsPublished} />
            <span className="text-muted-foreground text-xs">
              {isPublished ? "Visible to everyone" : "Saved as a draft - only you can see it"}
            </span>
          </label>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" className="h-9 text-xs" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="h-9 text-xs"
            disabled={title.trim().length < 3 || body.trim().length < 3 || save.isPending}
            onClick={() => save.mutate()}
          >
            {editing ? "Save changes" : isPublished ? "Post" : "Save draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
