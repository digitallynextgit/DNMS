import "server-only"

import { NextRequest, NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { db } from "@/server/db"
import { recordPunch } from "@/features/attendance/server/sync"

// =============================================================================
// The punch terminal posts here, instead of DNMS going to fetch from it.
// =============================================================================
// The device sits on a private office LAN, so a hosted DNMS can never reach it -
// no discovery, no port forwarding and no static IP changes that. Turning the
// direction around is what actually solves it: the terminal makes an OUTBOUND
// HTTPS call, which every office network already allows, and attendance lands
// the moment somebody punches rather than whenever a human clicks Sync.
//
// Configured on the device under Event → HTTP Host Notification (ISAPI:
// /ISAPI/Event/notification/httpHosts). The pull sync still works and is still
// the way to backfill; this is the live path.
// =============================================================================

/** Access control. The pull sync asks the device for this major type only. */
const MAJOR_ACCESS_CONTROL = 5

/** Constant-time compare, so the secret cannot be guessed a character at a time. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * The device can authenticate with Basic auth, or nothing at all.
 *
 * Both are accepted, because the firmware caps the password at 16 characters and
 * some models drop the header entirely on retry - but one of them has to be
 * present. `?key=` in the URL is the fallback the device can always manage.
 */
function authorised(req: NextRequest, pathSecret?: string): boolean {
  const expected = process.env.ATTENDANCE_HOOK_SECRET
  // Unset means the hook is off. It must never default to open: this endpoint
  // writes attendance, and attendance is what people are paid on.
  if (!expected) return false

  const header = req.headers.get("authorization") ?? ""
  if (header.toLowerCase().startsWith("basic ")) {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8")
    const password = decoded.slice(decoded.indexOf(":") + 1)
    if (secretMatches(password, expected)) return true
  }

  const key = req.nextUrl.searchParams.get("key")
  if (key && secretMatches(key, expected)) return true

  // Last resort: the secret as a path segment. Some firmware refuses to store a
  // "?" in its URL field at all, which leaves nowhere else to put it.
  return !!pathSecret && secretMatches(pathSecret, expected)
}

interface AccessEvent {
  employeeNoString?: string
  majorEventType?: number
  subEventType?: number
  serialNo?: number
  name?: string
}

interface Notification {
  dateTime?: string
  eventType?: string
  macAddress?: string
  ipAddress?: string
  AccessControllerEvent?: AccessEvent
}

/**
 * Pull the JSON payload out of whatever the firmware decided to send.
 *
 * Depending on model and settings this arrives as bare JSON, as multipart with
 * the JSON in a part named `event_log`, or as XML. The first two are handled;
 * XML is reported rather than silently dropped, so a misconfigured device is
 * visible instead of looking like an empty attendance day.
 */
async function readNotification(req: NextRequest): Promise<Notification | null> {
  const type = req.headers.get("content-type") ?? ""

  if (type.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null)
    if (!form) return null
    for (const value of form.values()) {
      const text = typeof value === "string" ? value : await value.text().catch(() => "")
      if (!text.trim().startsWith("{")) continue
      try {
        return JSON.parse(text) as Notification
      } catch {
        /* try the next part */
      }
    }
    return null
  }

  const body = await req.text().catch(() => "")
  if (!body.trim().startsWith("{")) return null
  try {
    return JSON.parse(body) as Notification
  } catch {
    return null
  }
}

export async function handlePunchPush(
  req: NextRequest,
  pathSecret?: string,
): Promise<NextResponse> {
  if (!authorised(req, pathSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const payload = await readNotification(req)
  // The device also sends heartbeats and door/tamper events. They are not
  // failures, so they get a 200 - a 4xx makes some firmware back off and stop
  // sending anything at all.
  if (!payload) return NextResponse.json({ ok: true, ignored: "unreadable" })

  const event = payload.AccessControllerEvent
  if (!event) return NextResponse.json({ ok: true, ignored: "not an access event" })

  if (event.majorEventType !== MAJOR_ACCESS_CONTROL) {
    return NextResponse.json({ ok: true, ignored: "not an access control event" })
  }

  // Identity, NOT the sub-type, is what marks a real punch.
  //
  // This device emits a successful authentication under several minor codes -
  // 75, 104 and 38 all appear, carrying real names and a valid verify mode -
  // and which one you get depends on the reader path. Filtering on 75 alone
  // dropped 231 of 500 punches over a week here.
  //
  // Every event that names a person is an authentication that succeeded; door
  // sensors and unrecognised faces carry no employeeNoString at all. That is the
  // rule fetchAttendanceEvents() already uses, so pull and push now agree.
  const deviceNo = event.employeeNoString?.trim()
  if (!deviceNo) return NextResponse.json({ ok: true, ignored: "no employee id" })

  const punchAt = payload.dateTime ? new Date(payload.dateTime) : new Date()
  if (Number.isNaN(punchAt.getTime())) {
    return NextResponse.json({ ok: true, ignored: "bad timestamp" })
  }

  // Which terminal sent this. Matched on MAC where the payload carries one, so
  // the right device is credited even after its address has changed.
  const mac = payload.macAddress?.toLowerCase() ?? null
  const device =
    (mac ? await db.hikvisionDevice.findFirst({ where: { macAddress: mac } }) : null) ??
    (await db.hikvisionDevice.findFirst({ where: { isActive: true } }))
  if (!device) return NextResponse.json({ ok: true, ignored: "no device on record" })

  // Same matching rule the pull sync uses: the device id first, then the HR code.
  const employee = await db.employee.findFirst({
    where: { OR: [{ deviceId: deviceNo }, { employeeNo: deviceNo }] },
    select: { id: true },
  })
  if (!employee) {
    console.warn("[ATTENDANCE_HOOK] no employee for device id", deviceNo)
    return NextResponse.json({ ok: true, ignored: `unknown employee ${deviceNo}` })
  }

  try {
    const { day, result } = await recordPunch(employee.id, device.id, punchAt)
    await db.hikvisionDevice
      .update({ where: { id: device.id }, data: { lastSyncAt: new Date() } })
      .catch(() => {})
    return NextResponse.json({ ok: true, day, result })
  } catch (error) {
    console.error("[ATTENDANCE_HOOK]", error)
    // 500 so the device retries - a punch is worth another attempt.
    return NextResponse.json({ error: "Could not record punch" }, { status: 500 })
  }
}

/** Some firmware probes with GET before it will post. Answer it. */
export function handlePunchProbe(req: NextRequest, pathSecret?: string): NextResponse {
  if (!authorised(req, pathSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return NextResponse.json({ ok: true, listening: true })
}
