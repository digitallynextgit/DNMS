"use client"

/**
 * The three dashboard cards: announcements, gallery, birthdays.
 *
 * Each is self-contained and fetches its own slice, so one empty or failing
 * section cannot blank the dashboard around it - the reason these live here
 * rather than in one combined "noticeboard" payload.
 */

import * as React from "react"
import Link from "next/link"
import { useQuery, useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { Megaphone, Images, Cake, ArrowRight, PartyPopper } from "lucide-react"

import { apiFetch } from "@/lib/api-fetch"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AvatarDisplay } from "@/components/shared/avatar-display"

export interface Announcement {
  id: string
  title: string
  body: string
  category: string
  priority: "LOW" | "NORMAL" | "HIGH"
  isPublished: boolean
  publishedAt: string
  expiresAt: string | null
  createdBy: { id: string; firstName: string; lastName: string; profilePhoto: string | null } | null
}

export interface BirthdayPerson {
  id: string
  firstName: string
  lastName: string
  profilePhoto: string | null
  designation: string | null
  dayLabel: string
  inDays: number
}

export const PRIORITY_TONE: Record<Announcement["priority"], string> = {
  HIGH: "bg-destructive/10 text-destructive",
  NORMAL: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  LOW: "bg-muted text-muted-foreground",
}

/** Body text is plain; this trims it for a card without cutting mid-word. */
function excerpt(text: string, max = 120): string {
  const clean = text.replace(/\s+/g, " ").trim()
  if (clean.length <= max) return clean
  return clean.slice(0, clean.lastIndexOf(" ", max)).trimEnd() + "…"
}

// ─── Announcements ──────────────────────────────────────────────────────────

