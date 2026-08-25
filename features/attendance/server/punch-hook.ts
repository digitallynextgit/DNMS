import "server-only"

import { NextRequest, NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { db } from "@/server/db"
import {
  FOUNDING_TENANT_ID,
  FOUNDING_TENANT_SLUG,
  runUnscoped,
  runWithTenant,
  type TenantContext,
} from "@/server/tenant-context"
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
 * Every place the device might have put the secret.
 *
 * Three, because the firmware is inconsistent: it caps the Basic password at 16
 * characters, some models drop the Authorization header on retry, and some
 * refuse to store a "?" in the URL field at all - which leaves only a path
 * segment. All three are read; one of them has to match.
 */
function presentedSecrets(req: NextRequest, pathSecret?: string): string[] {
  const found: string[] = []

  const header = req.headers.get("authorization") ?? ""
  if (header.toLowerCase().startsWith("basic ")) {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8")
    found.push(decoded.slice(decoded.indexOf(":") + 1))
  }

  const key = req.nextUrl.searchParams.get("key")
  if (key) found.push(key)
  if (pathSecret) found.push(pathSecret)

  return found.filter(Boolean)
}

/**
 * WHICH TENANT is this terminal posting for? (M4)
 *
 * The secret does double duty: it authenticates the device AND identifies the
 * company, because the device has no session and nothing else to go on. Before
 * M4 there was one secret for the whole platform, which meant any customer's
 * door reader could write punches into any other customer's attendance - and
 * attendance is what payroll is computed from.
 *
 * Returns the tenant, or null when nothing matches. Null must mean rejected:
 * this endpoint WRITES, so it can never fall open.
 */
async function resolveHookTenant(
  req: NextRequest,
  pathSecret?: string,
): Promise<TenantContext | null> {
  const presented = presentedSecrets(req, pathSecret)
  if (presented.length === 0) return null

  // Per-tenant secrets first. Compared in constant time against each configured
  // tenant rather than looked up by equality, so the database's index cannot
  // leak which prefix was close.
  const configured = await runUnscoped("device hook: the secret identifies the tenant", () =>
    db.tenant.findMany({
      where: { hookSecret: { not: null }, status: "ACTIVE" },
      select: { id: true, slug: true, hookSecret: true },
    }),
  )
  for (const tenant of configured) {
    for (const candidate of presented) {
      if (secretMatches(candidate, tenant.hookSecret as string)) {
        return { tenantId: tenant.id, slug: tenant.slug }
      }
    }
  }

  // TRANSITIONAL: the platform-wide environment secret, which resolves to the
  // founding tenant. This is what the terminal already installed in the
  // Digitally Next office uses. Remove it once that device has been moved onto a
  // per-tenant secret; until then, removing it would silently stop attendance.
  const envSecret = process.env.ATTENDANCE_HOOK_SECRET
  // Unset means the hook is off. It must never default to open.
  if (!envSecret) return null
  for (const candidate of presented) {
    if (secretMatches(candidate, envSecret)) {
      return { tenantId: FOUNDING_TENANT_ID, slug: FOUNDING_TENANT_SLUG }
    }
  }
  return null
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
 * Read one field out of a Hikvision XML notification.
 *
 * A regex rather than an XML parser, matching how the ISAPI responses are read
 * elsewhere in this feature: the payload is a flat, known shape and pulling four
 * fields out of it does not justify a dependency.
 */
function xmlField(body: string, tag: string): string | undefined {
  return new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(body)?.[1]?.trim() || undefined
}

/** Turn a Hikvision XML notification into the same shape the JSON one has. */
function fromXml(body: string): Notification | null {
  if (!/<EventNotificationAlert|<AccessControllerEvent/.test(body)) return null
  const major = Number(xmlField(body, "majorEventType"))
  const minor = Number(xmlField(body, "subEventType"))
  return {
    dateTime: xmlField(body, "dateTime"),
    eventType: xmlField(body, "eventType"),
    macAddress: xmlField(body, "macAddress"),
    AccessControllerEvent: {
      employeeNoString: xmlField(body, "employeeNoString"),
      majorEventType: Number.isFinite(major) ? major : undefined,
      subEventType: Number.isFinite(minor) ? minor : undefined,
      name: xmlField(body, "name"),
    },
  }
}

/**
 * Pull the payload out of whatever the firmware decided to send.
 *
 * There is no single answer here: depending on model and settings it arrives as
 * bare JSON, as XML, or as multipart carrying either one alongside a JPEG of the
 * face. This device has `parameterFormatType` empty and `pictureURLType`
 * binary, so multipart-with-XML is the likely shape - but all of them are read,
 * because guessing wrong looks identical to the device being offline.
 */
async function readNotification(req: NextRequest): Promise<Notification | null> {
  const type = req.headers.get("content-type") ?? ""

  if (type.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null)
    if (!form) return null
    for (const value of form.values()) {
      // A File part here is the face JPEG, not the event; only text parts can
      // carry the payload, and reading the image would just waste memory.
      if (typeof value !== "string") continue
      const parsed = readPayload(value)
      if (parsed) return parsed
    }
    return null
  }

  const body = await req.text().catch(() => "")
  return readPayload(body)
}

/** JSON or XML, whichever this turns out to be. */
function readPayload(text: string): Notification | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  if (trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed) as Notification
    } catch {
      return null
    }
  }
  if (trimmed.startsWith("<")) return fromXml(trimmed)
  return null
}

export async function handlePunchPush(
  req: NextRequest,
  pathSecret?: string,
): Promise<NextResponse> {
  const tenant = await resolveHookTenant(req, pathSecret)
  if (!tenant) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  // Everything below writes attendance, so it runs inside the tenant the secret
  // identified - the punch lands in that company's records and nowhere else.
  return runWithTenant(tenant, () => recordPushedPunch(req, tenant))
}

async function recordPushedPunch(req: NextRequest, tenant: TenantContext): Promise<NextResponse> {
  console.info(
    `[ATTENDANCE_HOOK] inbound for ${tenant.slug}`,
    req.headers.get("content-type") ?? "(no content-type)",
    req.headers.get("user-agent") ?? "",
  )

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
    // lastPushAt is stamped ONLY here. lastSyncAt is written by the pull sync
    // too, so it cannot tell the Devices page whether the live path is working
    // or whether a cron is merely polling on a timer.
    const now = new Date()
    await db.hikvisionDevice
      .update({ where: { id: device.id }, data: { lastSyncAt: now, lastPushAt: now } })
      .catch(() => {})
    return NextResponse.json({ ok: true, day, result })
  } catch (error) {
    console.error("[ATTENDANCE_HOOK]", error)
    // 500 so the device retries - a punch is worth another attempt.
    return NextResponse.json({ error: "Could not record punch" }, { status: 500 })
  }
}

/** Some firmware probes with GET before it will post. Answer it. */
export async function handlePunchProbe(
  req: NextRequest,
  pathSecret?: string,
): Promise<NextResponse> {
  const tenant = await resolveHookTenant(req, pathSecret)
  if (!tenant) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  // Naming the tenant back confirms to whoever is configuring the device that
  // the secret they typed belongs to the company they think it does.
  return NextResponse.json({ ok: true, listening: true, workspace: tenant.slug })
}
