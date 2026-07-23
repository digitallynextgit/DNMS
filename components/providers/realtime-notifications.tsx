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
  // Once granted we also register the service worker and subscribe to Web Push -
  // that's what delivers alerts when NO DNMS tab is open (the SSE stream below
  // only lives as long as this page does).
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return

    const ensurePush = () => {
      void registerPush()
    }

    if (Notification.permission === "granted") {
      ensurePush()
      return
    }
    if (Notification.permission !== "default") return // denied - nothing to do

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

      // Web Push owns OS notifications whenever it's active - the service worker
      // will raise one for this same notification, so raising a second one here
      // would double up. Fall back to a native notification only when push isn't
      // available (permission denied, unsupported browser, push not configured).
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

/** True once this browser has a live Web Push subscription. While it is, the SSE
 *  path stops raising its own OS notifications so the two don't double up. */
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

/**
 * Register the service worker and make sure this browser has a Web Push
 * subscription on file. Safe to call repeatedly - re-subscribing the same
 * endpoint is an upsert server-side. Silent on failure: push is an enhancement,
 * never a reason to break the page.
 */
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

    await fetch("/api/notifications/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
    })
    pushActive = true
  } catch {
    // Unsupported browser, blocked SW, or offline - ignore.
  }
}
