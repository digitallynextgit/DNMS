"use client"

import { useQuery } from "@tanstack/react-query"

async function fetchUnreadCount(): Promise<number> {
  const res = await fetch("/api/notifications/inbox?unread=true&limit=1")
  if (!res.ok) return 0
  const data = await res.json()
  return data.unreadCount ?? 0
}

/**
 * Live count of unread notifications for the topbar bell and sidebar badges.
 * Polls every 15s (and on window focus); the notifications page invalidates
 * the `["notifications"]` key on mark-as-read, so the badge clears instantly.
 */
export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: fetchUnreadCount,
    // 15s + refetch-on-focus meant ~8 authenticated DB round trips a minute per open
    // tab, purely for a badge count. Mutations already invalidate this key, so the
    // poll is only a safety net for events raised by OTHER users.
    refetchInterval: 120_000,
  })
}
