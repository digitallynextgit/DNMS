"use client"

import { useQuery } from "@tanstack/react-query"

async function fetchUnreadCount(): Promise<number> {
  const res = await fetch("/api/notifications/inbox?unread=true&limit=1")
  if (!res.ok) return 0
  const data = await res.json()
  return data.unreadCount ?? 0
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: fetchUnreadCount,
    // Live updates come from SSE invalidating ["notifications"]; this poll only covers an SSE
    // outage (the inbox fallback does not invalidate this key).
    refetchInterval: 90_000,
    refetchOnWindowFocus: true,
  })
}
