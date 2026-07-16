import { NextRequest } from "next/server"
import { auth } from "@/server/auth"
import { subscribeNotifications } from "@/server/notification-stream"

// Long-lived SSE connection - must run on the Node runtime and never be cached
// or statically optimized.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET /api/notifications/stream
// Server-Sent Events: pushes this user's new notifications the instant they're
// created (via Postgres LISTEN/NOTIFY), so the bell/toasts update in <1s with no
// polling. The browser's EventSource auto-reconnects if the stream drops.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 })
  }
  const employeeId = session.user.id
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false
      const send = (chunk: string) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(chunk))
        } catch {
          closed = true
        }
      }

      // Open the stream + a retry hint (browser waits 5s before reconnecting).
      send(`retry: 5000\n: connected\n\n`)

      const unsubscribe = await subscribeNotifications(employeeId, (event) => {
        send(`event: notification\ndata: ${JSON.stringify(event)}\n\n`)
      })

      // Heartbeat < proxy read-timeout keeps nginx/load-balancers from closing it.
      const heartbeat = setInterval(() => send(`: ping\n\n`), 25_000)

      const cleanup = () => {
        if (closed) return
        closed = true
        clearInterval(heartbeat)
        unsubscribe()
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      }

      req.signal.addEventListener("abort", cleanup)
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Tell nginx (and other proxies) not to buffer this response.
      "X-Accel-Buffering": "no",
    },
  })
}
