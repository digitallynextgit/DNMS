/**
 * Hikvision ISAPI client using HTTP Digest Authentication.
 *
 * No external packages needed - uses Node.js built-in `crypto` and `fetch`.
 *
 * Relevant ISAPI endpoints used:
 *   GET  /ISAPI/System/deviceInfo          - ping / device info
 *   POST /ISAPI/AccessControl/AcsEvent?format=json - fetch access-control events
 */

import { createHash } from "crypto"
import { networkInterfaces } from "os"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HikvisionDeviceConfig {
  ipAddress: string
  port: number
  username: string
  password: string
}

export interface DeviceInfo {
  deviceName: string
  deviceID: string
  firmwareVersion: string
  model: string
}

/** Raw event record returned by the Hikvision AcsEvent endpoint (real field names). */
interface HikvisionAcsEvent {
  /** Event category. 5 = Access Control, 2 = device/door management. */
  major?: number
  /** Event sub-type. 75 = access granted (face/card/fp) - carries employeeNoString. */
  minor?: number
  /** Person ID set on the device; matches Employee.deviceId / employeeNo. */
  employeeNoString?: string
  name?: string
  /** "YYYY-MM-DDThh:mm:ss+ZZ:ZZ" - the device's event timestamp. */
  time?: string
  currentVerifyMode?: string
  cardNo?: string
  cardReaderNo?: number
  doorNo?: number
  serialNo?: number
}

export interface AttendanceEvent {
  employeeNo: string
  timestamp: Date
  /** "check-in" | "check-out" | "unknown" */
  direction: "check-in" | "check-out" | "unknown"
}

// ─── Digest Auth helpers ───────────────────────────────────────────────────────

function md5(s: string): string {
  return createHash("md5").update(s).digest("hex")
}

function parseDigestChallenge(wwwAuth: string): Record<string, string> {
  const result: Record<string, string> = {}
  // Match key="value" or key=value pairs
  const regex = /(\w+)=(?:"([^"]+)"|([^,\s]+))/g
  let m: RegExpExecArray | null
  while ((m = regex.exec(wwwAuth)) !== null) {
    result[m[1]] = m[2] ?? m[3]
  }
  return result
}

function buildDigestHeader(
  method: string,
  uri: string,
  username: string,
  password: string,
  challenge: Record<string, string>,
): string {
  const { realm = "", nonce = "", qop, opaque } = challenge

  const ha1 = md5(`${username}:${realm}:${password}`)
  const ha2 = md5(`${method}:${uri}`)

  let nc = ""
  let cnonce = ""
  let response = ""

  if (qop === "auth") {
    nc = "00000001"
    cnonce = Math.random().toString(36).substring(2, 10)
    response = md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
  } else {
    response = md5(`${ha1}:${nonce}:${ha2}`)
  }

  let header = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}"`
  if (qop === "auth") header += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`
  if (opaque) header += `, opaque="${opaque}"`

  return header
}

// ─── Core request function ─────────────────────────────────────────────────────

/** The IPv4 networks this server is actually attached to, e.g. ["192.168.1.38/24"]. */
function localIPv4s(): string[] {
  const out: string[] = []
  for (const addrs of Object.values(networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === "IPv4" && !a.internal && !a.address.startsWith("169.254.")) {
        out.push(a.address)
      }
    }
  }
  return out
}

/** True when `ip` shares no /24 with any address on this machine. */
function looksOffSubnet(ip: string): boolean {
  const net = (s: string) => s.split(".").slice(0, 3).join(".")
  const locals = localIPv4s()
  if (locals.length === 0 || !/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return false
  return !locals.some((l) => net(l) === net(ip))
}

/**
 * Is this host on a mesh VPN (Tailscale / headscale)?
 *
 * Matters because a subnet ROUTE reaches a LAN without holding an address on
 * it: with `--advertise-routes` on an office machine and `--accept-routes`
 * here, this server can talk to 192.168.29.x while owning no 192.168.29.*
 * interface. Without this check `looksOffSubnet` would be technically true and
 * the message would confidently blame "no route" when the real fault is a
 * powered-off device or an unapproved route.
 *
 * 100.64.0.0/10 is the CGNAT range Tailscale assigns.
 */
function hasMeshVpn(): boolean {
  return localIPv4s().some((a) => {
    const [x, y] = a.split(".").map(Number)
    return x === 100 && y !== undefined && y >= 64 && y <= 127
  })
}

/**
 * Turn a raw fetch failure into something that says what actually went wrong.
 *
 * The old message was `Connection refused or unreachable: This operation was
 * aborted`, which is wrong twice over: nothing refused anything, and "this
 * operation was aborted" is undici's word for "your AbortSignal fired", i.e. a
 * TIMEOUT. Those are completely different faults - a refusal means the host is
 * up and the port is shut, a silent timeout usually means the packets are not
 * being routed at all - and the message pointed at neither.
 */
function describeFetchFailure(err: unknown, ip: string, port: number, timeoutMs: number): string {
  const raw = err instanceof Error ? err.message : String(err)
  const name = err instanceof Error ? err.name : ""
  const code = (err as { cause?: { code?: string } })?.cause?.code

  if (name === "AbortError" || /abort/i.test(raw)) {
    const locals = localIPv4s()
    let hint: string
    if (!looksOffSubnet(ip)) {
      hint = ` The server is on the same /24, so check the device is powered on and that no firewall is dropping port ${port}.`
    } else if (hasMeshVpn()) {
      // A subnet route can carry us to a LAN we hold no address on, so "off
      // subnet" is not evidence of "no route" here.
      hint = ` This server reaches ${ip} over a VPN subnet route rather than a local interface, so check: the route for that subnet is advertised AND approved in the VPN admin, this host was brought up with --accept-routes, and the device is powered on.`
    } else {
      hint = ` This server is on ${locals.join(", ") || "no LAN address"}, which is a different network from ${ip} - it has no route to the device. Sync has to run from a machine on the device's LAN, or from a host with a VPN subnet route into it.`
    }
    return `No response from ${ip}:${port} within ${Math.round(timeoutMs / 1000)}s - the connection was not refused, nothing answered at all.${hint}`
  }
  if (code === "ECONNREFUSED") {
    return `${ip}:${port} refused the connection - the host is reachable but nothing is listening on that port.`
  }
  if (code === "EHOSTUNREACH" || code === "ENETUNREACH") {
    return `No route to ${ip}:${port} from this server (${localIPv4s().join(", ") || "no LAN address"}).`
  }
  if (code === "ETIMEDOUT") {
    return `Timed out connecting to ${ip}:${port}.`
  }
  return `${ip}:${port}: ${raw}`
}

