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
    // 90s, not 20s. Real-time freshness does NOT come from this poll: the SSE
    // stream in realtime-notifications.tsx invalidates ["notifications"] on
    // every push, which prefix-matches this key, so the bell already updates the
    // instant an event arrives.
    //
    // The poll is only a safety net for the stream being down, so it is aligned
    // with the inbox-watch fallback's own 90s cadence rather than running 4.5x
    // faster than the thing it backs up. (It cannot be removed outright - that
    // fallback refetches the inbox but does not invalidate THIS key, so the
    // badge would sit stale through an SSE outage.)
    refetchInterval: 90_000,
    refetchOnWindowFocus: true,
  })
}
