"use client"

import { useCallback, useEffect, useRef } from "react"
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
  createdAt?: string
}

/**
 * Mounted once in the dashboard shell. Delivers new notifications in real time:
 *  - PRIMARY: an SSE stream (/api/notifications/stream) pushes each notification
 *    the instant it's created (Postgres LISTEN/NOTIFY), so latency is <1s.
 *  - FALLBACK: a slow (90s) poll catches anything missed if the stream drops.
 * Each notification is alerted once (deduped by id): an in-app toast when the tab
 * is focused, or a native OS notification when it's in the background.
 */
export function RealtimeNotifications() {
  const router = useRouter()
  const qc = useQueryClient()
  const seenRef = useRef<Set<string>>(new Set())
  const initializedRef = useRef(false)

  // Ask for notification permission. Browsers ignore requestPermission() unless
  // it runs inside a user gesture, so try on mount AND on the first interaction.
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return
    if (Notification.permission !== "default") return
    const ask = () => {
      if (Notification.permission === "default") Notification.requestPermission().catch(() => {})
      window.removeEventListener("pointerdown", ask)
      window.removeEventListener("keydown", ask)
    }
    Notification.requestPermission().catch(() => {})
    window.addEventListener("pointerdown", ask, { once: true })
    window.addEventListener("keydown", ask, { once: true })
    return () => {
      window.removeEventListener("pointerdown", ask)
      window.removeEventListener("keydown", ask)
    }
  }, [])

  const alertOnce = useCallback(
    (n: InboxNotification) => {
      if (seenRef.current.has(n.id)) return
      seenRef.current.add(n.id)
      // Keep the seen-set from growing forever.
      if (seenRef.current.size > 500) {
        seenRef.current = new Set(Array.from(seenRef.current).slice(-250))
      }

      const canNotify =
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
      const hidden = typeof document !== "undefined" && document.visibilityState === "hidden"

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

      // Refresh the bell count + notifications page immediately.
      qc.invalidateQueries({ queryKey: ["notifications"] })
    },
    [router, qc],
  )

  // ─── Primary: SSE stream ──────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") return
    const es = new EventSource("/api/notifications/stream")
    es.addEventListener("notification", (e) => {
      try {
        alertOnce(JSON.parse((e as MessageEvent).data) as InboxNotification)
      } catch {
        /* ignore malformed frame */
      }
    })
    // EventSource reconnects on its own; nothing to do on error.
    return () => es.close()
  }, [alertOnce])

  // ─── Fallback: slow poll (safety net if the stream is down) ────────────────
  const { data } = useQuery({
    queryKey: ["notifications", "inbox-watch"],
    queryFn: () =>
      apiFetch<{ data: InboxNotification[] }>("/api/notifications/inbox?limit=8").then(
        (r) => r.data,
      ),
    refetchInterval: 90_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!data) return
    // First load: mark everything already present as seen (don't replay history).
    if (!initializedRef.current) {
      for (const n of data) seenRef.current.add(n.id)
      initializedRef.current = true
      return
    }
    // Oldest-first so multiple missed items toast in a sensible order.
    for (const n of [...data].reverse()) alertOnce(n)
  }, [data, alertOnce])

  return null
}