/**
 * Makes an authenticated request to a Hikvision device using HTTP Digest Auth.
 * Performs the standard two-request flow (challenge → authenticated request).
 */
async function hikvisionRequest(
  device: HikvisionDeviceConfig,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  timeoutMs = 8000,
): Promise<{ ok: boolean; status: number; text: string }> {
  const baseUrl = `http://${device.ipAddress}:${device.port}`
  const url = `${baseUrl}${path}`

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  }

  const bodyStr = body ? JSON.stringify(body) : undefined

  // One timer PER round trip, not one shared across both.
  //
  // Digest auth is two requests, and a single AbortController started before the
  // challenge meant they shared one budget: if the 401 probe took 6 of the 8
  // seconds, the authenticated request - the one that actually does the work -
  // got 2. On a slow device that produced a spurious "aborted" on a link that
  // was working, and the timeout value no longer meant what it says.
  const withTimeout = async <T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await fn(controller.signal)
    } finally {
      clearTimeout(timer)
    }
  }

  {
    // ── Step 1: probe - expect 401 with Digest challenge ──────────────────────
    let probe: Response
    try {
      probe = await withTimeout((signal) => fetch(url, { method, headers, body: bodyStr, signal }))
    } catch (err) {
      return {
        ok: false,
        status: 0,
        text: describeFetchFailure(err, device.ipAddress, device.port, timeoutMs),
      }
    }

    if (probe.status !== 401) {
      // Device responded without requesting auth (or immediate error)
      const text = await probe.text().catch(() => "")
      return { ok: probe.ok, status: probe.status, text }
    }

    const wwwAuth = probe.headers.get("www-authenticate") ?? ""
    if (!wwwAuth.toLowerCase().startsWith("digest")) {
      return { ok: false, status: 401, text: "Device requires non-Digest authentication" }
    }

    const challenge = parseDigestChallenge(wwwAuth)
    const authHeader = buildDigestHeader(method, path, device.username, device.password, challenge)

    // ── Step 2: authenticated request ─────────────────────────────────────────
    let authRes: Response
    try {
      authRes = await withTimeout((signal) =>
        fetch(url, {
          method,
          headers: { ...headers, Authorization: authHeader },
          body: bodyStr,
          signal,
        }),
      )
    } catch (err) {
      return {
        ok: false,
        status: 0,
        text: describeFetchFailure(err, device.ipAddress, device.port, timeoutMs),
      }
    }

    const text = await authRes.text().catch(() => "")
    return { ok: authRes.ok, status: authRes.status, text }
  }
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Tests connectivity to a Hikvision device by fetching device info.
 * Returns success flag and a human-readable message.
 */
