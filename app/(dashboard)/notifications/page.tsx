"use client"

import { useState } from "react"
import { useUrlPage } from "@/hooks/use-url-state"
import { useRouter } from "next/navigation"
import { CheckCircle, Info, AlertCircle, CheckCheck } from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { Button } from "@/components/ui/button"
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

// ─── Page ─────────────────────────────────────────────────────────────────────

const LIMIT = 10

export default function NotificationsPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const [page, setPage] = useUrlPage()

  const { data, isLoading } = useQuery<NotificationsResponse>({
    queryKey: ["notifications", page],
    queryFn: async () => {
      const res = await fetch(`/api/notifications/inbox?page=${page}&limit=${LIMIT}`)
      if (!res.ok) throw new Error("Failed to load notifications")
      return res.json()
    },
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
          hasUnread ? (
            <Button
              variant="outline"
              onClick={handleMarkAllRead}
              disabled={markReadMutation.isPending}
            >
              <CheckCheck className="mr-2 h-4 w-4" />
              Mark all as read
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-2">
        {isLoading ? (
          <ListSkeleton rows={6} height="h-[88px]" />
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={CheckCircle}
            title="You're all caught up!"
            description="No new notifications at the moment. Check back later."
          />
        ) : (
          notifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              onClick={() => handleNotificationClick(notification)}
              className={cn(
                "bg-card hover:bg-muted/40 focus-visible:ring-ring flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors focus:outline-none focus-visible:ring-2",
                !notification.isRead &&
                  "border-l-4 border-l-blue-500 bg-blue-50/30 hover:bg-blue-50/50",
              )}
            >
              <div className="bg-muted mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                {getNotificationIcon(notification.type)}
              </div>

              <div className="min-w-0 flex-1">
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
              </div>

              {!notification.isRead && (
                <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
              )}
            </button>
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
    </div>
  )
}
