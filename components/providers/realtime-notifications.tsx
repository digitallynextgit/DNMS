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
 * Real-time notifications: an SSE stream first, a 90s poll as fallback. Each is alerted once
 * (a toast when focused, an OS notification when hidden).
 */
export function RealtimeNotifications() {
  const router = useRouter()
  const qc = useQueryClient()
  const seenRef = useRef<Set<string>>(new Set())
  const initializedRef = useRef(false)

  // requestPermission() only works in a user gesture, so try on mount and on first interaction.
  // Once granted, subscribe to Web Push, which works with every tab closed.
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return

    const ensurePush = () => {
      void registerPush()
    }

    if (Notification.permission === "granted") {
      ensurePush()
      return
    }
    if (Notification.permission !== "default") return

    const ask = () => {
      if (Notification.permission === "default") {
        Notification.requestPermission()
          .then((p) => {
            if (p === "granted") ensurePush()
          })
          .catch(() => {})
      }
      window.removeEventListener("pointerdown", ask)
      window.removeEventListener("keydown", ask)
    }
    Notification.requestPermission()
      .then((p) => {
        if (p === "granted") ensurePush()
      })
      .catch(() => {})
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

      // Web Push raises its own OS notification, so only raise one here when push isn't active.
      if (hidden && canNotify && !pushActive) {
        const native = new Notification(n.title, { body: n.message, tag: n.id })
        native.onclick = () => {
          window.focus()
          if (n.link) router.push(n.link)
          native.close()
        }
      } else if (hidden) {
        // Push will surface it; just refresh the in-app state below.
      } else {
        toast(n.title, {
          description: n.message,
          action: n.link
            ? { label: "View", onClick: () => router.push(n.link as string) }
            : undefined,
        })
      }

      qc.invalidateQueries({ queryKey: ["notifications"] })
    },
    [router, qc],
  )

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
    // First load: mark what's already there as seen (don't replay history).
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

/** While true, the SSE path skips its own OS notifications so they don't double up. */
let pushActive = false

/** base64url (VAPID public key) -> the BufferSource PushManager expects. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = window.atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

/** Safe to call repeatedly (server-side upsert). Silent on failure - push is only an enhancement. */
async function registerPush(): Promise<void> {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return
    const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapid) return // push not configured on this deployment

    const reg = await navigator.serviceWorker.register("/sw.js")
    await navigator.serviceWorker.ready

    const existing = await reg.pushManager.getSubscription()
    const sub =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource,
      }))

    const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return

    const res = await fetch("/api/notifications/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
    })
    // Only a confirmed registration may silence the SSE fallback.
    if (res.ok) pushActive = true
  } catch {
    // Unsupported browser, blocked SW, or offline - ignore.
  }
}

/** Call on sign-out, before the session ends, so the next person on a shared device doesn't get these notifications. */
export async function unregisterPush(): Promise<void> {
  try {
    if (!("serviceWorker" in navigator)) return
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    if (!sub) return
    await fetch(`/api/notifications/push?endpoint=${encodeURIComponent(sub.endpoint)}`, {
      method: "DELETE",
    }).catch(() => undefined)
    await sub.unsubscribe().catch(() => undefined)
    pushActive = false
  } catch {
    // Never block sign-out on push cleanup.
  }
}