export async function testDeviceConnection(
  device: HikvisionDeviceConfig,
): Promise<{ success: boolean; message: string; info?: DeviceInfo }> {
  const result = await hikvisionRequest(device, "GET", "/ISAPI/System/deviceInfo")

  if (!result.ok) {
    return {
      success: false,
      message:
        result.status === 401
          ? "Authentication failed - check username/password"
          : result.status === 0
            ? result.text
            : `Device returned HTTP ${result.status}`,
    }
  }

  try {
    const json = JSON.parse(result.text)
    const info: DeviceInfo = {
      deviceName: json.DeviceInfo?.deviceName ?? json.deviceName ?? "Unknown",
      deviceID: json.DeviceInfo?.deviceID ?? json.deviceID ?? "Unknown",
      firmwareVersion: json.DeviceInfo?.firmwareVersion ?? json.firmwareVersion ?? "Unknown",
      model: json.DeviceInfo?.model ?? json.model ?? "Unknown",
    }
    return { success: true, message: "Connection successful", info }
  } catch {
    // Non-JSON but 200 - still a success
    return { success: true, message: "Connected (non-JSON response)" }
  }
}

/**
 * Fetches access-control events (check-in / check-out) from a Hikvision device
 * for a given date range.
 *
 * Hikvision returns events in pages of up to 50; this function handles pagination
 * transparently and returns all events in the range.
 */
export async function fetchAttendanceEvents(
  device: HikvisionDeviceConfig,
  startDate: Date,
  endDate: Date,
  major = 0, // 0 = all events, 5 = Access Control only
  minor = 0, // 0 = all sub-types, 75 = access granted (person punches only)
  employeeNo?: string, // when set, ask the device for just this person's events
): Promise<{ events: AttendanceEvent[]; error?: string }> {
  const formatISOLocal = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "+00:00")

  const searchCondition = {
    AcsEventCond: {
      searchID: "1",
      searchResultPosition: 0,
      maxResults: 50,
      major,
      minor,
      startTime: formatISOLocal(startDate),
      endTime: formatISOLocal(endDate),
      // Server-side person filter. Honored by most firmware; when it isn't, the
      // caller still filters client-side, so results stay correct either way.
      ...(employeeNo ? { employeeNoString: employeeNo } : {}),
    },
  }

  const allEvents: AttendanceEvent[] = []
  let position = 0
  // Device returns ~30/page; a single busy day can exceed 500 events. With
  // per-day fetching this caps one day at 50*~30 ≈ 1500 events.
  const maxPages = 50 // safety limit

  for (let page = 0; page < maxPages; page++) {
    searchCondition.AcsEventCond.searchResultPosition = position

    const result = await hikvisionRequest(
      device,
      "POST",
      "/ISAPI/AccessControl/AcsEvent?format=json",
      searchCondition,
      20000, // event queries can be slow with many results - give the device time
    )

    if (!result.ok) {
      return {
        events: allEvents,
        error:
          result.status === 0
            ? result.text
            : `Device returned HTTP ${result.status} while fetching events`,
      }
    }

    let json: {
      AcsEvent?: {
        searchID?: string
        responseStatusStrg?: string
        numOfMatches?: number
        totalMatches?: number
        InfoList?: HikvisionAcsEvent[]
      }
    }
    try {
      json = JSON.parse(result.text)
    } catch {
      break
    }

    const acsEvent = json.AcsEvent
    if (!acsEvent || acsEvent.responseStatusStrg === "NO MATCH") break

    const rawList: HikvisionAcsEvent[] = acsEvent.InfoList ?? []

    for (const raw of rawList) {
      // Keep only person-identified punches (those carrying employeeNoString +
      // time); door/alarm/system events lack these and are skipped. This holds
      // for any auth method (face/card/fingerprint), so we don't filter by minor.
      if (!raw.employeeNoString || !raw.time) continue

      // The device sends an offset (e.g. "...+05:30"), so this resolves to the
      // correct instant; the app then renders it back in local time.
      const timestamp = new Date(raw.time)
      if (isNaN(timestamp.getTime())) continue

      // This single-reader device doesn't encode entry/exit direction, so the
      // caller derives the day's first punch = check-in, last = check-out.
      allEvents.push({ employeeNo: raw.employeeNoString, timestamp, direction: "unknown" })
    }

    // The device pages results in chunks SMALLER than maxResults (e.g. 30/page)
    // and signals that more remain via responseStatusStrg="MORE" and/or
    // totalMatches. Keep paging while either says so - a `rawList.length <
    // maxResults` check would stop after the first short page and silently drop
    // later punches (heavy punchers have many events per range).
    const numThisPage = acsEvent.numOfMatches ?? rawList.length
    position += numThisPage
    const hasMore =
      acsEvent.responseStatusStrg === "MORE" ||
      (acsEvent.totalMatches !== undefined && position < acsEvent.totalMatches)
    if (!hasMore || rawList.length === 0) break
  }

  return { events: allEvents }
}

