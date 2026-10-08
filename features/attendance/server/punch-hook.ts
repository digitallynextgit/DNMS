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

// Live punch path: the device on the office LAN POSTs each event here (outbound HTTPS, set under
// Event > HTTP Host Notification). The pull sync remains the way to backfill.

/** Access control. The pull sync asks the device for this major type only. */
const MAJOR_ACCESS_CONTROL = 5

/** Constant-time compare, so the secret cannot be guessed a character at a time. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** Every place the device might put the secret - firmware varies (Basic password capped at 16
 *  chars, header dropped on retry, no "?" allowed in the URL), so all three are read. */
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

/** Which tenant is this terminal posting for? The secret both authenticates the device and
 *  identifies the company. Null means rejected - this endpoint writes, so it never falls open. */
async function resolveHookTenant(
  req: NextRequest,
  pathSecret?: string,
): Promise<TenantContext | null> {
  const presented = presentedSecrets(req, pathSecret)
  if (presented.length === 0) return null

  // Constant-time compare against each tenant's secret, rather than a DB equality lookup.
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

  // TRANSITIONAL: the platform-wide env secret maps to the founding tenant. Remove once the
  // Digitally Next office device has a per-tenant secret - removing it now stops its attendance.
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

/** Read one field from a Hikvision XML notification (flat, known shape - a regex is enough). */
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

/** Payload as JSON, XML, or multipart with either plus a face JPEG - firmware varies, so all are
 *  read (guessing wrong looks just like the device being offline). */
async function readNotification(req: NextRequest): Promise<Notification | null> {
  const type = req.headers.get("content-type") ?? ""

  if (type.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null)
    if (!form) return null
    for (const value of form.values()) {
      // File parts are the face JPEG; only text parts carry the event.
      if (typeof value !== "string") continue
      const parsed = readPayload(value)
      if (parsed) return parsed
    }
    return null
  }

  const body = await req.text().catch(() => "")
  return readPayload(body)
}

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
  // Writes land only in the tenant the secret identified.
  return runWithTenant(tenant, () => recordPushedPunch(req, tenant))
}

async function recordPushedPunch(req: NextRequest, tenant: TenantContext): Promise<NextResponse> {
  console.info(
    `[ATTENDANCE_HOOK] inbound for ${tenant.slug}`,
    req.headers.get("content-type") ?? "(no content-type)",
    req.headers.get("user-agent") ?? "",
  )

  const payload = await readNotification(req)
  // Heartbeats and door events get a 200 - a 4xx makes some firmware stop sending entirely.
  if (!payload) return NextResponse.json({ ok: true, ignored: "unreadable" })

  const event = payload.AccessControllerEvent
  if (!event) return NextResponse.json({ ok: true, ignored: "not an access event" })

  if (event.majorEventType !== MAJOR_ACCESS_CONTROL) {
    return NextResponse.json({ ok: true, ignored: "not an access control event" })
  }

  // A named person (employeeNoString) marks a real punch, not the minor code: this device reports
  // successful auth as 75, 104 or 38. Same rule as fetchAttendanceEvents().
  const deviceNo = event.employeeNoString?.trim()
  if (!deviceNo) return NextResponse.json({ ok: true, ignored: "no employee id" })

  const punchAt = payload.dateTime ? new Date(payload.dateTime) : new Date()
  if (Number.isNaN(punchAt.getTime())) {
    return NextResponse.json({ ok: true, ignored: "bad timestamp" })
  }

  // Matched on MAC where present, so the device is credited even after its IP changes.
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
    // lastPushAt is stamped only here (lastSyncAt is also written by the pull sync).
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
  // Echo the tenant so whoever configures the device can confirm the secret's company.
  return NextResponse.json({ ok: true, listening: true, workspace: tenant.slug })
}
