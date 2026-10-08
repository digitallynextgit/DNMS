// Hikvision ISAPI client (HTTP Digest auth, built-in crypto + fetch).

import { createHash } from "crypto"
import { networkInterfaces } from "os"

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
  direction: "check-in" | "check-out" | "unknown"
}

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
 * On a mesh VPN (Tailscale, CGNAT 100.64.0.0/10)? A subnet route can reach a LAN we hold no
 * address on, so looksOffSubnet alone would wrongly blame "no route".
 */
function hasMeshVpn(): boolean {
  return localIPv4s().some((a) => {
    const [x, y] = a.split(".").map(Number)
    return x === 100 && y !== undefined && y >= 64 && y <= 127
  })
}

/** Turn a fetch failure into a clear cause: undici's "operation was aborted" means our timeout
 *  fired (usually no route), which is not the same as a refused connection. */
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

/** Authenticated request using the Digest two-step flow (401 challenge, then the real call). */
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

  // One timeout per round trip, so a slow 401 probe can't eat the real request's budget.
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
    // Step 1: probe - expect 401 with a Digest challenge.
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

    // Step 2: authenticated request.
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

/** Fetches access-control events for a date range, following the device's pagination. */
export async function fetchAttendanceEvents(
  device: HikvisionDeviceConfig,
  startDate: Date,
  endDate: Date,
  major = 0, // 0 = all events, 5 = Access Control only
  minor = 0, // 0 = all sub-types, 75 = access granted (person punches only)
  employeeNo?: string,
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
      // Server-side person filter; some firmware ignores it, so callers also filter client-side.
      ...(employeeNo ? { employeeNoString: employeeNo } : {}),
    },
  }

  const allEvents: AttendanceEvent[] = []
  let position = 0
  // ~30 events per page, so 50 pages caps one call at ~1500 events.
  const maxPages = 50

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
      // Keep only person punches (employeeNoString + time); any auth method, so no minor filter.
      if (!raw.employeeNoString || !raw.time) continue

      // The device sends an offset (e.g. +05:30), so this is the correct instant.
      const timestamp = new Date(raw.time)
      if (isNaN(timestamp.getTime())) continue

      // No direction from this single-reader device; the caller uses first = in, last = out.
      allEvents.push({ employeeNo: raw.employeeNoString, timestamp, direction: "unknown" })
    }

    // Pages are smaller than maxResults, so keep paging while "MORE" or totalMatches says so -
    // a short-page check would silently drop later punches.
    const numThisPage = acsEvent.numOfMatches ?? rawList.length
    position += numThisPage
    const hasMore =
      acsEvent.responseStatusStrg === "MORE" ||
      (acsEvent.totalMatches !== undefined && position < acsEvent.totalMatches)
    if (!hasMore || rawList.length === 0) break
  }

  return { events: allEvents }
}

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

/** Unauthenticated probe (401 Digest challenge), so a scan never sends credentials to every
 *  host on the subnet - only real candidates get an authenticated read. */
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

/** Sweep a /24 for the device by identity: an unauthenticated probe of all hosts, then an
 *  authenticated identity read of only those that look like a Hikvision. */
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