export function AnnouncementsCard({ limit = 4 }: { limit?: number }) {
  const { data, isPending } = useQuery({
    queryKey: ["announcements", "recent", limit],
    queryFn: async () =>
      (
        await apiFetch<{ data: { data: { items: Announcement[] } } }>(
          `/api/announcements?limit=${limit}`,
        )
      ).data.data,
  })
  const items = data?.items ?? []

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Megaphone className="h-4 w-4" />
          Recent Announcements
        </CardTitle>
        <Link
          href="/announcements"
          className="text-primary flex items-center gap-1 text-xs hover:underline"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 rounded-md" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-xs">
            Nothing posted yet. Announcements from HR will appear here.
          </p>
        ) : (
          <ul className="divide-y">
            {items.map((a) => (
              <li key={a.id} className="py-2.5 first:pt-0 last:pb-0">
                <Link href="/announcements" className="group block">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium group-hover:underline">{a.title}</p>
                    {a.priority === "HIGH" && (
                      <Badge className={cn("text-[10px]", PRIORITY_TONE.HIGH)}>Important</Badge>
                    )}
                    <Badge variant="outline" className="text-[10px]">
                      {a.category}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-xs">{excerpt(a.body)}</p>
                  <p className="text-muted-foreground mt-1 text-[11px]" suppressHydrationWarning>
                    {new Date(a.publishedAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                    {a.createdBy && ` · ${a.createdBy.firstName} ${a.createdBy.lastName}`}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Photo gallery ──────────────────────────────────────────────────────────

interface AlbumSummary {
  id: string
  slug: string
  title: string
  eventDate: string | null
  photoCount: number
  coverPhotoId: string | null
}

export function PhotoGalleryCard({ limit = 8 }: { limit?: number }) {
  const { data, isPending } = useQuery({
    queryKey: ["gallery", "albums"],
    queryFn: async () =>
      (await apiFetch<{ data: { data: { albums: AlbumSummary[] } } }>("/api/gallery/albums")).data
        .data,
  })

  // Cover tiles from the most recent albums - the dashboard shows a taste of the
  // gallery, not the gallery itself.
  const tiles = (data?.albums ?? []).filter((a) => a.coverPhotoId).slice(0, limit)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Images className="h-4 w-4" />
          Photo Gallery
        </CardTitle>
        <Link
          href="/gallery"
          className="text-primary flex items-center gap-1 text-xs hover:underline"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="aspect-square rounded-md" />
            ))}
          </div>
        ) : tiles.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-xs">
            No photos yet. Team event pictures will show up here.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {tiles.map((a) => (
              <Link
                key={a.id}
                href={`/gallery/${a.slug}`}
                className="group relative aspect-square overflow-hidden rounded-md border"
                title={`${a.title} · ${a.photoCount} photo${a.photoCount === 1 ? "" : "s"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/gallery/photos/${a.coverPhotoId}/file`}
                  alt={a.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-1 text-[10px] text-white">
                  {a.title}
                </span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Birthdays ──────────────────────────────────────────────────────────────

export function BirthdaysCard({ days = 30 }: { days?: number }) {
  const { data, isPending, refetch } = useQuery({
    queryKey: ["birthdays", days],
    queryFn: async () =>
      (await apiFetch<{ data: { data: BirthdayPerson[] } }>(`/api/birthdays?days=${days}`)).data
        .data,
  })
  const [wished, setWished] = React.useState<Set<string>>(new Set())

  const wish = useMutation({
    mutationFn: (p: BirthdayPerson) =>
      apiFetch("/api/birthdays/wish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: p.id }),
      }),
    onSuccess: (_d, p) => {
      toast.success(`Wishes sent to ${p.firstName} 🎉`)
      setWished((prev) => new Set(prev).add(p.id))
      refetch()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const people = data ?? []
  const today = people.filter((p) => p.inDays === 0)
  const upcoming = people.filter((p) => p.inDays > 0).slice(0, 5)

  return (
    <Card>
      <CardHeader className="space-y-0">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Cake className="h-4 w-4" />
          Employee Birthdays
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isPending ? (
          <Skeleton className="h-32 rounded-md" />
        ) : people.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-xs">
            No birthdays in the next {days} days.
          </p>
        ) : (
          <>
            {/* Today gets the hero treatment; everyone else is a list row. */}
            {today.map((p) => (
              <div
                key={p.id}
                className="rounded-md bg-gradient-to-br from-teal-600 to-emerald-500 p-4 text-white"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">Happy Birthday!</p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 gap-1.5 text-[11px]"
                    disabled={wish.isPending || wished.has(p.id)}
                    onClick={() => wish.mutate(p)}
                  >
                    <PartyPopper className="h-3.5 w-3.5" />
                    {wished.has(p.id) ? "Wishes sent" : "Send wishes"}
                  </Button>
                </div>
                <div className="mt-3 flex flex-col items-center text-center">
                  <AvatarDisplay
                    src={p.profilePhoto}
                    firstName={p.firstName}
                    lastName={p.lastName}
                    size="xl"
                    className="ring-2 ring-white/70"
                  />
                  <p className="mt-2 text-lg font-semibold">
                    {p.firstName} {p.lastName}
                  </p>
                  {p.designation && <p className="text-xs opacity-90">{p.designation}</p>}
                  <p className="text-xs opacity-90">{p.dayLabel}</p>
                </div>
              </div>
            ))}

            {upcoming.length > 0 && (
              <div className="space-y-1.5">
                {today.length > 0 && (
                  <p className="text-muted-foreground text-[11px] font-medium">Coming up</p>
                )}
                {upcoming.map((p) => (
                  <div key={p.id} className="flex items-center gap-2.5">
                    <AvatarDisplay
                      src={p.profilePhoto}
                      firstName={p.firstName}
                      lastName={p.lastName}
                      size="chip"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">
                        {p.firstName} {p.lastName}
                      </p>
                      {p.designation && (
                        <p className="text-muted-foreground truncate text-[11px]">
                          {p.designation}
                        </p>
                      )}
                    </div>
                    <span className="text-muted-foreground shrink-0 text-[11px]">
                      {p.inDays === 1 ? "Tomorrow" : p.dayLabel}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
