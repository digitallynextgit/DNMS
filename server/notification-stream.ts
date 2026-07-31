import "server-only"

import { Client } from "pg"

// Real-time notification fan-out via Postgres LISTEN/NOTIFY.
//
// A single long-lived pg client holds `LISTEN dnms_notifications`. The DB trigger
// `dnms_notifications_notify` fires `pg_notify(...)` on every INSERT into
// `notifications`, so the instant a notification row is created (from ANY app
// process) this client receives it and hands it to the matching user's open SSE
// streams. Postgres broadcasts NOTIFY to every listening connection, so this is
// safe under PM2 cluster mode too - each process listens and serves its own
// browser connections.

export interface NotificationEvent {
  employeeId: string
  id: string
  title: string
  message: string
  link: string | null
  type: string
}

type Subscriber = (event: NotificationEvent) => void

// Survive dev hot-reload / avoid duplicate listeners per process.
const g = globalThis as unknown as {
  __dnmsNotifSubs?: Map<string, Set<Subscriber>>
  __dnmsNotifClient?: Client | null
  __dnmsNotifStarting?: Promise<void> | null
  __dnmsNotifHeartbeat?: NodeJS.Timeout | null
}

// A LISTEN connection sends nothing while it waits, so managed Postgres / NAT /
// firewalls reap it as idle - which is what produced the repeating ECONNRESET.
// A lightweight query on an interval keeps it active (and surfaces a dead socket
// fast, so we reconnect proactively instead of missing notifications).
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
    // TCP-level keepalive so a NAT/firewall doesn't silently drop the idle socket.
    keepAlive: true,
    keepAliveInitialDelayMillis: 30_000,
  })

  client.on("notification", (msg) => {
    if (msg.channel === "dnms_notifications" && msg.payload) dispatch(msg.payload)
  })

  // On any connection failure, drop the client and reconnect after a short delay.
  // Existing subscribers stay in the map, so they resume receiving once we're back.
  const onFailure = (err: unknown) => {
    if (g.__dnmsNotifClient !== client) return // already replaced
    // ECONNRESET on an idle LISTEN socket is an expected, recoverable event
    // (idle reap, dev hot-reload) - warn rather than error so it isn't alarming.
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

  // Application-level heartbeat: keeps the connection from being reaped as idle,
  // and a failed ping trips onFailure -> reconnect before a notification is missed.
  clearHeartbeat()
  g.__dnmsNotifHeartbeat = setInterval(() => {
    if (g.__dnmsNotifClient !== client) return
    client.query("SELECT 1").catch(() => {
      /* the client 'error' handler drives the reconnect; nothing to do here */
    })
  }, HEARTBEAT_MS)
  // Don't let the heartbeat keep the process alive on its own.
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

/** Register a callback for one employee's notifications. Returns an unsubscribe fn. */
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
