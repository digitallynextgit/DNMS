"use client"

import { useQuery } from "@tanstack/react-query"

async function fetchUnreadChat(): Promise<number> {
  const res = await fetch("/api/chat/unread")
  if (!res.ok) return 0
  const data = await res.json()
  return data.unreadCount ?? 0
}

/**
 * Unread chat messages, for the sidebar badge.
 *
 * Polled rather than pushed: the chat SSE stream only runs while the Chat screen
 * is open, and the badge has to be right on every other page too. The chat view
 * invalidates this key when a thread is read, so it clears immediately there.
 */
export function useUnreadChatCount() {
  return useQuery({
    queryKey: ["chat", "unread-count"],
    queryFn: fetchUnreadChat,
    // 60s, not 20s. On the Chat screen the SSE stream invalidates this key on
    // every frame, so the poll does nothing there; everywhere else it is the only
    // thing keeping the badge honest, which is why it cannot go entirely. A
    // sidebar count is allowed to be a minute behind - it was costing three
    // requests a minute on every page in the app.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
}
