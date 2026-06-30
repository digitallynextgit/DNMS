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

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    // ── Step 1: probe - expect 401 with Digest challenge ──────────────────────
    let probe: Response
    try {
      probe = await fetch(url, {
        method,
        headers,
        body: bodyStr,
        signal: controller.signal,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { ok: false, status: 0, text: `Connection refused or unreachable: ${msg}` }
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
      authRes = await fetch(url, {
        method,
        headers: { ...headers, Authorization: authHeader },
        body: bodyStr,
        signal: controller.signal,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { ok: false, status: 0, text: `Auth request failed: ${msg}` }
    }

    const text = await authRes.text().catch(() => "")
    return { ok: authRes.ok, status: authRes.status, text }
  } finally {
    clearTimeout(timer)
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
