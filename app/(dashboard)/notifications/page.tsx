"use client"

import { useState } from "react"
import { useUrlPage } from "@/hooks/use-url-state"
import { useRouter } from "next/navigation"
import { CheckCircle, Info, AlertCircle, CheckCheck, Trash2 } from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Pagination } from "@/components/shared/pagination"
import { cn, formatRelativeTime, truncate } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Notification {
  id: string
  title: string
  message: string
  type: string
  link: string | null
  isRead: boolean
  readAt: string | null
  createdAt: string
}

interface NotificationsResponse {
  data: Notification[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNotificationIcon(type: string) {
  switch (type) {
    case "success":
      return <CheckCircle className="h-5 w-5 text-green-500" />
    case "warning":
      return <AlertCircle className="h-5 w-5 text-amber-500" />
    case "error":
      return <AlertCircle className="h-5 w-5 text-red-500" />
    default:
      return <Info className="h-5 w-5 text-blue-500" />
  }
}

/**
 * Placeholder row built from the real notification row's layout (bordered card,
 * `p-4`, 9x9 icon circle, title + timestamp on one line, message below) rather
 * than a flat grey bar, so nothing reflows when the feed arrives.
 */
function NotificationRowSkeleton() {
  return (
    <div className="bg-card flex w-full items-start gap-3 rounded border p-4">
      <Skeleton className="mt-0.5 h-9 w-9 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-16 shrink-0" />
        </div>
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const LIMIT = 10

export default function NotificationsPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const [page, setPage] = useUrlPage()
  const [confirmClear, setConfirmClear] = useState(false)

  const { data, isLoading } = useQuery<NotificationsResponse>({
    queryKey: ["notifications", page],
    queryFn: async () => {
      const res = await fetch(`/api/notifications/inbox?page=${page}&limit=${LIMIT}`)
      if (!res.ok) throw new Error("Failed to load notifications")
      return res.json()
    },
    // Keep the feed live without a manual reload.
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  })

  const markReadMutation = useMutation({
    mutationFn: async (payload: { ids?: string[]; all?: boolean }) => {
      const res = await fetch("/api/notifications/inbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("Failed to update notifications")
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] })
    },
    onError: () => {
      toast.error("Failed to mark notifications as read")
    },
  })

  // Permanent - notifications are a personal feed, so there's nothing to soft
  // delete or recover. Scoped server-side to the caller's own rows.
  const deleteMutation = useMutation({
    mutationFn: async (params: { id?: string; all?: boolean }) => {
      const qs = params.all ? "all=true" : `id=${encodeURIComponent(params.id ?? "")}`
      const res = await fetch(`/api/notifications/inbox?${qs}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
    onError: () => toast.error("Couldn't delete the notification"),
  })

  const handleMarkAllRead = () => {
    markReadMutation.mutate({ all: true })
  }

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markReadMutation.mutate({ ids: [notification.id] })
    }
    if (notification.link) {
      router.push(notification.link)
    }
  }

  const notifications = data?.data ?? []
  const meta = data?.meta
  const hasUnread = notifications.some((n) => !n.isRead)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Notifications"
        description="Your activity feed and system notifications."
        actions={
          <>
            {hasUnread && (
              <Button
                variant="outline"
                onClick={handleMarkAllRead}
                disabled={markReadMutation.isPending}
              >
                <CheckCheck className="mr-2 h-4 w-4" />
                Mark all as read
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="outline"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmClear(true)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear all
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-col gap-2">
        {isLoading ? (
          Array.from({ length: LIMIT }).map((_, i) => <NotificationRowSkeleton key={i} />)
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={CheckCircle}
            title="You're all caught up!"
            description="No new notifications at the moment. Check back later."
          />
        ) : (
          notifications.map((notification) => (
            // A <div> row, not a <button>: the delete control lives inside it, and
            // a button nested in a button is invalid HTML (the inner click never
            // fires reliably). The body below is the clickable target instead.
            <div
              key={notification.id}
              className={cn(
                "group bg-card hover:bg-muted/50 flex w-full items-start gap-3 rounded border p-4 transition-colors",
                // Unread: a translucent tint + left accent that stays readable in
                // BOTH light and dark themes (a solid bg-blue-50 turned the text
                // unreadable in dark mode).
                !notification.isRead &&
                  "border-l-4 border-l-blue-500 bg-blue-500/10 hover:bg-blue-500/15",
              )}
            >
              <div className="bg-muted mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                {getNotificationIcon(notification.type)}
              </div>

              <button
                type="button"
                onClick={() => handleNotificationClick(notification)}
                className="focus-visible:ring-ring min-w-0 flex-1 text-left focus:outline-none focus-visible:ring-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={cn(
                      "text-sm",
                      notification.isRead
                        ? "text-foreground font-normal"
                        : "text-foreground font-semibold",
                    )}
                  >
                    {notification.title}
                  </p>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {formatRelativeTime(notification.createdAt)}
                  </span>
                </div>
                <p className="text-muted-foreground mt-0.5 text-sm">
                  {truncate(notification.message, 100)}
                </p>
              </button>

              {!notification.isRead && (
                <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
              )}

              <button
                type="button"
                title="Delete permanently"
                aria-label="Delete notification"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate({ id: notification.id })}
                className="text-muted-foreground hover:text-destructive mt-0.5 shrink-0 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {meta && (
        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          total={meta.total}
          onPageChange={setPage}
          itemLabel="notification"
        />
      )}

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear all notifications?"
        description={`This permanently deletes all ${meta?.total ?? ""} of your notifications. It cannot be undone.`}
        confirmLabel="Clear all"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() =>
          deleteMutation.mutate({ all: true }, { onSuccess: () => setConfirmClear(false) })
        }
      />
    </div>
  )
}
