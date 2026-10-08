/* DNMS service worker - Web Push. Runs with no tab open, unlike the SSE stream. */

self.addEventListener("install", () => {
  // Take over immediately instead of waiting for old tabs to close.
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("push", (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { title: "DNMS", message: event.data ? event.data.text() : "" }
  }

  const title = payload.title || "DNMS"
  const options = {
    body: payload.message || "",
    icon: "/icon.png",
    badge: "/icon.png",
    // Collapse repeats of the same notification instead of stacking them.
    tag: payload.id || undefined,
    renotify: Boolean(payload.id),
    data: { link: payload.link || "/dashboard" },
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // A visible APP tab already showed the in-app toast. Marketing/login pages have no toast
      // layer, so they must not suppress the OS notification.
      const APP_PATHS = ["/dashboard", "/portal", "/projects", "/chat", "/attendance"]
      const visible = clients.some((c) => {
        if (c.visibilityState !== "visible") return false
        try {
          const path = new URL(c.url).pathname
          // Tenant-prefixed URLs (/{tenant}/dashboard) match on any segment.
          return APP_PATHS.some((p) => path === p || path.includes(p + "/") || path.endsWith(p))
        } catch {
          return false
        }
      })
      if (visible) return undefined
      return self.registration.showNotification(title, options)
    }),
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const link = (event.notification.data && event.notification.data.link) || "/dashboard"

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Focus an existing DNMS tab and navigate it, rather than opening a new one.
      for (const client of clients) {
        if ("focus" in client) {
          client.focus()
          if ("navigate" in client) {
            // navigate() rejects for a tab this worker doesn't control - fall back to a new window.
            return client.navigate(link).catch(() => self.clients.openWindow(link))
          }
          return undefined
        }
      }
      return self.clients.openWindow(link)
    }),
  )
})
