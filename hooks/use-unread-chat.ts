"use client"

import { useQuery } from "@tanstack/react-query"

async function fetchUnreadChat(): Promise<number> {
  const res = await fetch("/api/chat/unread")
  if (!res.ok) return 0
  const data = await res.json()
  return data.unreadCount ?? 0
}

/** Polled, not pushed: the chat SSE stream only runs while the Chat screen is open. */
export function useUnreadChatCount() {
  return useQuery({
    queryKey: ["chat", "unread-count"],
    queryFn: fetchUnreadChat,
    // A sidebar badge may lag a minute; on the Chat screen SSE invalidates this key anyway.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
}
