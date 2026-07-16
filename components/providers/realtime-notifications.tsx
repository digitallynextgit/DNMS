"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-fetch"

interface InboxNotification {
  id: string
  title: string
  message: string
  link: string | null
  type: string
  createdAt: string
}

/**
 * Mounted once in the dashboard shell. Polls the notification inbox and, when a
 * NEW notification arrives (raised by anyone, without a page reload), surfaces it:
 *  - an in-app toast when the tab is focused, and
 *  - a native browser/OS notification when the tab is in the background
 *    (so it behaves like a push while you're working elsewhere).
 * The very first poll only establishes a baseline - it never alerts for the
 * notifications that already existed when the page loaded.
 */
export function RealtimeNotifications() {
  const router = useRouter()
  const qc = useQueryClient()
  const baselineRef = useRef<number | null>(null)

  // Ask for permission once (browsers grant/deny silently if already decided).
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().catch(() => {})
      }
    }
  }, [])

  const { data } = useQuery({
    queryKey: ["notifications", "inbox-watch"],
    queryFn: () =>
      apiFetch<{ data: InboxNotification[] }>("/api/notifications/inbox?limit=8").then(
        (r) => r.data,
      ),
    refetchInterval: 20_000,
    // Keep polling even when the tab is in the background, so a native
    // notification can fire while the user is working elsewhere.
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
  })

  useEffect(() => {
    if (!data || data.length === 0) return
    const newest = Math.max(...data.map((n) => new Date(n.createdAt).getTime()))

    // First load: remember where we are, don't replay history.
    if (baselineRef.current === null) {
      baselineRef.current = newest
      return
    }
    if (newest <= baselineRef.current) return

    const fresh = data
      .filter((n) => new Date(n.createdAt).getTime() > (baselineRef.current ?? 0))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    baselineRef.current = newest

    const canNotify =
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted"
    const hidden = typeof document !== "undefined" && document.visibilityState === "hidden"

    for (const n of fresh) {
      if (hidden && canNotify) {
        const native = new Notification(n.title, { body: n.message, tag: n.id })
        native.onclick = () => {
          window.focus()
          if (n.link) router.push(n.link)
          native.close()
        }
      } else {
        toast(n.title, {
          description: n.message,
          action: n.link
            ? { label: "View", onClick: () => router.push(n.link as string) }
            : undefined,
        })
      }
    }

    // Nudge the bell/badge counts to update immediately alongside the alert.
    qc.invalidateQueries({ queryKey: ["notifications", "unread-count"] })
  }, [data, router, qc])

  return null
}
