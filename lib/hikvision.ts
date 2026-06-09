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

/** Raw event record returned by the Hikvision AcsEvent endpoint */
interface HikvisionAcsEvent {
  majorEventType: number
  subEventType: number
  /** Employee number as string, matches AttendanceRule employeeNoString */
  employeeNoString?: string
  name?: string
  /** "YYYY-MM-DDThh:mm:ss+ZZ:ZZ" */
  dateTime?: string
  /** 1 = check-in, 2 = check-out */
  currentVerifyMode?: string
  cardNo?: string
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
): Promise<{ events: AttendanceEvent[]; error?: string }> {
  const formatISOLocal = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "+00:00")

  const searchCondition = {
    AcsEventCond: {
      searchID: "1",
      searchResultPosition: 0,
      maxResults: 50,
      major,
      minor: 0,
      startTime: formatISOLocal(startDate),
      endTime: formatISOLocal(endDate),
    },
  }

  const allEvents: AttendanceEvent[] = []
  let position = 0
  const maxPages = 20 // safety limit

  for (let page = 0; page < maxPages; page++) {
    searchCondition.AcsEventCond.searchResultPosition = position

    const result = await hikvisionRequest(
      device,
      "POST",
      "/ISAPI/AccessControl/AcsEvent?format=json",
      searchCondition,
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
      if (!raw.employeeNoString || !raw.dateTime) continue

      const timestamp = new Date(raw.dateTime)
      if (isNaN(timestamp.getTime())) continue

      // Hikvision uses subEventType to indicate direction:
      //   75  = check-in,  76 = check-out (most models)
      //   currentVerifyMode "verifyMode" strings also carry direction
      let direction: AttendanceEvent["direction"] = "unknown"
      if (raw.subEventType === 75 || raw.currentVerifyMode === "entrance") {
        direction = "check-in"
      } else if (raw.subEventType === 76 || raw.currentVerifyMode === "exit") {
        direction = "check-out"
      }

      allEvents.push({
        employeeNo: raw.employeeNoString,
        timestamp,
        direction,
      })
    }

    const matched = acsEvent.numOfMatches ?? rawList.length
    const total = acsEvent.totalMatches ?? matched

    position += matched
    if (position >= total || rawList.length === 0) break
  }

  return { events: allEvents }
}
