/* DNMS service worker - Web Push.
 *
 * This runs independently of any open tab, which is the whole point: the SSE
 * stream only lives while a page is open, so closing the tab used to mean no
 * alerts at all. Push wakes this worker instead.
 */

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
      // If a DNMS tab is actually on screen, the in-app toast already showed this
      // notification - don't stack an OS one on top. When every tab is hidden,
      // minimised or closed (the case this whole feature exists for), show it.
      const visible = clients.some((c) => c.visibilityState === "visible")
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
          if ("navigate" in client) return client.navigate(link)
          return undefined
        }
      }
      return self.clients.openWindow(link)
    }),
  )
})
