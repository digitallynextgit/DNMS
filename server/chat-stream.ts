import "server-only"

// Real-time chat (and project-message) fan-out via Postgres LISTEN/NOTIFY. Kept apart from
// notification-stream.ts so chat volume never delays notifications. Published by the service,
// not a trigger, because the payload needs the sender's name.

import { Client } from "pg"

export interface ChatEvent {
  type: "message" | "read" | "delivered" | "project-message" | "reaction"
  conversationId: string
  recipientId: string
  messageId?: string
  senderId?: string
  senderName?: string
  body?: string
  createdAt?: string
  /** Set on "project-message": which project conversation moved. */
  projectId?: string
}

type Subscriber = (event: ChatEvent) => void

const CHANNEL = "dnms_chat"
const HEARTBEAT_MS = 30_000

// On globalThis so dev hot-reload doesn't leak a LISTEN connection per edit.
const g = globalThis as unknown as {
  __dnmsChatClient?: Client | null
  __dnmsChatStarting?: Promise<void> | null
  __dnmsChatHeartbeat?: NodeJS.Timeout
  __dnmsChatSubs?: Map<string, Set<Subscriber>>
}

const subscribers: Map<string, Set<Subscriber>> = (g.__dnmsChatSubs ??= new Map())

function clearHeartbeat() {
  if (g.__dnmsChatHeartbeat) {
    clearInterval(g.__dnmsChatHeartbeat)
    g.__dnmsChatHeartbeat = undefined
  }
}

async function connect(): Promise<void> {
  const client = new Client({ connectionString: process.env.DATABASE_URL })

  client.on("notification", (msg) => {
    if (!msg.payload) return
    try {
      const event = JSON.parse(msg.payload) as ChatEvent
      subscribers.get(event.recipientId)?.forEach((cb) => cb(event))
    } catch (e) {
      console.error("[chat-stream] bad payload:", e)
    }
  })

  const onFailure = (err: unknown) => {
    if (g.__dnmsChatClient !== client) return
    console.error("[chat-stream] connection lost, reconnecting:", err)
    g.__dnmsChatClient = null
    clearHeartbeat()
    client.removeAllListeners()
    client.end().catch(() => {})
    setTimeout(() => {
      ensureListening().catch((e) => console.error("[chat-stream] reconnect failed:", e))
    }, 2_000)
  }
  client.on("error", onFailure)
  client.on("end", () => onFailure(new Error("connection ended")))

  await client.connect()
  await client.query(`LISTEN ${CHANNEL}`)
  g.__dnmsChatClient = client

  clearHeartbeat()
  g.__dnmsChatHeartbeat = setInterval(() => {
    if (g.__dnmsChatClient !== client) return
    client.query("SELECT 1").catch(() => {})
  }, HEARTBEAT_MS)
  g.__dnmsChatHeartbeat.unref?.()
}

function ensureListening(): Promise<void> {
  if (g.__dnmsChatClient) return Promise.resolve()
  if (g.__dnmsChatStarting) return g.__dnmsChatStarting
  g.__dnmsChatStarting = connect().finally(() => {
    g.__dnmsChatStarting = null
  })
  return g.__dnmsChatStarting
}

/** Returns an unsubscribe fn. */
export async function subscribeChat(employeeId: string, cb: Subscriber): Promise<() => void> {
  await ensureListening()
  let set = subscribers.get(employeeId)
  if (!set) {
    set = new Set()
    subscribers.set(employeeId, set)
  }
  set.add(cb)

  return () => {
    const s = subscribers.get(employeeId)
    if (!s) return
    s.delete(cb)
    if (s.size === 0) subscribers.delete(employeeId)
  }
}

/** Never throws: a dropped event costs a refresh and must not fail a send already committed. */
export async function publishChat(event: ChatEvent): Promise<void> {
  try {
    const { db } = await import("@/server/db")
    // pg_notify() because NOTIFY takes no bind parameters (string-building it = injection).
    await db.$executeRaw`SELECT pg_notify(${CHANNEL}, ${JSON.stringify(event)})`
  } catch (e) {
    console.error("[chat-stream] publish failed:", e)
  }
}
