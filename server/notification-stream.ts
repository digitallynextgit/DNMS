import "server-only"

import { Client } from "pg"

// Real-time notification fan-out: the DB trigger `dnms_notifications_notify` NOTIFYs on every
// INSERT into `notifications`; each process LISTENs and feeds its own SSE streams (PM2-safe).

export interface NotificationEvent {
  employeeId: string
  id: string
  title: string
  message: string
  link: string | null
  type: string
}

type Subscriber = (event: NotificationEvent) => void

// On globalThis so dev hot-reload doesn't create duplicate listeners.
const g = globalThis as unknown as {
  __dnmsNotifSubs?: Map<string, Set<Subscriber>>
  __dnmsNotifClient?: Client | null
  __dnmsNotifStarting?: Promise<void> | null
  __dnmsNotifHeartbeat?: NodeJS.Timeout | null
}

// An idle LISTEN socket gets reaped by NAT/firewalls (ECONNRESET); a periodic query keeps it
// alive and surfaces a dead one fast.
const HEARTBEAT_MS = 50_000 // under the usual 60s idle cutoff

const subscribers: Map<string, Set<Subscriber>> = (g.__dnmsNotifSubs ??= new Map())

function dispatch(payload: string) {
  let event: NotificationEvent
  try {
    event = JSON.parse(payload) as NotificationEvent
  } catch {
    return
  }
  const set = subscribers.get(event.employeeId)
  if (!set) return
  for (const cb of set) {
    try {
      cb(event)
    } catch {
      /* one bad subscriber must not break the others */
    }
  }
}

function clearHeartbeat() {
  if (g.__dnmsNotifHeartbeat) {
    clearInterval(g.__dnmsNotifHeartbeat)
    g.__dnmsNotifHeartbeat = null
  }
}

async function connect(): Promise<void> {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    keepAlive: true,
    keepAliveInitialDelayMillis: 30_000,
  })

  client.on("notification", (msg) => {
    if (msg.channel === "dnms_notifications" && msg.payload) dispatch(msg.payload)
  })

  // Reconnect after a short delay; subscribers stay in the map and resume.
  const onFailure = (err: unknown) => {
    if (g.__dnmsNotifClient !== client) return // already replaced
    // Expected and recoverable (idle reap, hot-reload), so warn rather than error.
    const code = (err as { code?: string })?.code
    console.warn(`[notif-stream] listener reconnecting (${code ?? "lost"})`)
    g.__dnmsNotifClient = null
    clearHeartbeat()
    try {
      client.end().catch(() => {})
    } catch {
      /* noop */
    }
    setTimeout(() => {
      ensureListening().catch((e) => console.error("[notif-stream] reconnect failed:", e))
    }, 2_000)
  }
  client.on("error", onFailure)
  client.on("end", () => onFailure(new Error("connection ended")))

  await client.connect()
  await client.query("LISTEN dnms_notifications")
  g.__dnmsNotifClient = client

  clearHeartbeat()
  g.__dnmsNotifHeartbeat = setInterval(() => {
    if (g.__dnmsNotifClient !== client) return
    client.query("SELECT 1").catch(() => {
      /* the 'error' handler drives the reconnect */
    })
  }, HEARTBEAT_MS)
  g.__dnmsNotifHeartbeat.unref?.()
}

function ensureListening(): Promise<void> {
  if (g.__dnmsNotifClient) return Promise.resolve()
  if (g.__dnmsNotifStarting) return g.__dnmsNotifStarting
  g.__dnmsNotifStarting = connect().finally(() => {
    g.__dnmsNotifStarting = null
  })
  return g.__dnmsNotifStarting
}

/** Returns an unsubscribe fn. */
export async function subscribeNotifications(
  employeeId: string,
  cb: Subscriber,
): Promise<() => void> {
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
