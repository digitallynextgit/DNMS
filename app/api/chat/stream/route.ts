import { NextRequest } from "next/server"
import { auth } from "@/server/auth"
import { subscribeChat } from "@/server/chat-stream"

// Long-lived SSE - Node runtime, never cached.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET /api/chat/stream
// Pushes this user's chat events (new message, read receipt) as they happen.
// Mirrors /api/notifications/stream; separate channel so chat volume and
// notification volume stay independent.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })
  // Client-portal accounts have no chat.
  if (session.user.kind === "client") return new Response("Forbidden", { status: 403 })

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

      send(`retry: 5000\n: connected\n\n`)

      const unsubscribe = await subscribeChat(employeeId, (event) => {
        send(`event: chat\ndata: ${JSON.stringify(event)}\n\n`)
      })

      // Below the usual proxy read-timeout so nginx does not close an idle chat.
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
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