// ─── Finding the device after DHCP moves it ───────────────────────────────────

export interface DeviceIdentity {
  serialNumber: string
  macAddress: string
  model: string
  deviceName: string
}

/** Serial + MAC, which is what identifies the box regardless of its address. */
export async function getDeviceIdentity(
  device: HikvisionDeviceConfig,
): Promise<DeviceIdentity | null> {
  const res = await hikvisionRequest(device, "GET", "/ISAPI/System/deviceInfo")
  if (!res.ok) return null

  // Firmware answers this one in XML even when asked for JSON, so read both.
  const pick = (tag: string) =>
    new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(res.text)?.[1]?.trim() ?? ""
  let json: Record<string, string> = {}
  try {
    const parsed = JSON.parse(res.text)
    json = parsed.DeviceInfo ?? parsed ?? {}
  } catch {
    /* XML, handled by pick() */
  }

  const serialNumber = json.serialNumber || pick("serialNumber")
  const macAddress = (json.macAddress || pick("macAddress")).toLowerCase()
  if (!serialNumber && !macAddress) return null

  return {
    serialNumber,
    macAddress,
    model: json.model || pick("model"),
    deviceName: json.deviceName || pick("deviceName"),
  }
}

/**
 * Does this address look like a Hikvision terminal?
 *
 * Deliberately UNAUTHENTICATED. A scan has to touch every address on the subnet,
 * most of which are laptops, phones and printers, and sending the admin digest
 * response to all of them would hand a hash to anything listening. ISAPI answers
 * 401 with its Digest challenge before any credential is offered, so the cheap
 * unauthenticated probe is enough to narrow the field to the real candidates -
 * and only those get authenticated.
 */
async function looksLikeHikvision(ip: string, port: number, timeoutMs: number): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`http://${ip}:${port}/ISAPI/System/deviceInfo`, {
      signal: controller.signal,
      redirect: "manual",
    })
    if (res.status !== 401) return false
    return (res.headers.get("www-authenticate") ?? "").toLowerCase().includes("digest")
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

/** Run `task` over `items` at most `limit` at a time. */
async function pooled<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = []
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = cursor++
      if (i >= items.length) return
      out[i] = await task(items[i]!)
    }
  })
  await Promise.all(workers)
  return out
}

export interface DiscoveryTarget {
  /** Match on this serial, the MAC, or both. Whichever is known. */
  serialNumber?: string | null
  macAddress?: string | null
  username: string
  password: string
  port: number
}

/**
 * Sweep a /24 for the device, matching on identity rather than address.
 *
 * Two passes on purpose: an unauthenticated probe of all 254 addresses (fast,
 * credential-free), then an authenticated identity read of only the handful that
 * answered like a Hikvision. On a normal office LAN that is one or two hosts.
 */
export async function discoverOnLan(
  subnetPrefix: string,
  target: DiscoveryTarget,
  opts: { skip?: string[]; probeTimeoutMs?: number } = {},
): Promise<{ ipAddress: string; identity: DeviceIdentity } | null> {
  const skip = new Set(opts.skip ?? [])
  const candidates: string[] = []
  for (let host = 1; host <= 254; host++) {
    const ip = `${subnetPrefix}.${host}`
    if (!skip.has(ip)) candidates.push(ip)
  }

  const timeout = opts.probeTimeoutMs ?? 700
  const flags = await pooled(candidates, 48, (ip) => looksLikeHikvision(ip, target.port, timeout))
  const hikvisions = candidates.filter((_, i) => flags[i])

  const wantSerial = target.serialNumber?.trim().toLowerCase()
  const wantMac = target.macAddress?.trim().toLowerCase()

  for (const ip of hikvisions) {
    const identity = await getDeviceIdentity({
      ipAddress: ip,
      port: target.port,
      username: target.username,
      password: target.password,
    })
    if (!identity) continue
    const serialHit = !!wantSerial && identity.serialNumber.toLowerCase() === wantSerial
    const macHit = !!wantMac && identity.macAddress.toLowerCase() === wantMac
    if (serialHit || macHit) return { ipAddress: ip, identity }
  }

  // Exactly one Hikvision on the network and nothing recorded to match against:
  // it can only be this one. With two or more we refuse to guess.
  if (!wantSerial && !wantMac && hikvisions.length === 1) {
    const only = hikvisions[0]!
    const identity = await getDeviceIdentity({
      ipAddress: only,
      port: target.port,
      username: target.username,
      password: target.password,
    })
    if (identity) return { ipAddress: only, identity }
  }

  return null
}
