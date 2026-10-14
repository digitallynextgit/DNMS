import "server-only"

import { createSign } from "node:crypto"
import { connect, type ClientHttp2Session } from "node:http2"
import { google } from "googleapis"
import { db } from "@/server/db"
import type { PushPayload } from "@/lib/web-push"

// -----------------------------------------------------------------------------
// Mobile push: FCM HTTP v1 (Android) + APNs (iOS), for the DNMS app.
//
// WHY THIS SITS BESIDE lib/web-push.ts INSTEAD OF REUSING IT. Web Push talks to
// a browser through a URL endpoint plus a VAPID key pair; a handset gives you an
// opaque device token and nothing else. /api/notifications/push refuses one on
// three separate counts - isKnownPushEndpoint() requires an https URL on a
// browser-vendor host, keys.p256dh/keys.auth are mandatory, and the `origin`
// column is read from a header a native client never sends. So device tokens get
// their own table (DeviceToken), their own route (/api/mobile/v1/devices) and
// this sender. The PAYLOAD is shared: PushPayload is imported from web-push so
// the two transports cannot drift, and the link default is the same "/dashboard".
//
// UNCONFIGURED IS A CLEAN NO-OP, NOT AN ERROR. FCM_SERVICE_ACCOUNT_JSON and the
// APNs key are UNSET in production today, and a notification must still be
// written, still reach the inbox and still reach Web Push while they are. So the
// config is read once, a missing one is reported ONCE, every send path is
// try/caught, and nothing in this file ever throws or rejects into the
// notification fan-out. That is ensureConfigured() in lib/web-push.ts, applied
// to two providers instead of one.
//
// PRUNING, AND WHAT IS DELIBERATELY NOT PRUNED. A token is disabled only on the
// two signals that unambiguously mean "this install is gone": FCM errorCode
// UNREGISTERED (and its bare 404) and APNs 410. The tempting extras - FCM
// INVALID_ARGUMENT / SENDER_ID_MISMATCH, APNs BadDeviceToken - also fire when
// the SERVER is misconfigured (wrong Firebase project, a sandbox key pointed at
// the production host), where pruning would wipe every token on that platform in
// a single fan-out and force every user to reinstall to get push back. Those are
// logged loudly and left alone. lib/web-push.ts makes the same bargain by
// pruning on 404/410 only.
//
// THE DE-DUPLICATION GUARANTEE (commit 3a97508) IS PRESERVED, NOT EXTENDED. A
// push endpoint cannot say which site registered it, so a dev server sharing the
// production database would send every notification twice; isPushDeliverable()
// fixes that by filtering on the recorded Origin header. It must keep applying
// to Web Push ONLY: a device token has no origin, so isPushDeliverable(null,
// prodOrigin) is false and running mobile tokens through it would drop every
// mobile push. The mobile equivalent is the credentials themselves - the FCM and
// APNs secrets live in exactly ONE deployment's environment, and a server
// without them is the no-op above. Copy production's env onto a second box and
// you WILL double-send; that is the known cost of a credential with no origin,
// and it is why these are env vars rather than app_settings rows.
// -----------------------------------------------------------------------------

const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging"

const APNS_PRODUCTION_HOST = "https://api.push.apple.com"
const APNS_SANDBOX_HOST = "https://api.sandbox.push.apple.com"

/** Apple caps a provider token at 1h and asks for at most one every 20 min. */
const APNS_JWT_TTL_MS = 45 * 60 * 1000

/**
 * How long a provider may hold an undelivered push. One hour on purpose: the
 * Notification row IS the record and the app polls its badge, so a push that
 * could not be delivered within the hour is noise by the time it lands.
 */
const PUSH_TTL_SECONDS = 3600

/** A silent handset must not hold a notification's fan-out open. */
const SEND_TIMEOUT_MS = 10_000

/**
 * Android 8+ drops a notification whose channel does not exist. The app creates
 * exactly this one at launch (dnmsApp src/features/push/device-token.ts:48), so
 * the id is a contract between the two codebases - changing it here silences
 * every Android push.
 */
const ANDROID_CHANNEL_ID = "default"

interface DeviceRow {
  id: string
  token: string
  platform: string
}

// -----------------------------------------------------------------------------
// Configuration. Read once; a missing or malformed value is reported once.
// -----------------------------------------------------------------------------

const warned = new Set<string>()

/** One line per distinct problem, for the whole process life - see the banner. */
function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return
  warned.add(key)
  console.warn(`[push-mobile] ${message}`)
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * The value as written, or base64-decoded. A service-account JSON and a .p8 key
 * both contain newlines, which a .env line cannot carry literally, so both forms
 * are accepted - base64 being the one that always survives a copy/paste.
 */
function decodeEnv(raw: string): string {
  const value = raw.trim()
  if (value.startsWith("{") || value.startsWith("-----")) return value
  try {
    return Buffer.from(value, "base64").toString("utf8")
  } catch {
    return value
  }
}

interface ServiceAccount {
  clientEmail: string
  privateKey: string
  projectId: string
}

function parseServiceAccount(raw: string): ServiceAccount | null {
  try {
    const j = JSON.parse(decodeEnv(raw)) as Record<string, unknown>
    const clientEmail = typeof j.client_email === "string" ? j.client_email : null
    const privateKey = typeof j.private_key === "string" ? j.private_key : null
    const projectId = typeof j.project_id === "string" ? j.project_id : null
    if (!clientEmail || !privateKey || !projectId) return null
    // A JSON-encoded key already carries real newlines; one pasted through a
    // shell may still hold the two characters \n, which breaks the PEM parser.
    return { clientEmail, privateKey: privateKey.replace(/\\n/g, "\n"), projectId }
  } catch {
    return null
  }
}

interface FcmSender {
  /**
   * googleapis is already a dependency and already mints service-account tokens
   * this way for GA4, GSC and Drive (lib/ga4.ts:63-67). It caches and refreshes
   * the OAuth token itself, so there is no token lifecycle in this file.
   */
  client: InstanceType<typeof google.auth.JWT>
  projectId: string
}

/** undefined = not read yet, null = not configured. Mirrors web-push's `configured`. */
let fcm: FcmSender | null | undefined

function fcmSender(): FcmSender | null {
  if (fcm !== undefined) return fcm
  fcm = buildFcmSender()
  return fcm
}

function buildFcmSender(): FcmSender | null {
  const raw = process.env.FCM_SERVICE_ACCOUNT_JSON
  if (!raw?.trim()) {
    warnOnce("fcm-unset", "FCM_SERVICE_ACCOUNT_JSON is not set - Android push is off")
    return null
  }
  const creds = parseServiceAccount(raw)
  if (!creds) {
    warnOnce(
      "fcm-invalid",
      "FCM_SERVICE_ACCOUNT_JSON is not a Firebase service-account JSON (needs " +
        "client_email, private_key and project_id; raw JSON or base64) - Android push is off",
    )
    return null
  }
  return {
    projectId: creds.projectId,
    client: new google.auth.JWT({
      email: creds.clientEmail,
      key: creds.privateKey,
      scopes: [FCM_SCOPE],
    }),
  }
}

interface ApnsSender {
  privateKey: string
  keyId: string
  teamId: string
  /** apns-topic: the iOS bundle id, which is not always the Android package name. */
  topic: string
  host: string
}

let apns: ApnsSender | null | undefined

function apnsSender(): ApnsSender | null {
  if (apns !== undefined) return apns
  apns = buildApnsSender()
  return apns
}

/**
 * Sandbox and production are different hosts AND different token spaces: a
 * development build's token is refused by the production host with 400
 * BadDeviceToken, and the reverse. The default follows NODE_ENV because that is
 * what a release build is paired with; APNS_ENVIRONMENT overrides it for the
 * case that actually needs it - a TestFlight build against a production server.
 */
function apnsHost(): string {
  const explicit = process.env.APNS_ENVIRONMENT?.trim().toLowerCase()
  if (explicit === "sandbox" || explicit === "development") return APNS_SANDBOX_HOST
  if (explicit === "production") return APNS_PRODUCTION_HOST
  return process.env.NODE_ENV === "production" ? APNS_PRODUCTION_HOST : APNS_SANDBOX_HOST
}

function buildApnsSender(): ApnsSender | null {
  const rawKey = process.env.APNS_KEY_P8
  const keyId = process.env.APNS_KEY_ID?.trim()
  const teamId = process.env.APNS_TEAM_ID?.trim()
  const topic = process.env.APNS_BUNDLE_ID?.trim()
  if (!rawKey?.trim() || !keyId || !teamId || !topic) {
    warnOnce(
      "apns-unset",
      "APNS_KEY_P8, APNS_KEY_ID, APNS_TEAM_ID and APNS_BUNDLE_ID are not all set - iOS push is off",
    )
    return null
  }
  const privateKey = decodeEnv(rawKey)
  if (!privateKey.includes("BEGIN PRIVATE KEY")) {
    warnOnce(
      "apns-invalid",
      "APNS_KEY_P8 is not a PKCS#8 PEM - paste the .p8 as-is or base64 it - iOS push is off",
    )
    return null
  }
  return { privateKey, keyId, teamId, topic, host: apnsHost() }
}

/** For /api/health and diagnostics, mirroring isPushConfigured(). */
export function isMobilePushConfigured(): boolean {
  return fcmSender() !== null || apnsSender() !== null
}

// -----------------------------------------------------------------------------
// Payload. One shape, two envelopes.
// -----------------------------------------------------------------------------

/**
 * FCM v1 flattens every data value to a string on the wire, so what the app
 * reads is a string on both platforms. The app narrows rather than trusting
 * types (dnmsApp src/features/push/push-payload.ts) and reads these four keys
 * FLAT - the nested-JSON shape it also tolerates is the Web Push body, not this.
 *
 * The "/dashboard" fallback is copied from lib/web-push.ts so a notification
 * deep-links to the same place whichever transport delivered it.
 */
function dataFor(payload: PushPayload): Record<string, string> {
  return {
    ...(payload.id ? { id: payload.id } : {}),
    title: payload.title,
    message: payload.message,
    link: payload.link ?? "/dashboard",
  }
}

function fcmMessage(token: string, payload: PushPayload): unknown {
  return {
    message: {
      token,
      // `notification` is what the OS draws with the app killed; `data` is what
      // the app reads to deep-link. Both, deliberately - a data-only message
      // shows nothing at all unless the app happens to be running.
      notification: { title: payload.title, body: payload.message },
      data: dataFor(payload),
      android: {
        priority: "HIGH",
        ttl: `${PUSH_TTL_SECONDS}s`,
        notification: { channel_id: ANDROID_CHANNEL_ID },
      },
    },
  }
}

function apnsPayload(payload: PushPayload): unknown {
  return {
    aps: {
      alert: { title: payload.title, body: payload.message },
      sound: "default",
      // No `badge`: the unread count lives behind its own endpoint and the app
      // polls it. Guessing a number here would paint a wrong one on the icon.
    },
    // Everything outside `aps` arrives as the notification's data map.
    ...dataFor(payload),
  }
}

// -----------------------------------------------------------------------------
// FCM HTTP v1
// -----------------------------------------------------------------------------

/** The failure's error code, from the FcmError detail or the bare status. */
function fcmErrorCode(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as {
      error?: { status?: string; details?: Array<{ errorCode?: string }> }
    }
    const detail = parsed.error?.details?.find((d) => typeof d.errorCode === "string")
    return detail?.errorCode ?? parsed.error?.status ?? null
  } catch {
    return null
  }
}

/** Returns the DeviceToken ids FCM reported as permanently gone. */
async function sendViaFcm(
  cfg: FcmSender,
  rows: DeviceRow[],
  payload: PushPayload,
): Promise<string[]> {
  let minted: string | null | undefined
  try {
    minted = (await cfg.client.getAccessToken()).token
  } catch (err) {
    warnOnce("fcm-auth", `could not mint an FCM access token: ${describe(err)}`)
    return []
  }
  if (!minted) {
    warnOnce("fcm-auth", "FCM returned no access token for the service account")
    return []
  }
  // A const, so the closures below cannot read a widened `string | null`
  // and quietly send the header "Bearer null".
  const accessToken = minted

  const url = `https://fcm.googleapis.com/v1/projects/${cfg.projectId}/messages:send`
  const dead: string[] = []
  await Promise.all(
    rows.map(async (row) => {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            authorization: `Bearer ${accessToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(fcmMessage(row.token, payload)),
          signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
        })
        if (res.ok) return
        const body = await res.text().catch(() => "")
        const code = fcmErrorCode(body)
        // UNREGISTERED (404) is the app uninstalled or the token rotated.
        // Everything else - SENDER_ID_MISMATCH and INVALID_ARGUMENT included -
        // may be OUR misconfiguration, so it is loud and keeps the row.
        if (code === "UNREGISTERED" || res.status === 404) {
          dead.push(row.id)
          return
        }
        console.error(`[push-mobile] FCM ${res.status} ${code ?? ""}: ${body.slice(0, 300)}`)
      } catch (err) {
        console.error("[push-mobile] FCM send failed:", describe(err))
      }
    }),
  )
  return dead
}

// -----------------------------------------------------------------------------
// APNs
//
// Over node:http2, because APNs is HTTP/2-only and fetch() (undici) speaks 1.1.
// Still no new dependency: the provider JWT is ES256 signed with node:crypto,
// the same reason the token design avoids `jose` everywhere else.
// -----------------------------------------------------------------------------

let apnsJwt: { token: string; mintedAt: number } | null = null

function b64url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url")
}

function apnsBearer(cfg: ApnsSender): string | null {
  const now = Date.now()
  if (apnsJwt && now - apnsJwt.mintedAt < APNS_JWT_TTL_MS) return apnsJwt.token
  try {
    const header = b64url(JSON.stringify({ alg: "ES256", kid: cfg.keyId }))
    const claims = b64url(JSON.stringify({ iss: cfg.teamId, iat: Math.floor(now / 1000) }))
    // ieee-p1363 is the raw r||s pair a JWS needs; node's DEFAULT is DER, which
    // Apple rejects with 403 InvalidProviderToken. This one option is the whole
    // difference between a working sender and an afternoon of debugging.
    const signature = createSign("sha256")
      .update(`${header}.${claims}`)
      .sign({ key: cfg.privateKey, dsaEncoding: "ieee-p1363" }, "base64url")
    apnsJwt = { token: `${header}.${claims}.${signature}`, mintedAt: now }
    return apnsJwt.token
  } catch (err) {
    warnOnce("apns-jwt", `could not sign an APNs provider token: ${describe(err)}`)
    return null
  }
}

/** Never rejects: a push failure must not become an unhandled rejection. */
function apnsSend(
  session: ClientHttp2Session,
  cfg: ApnsSender,
  bearer: string,
  row: DeviceRow,
  body: string,
): Promise<{ id: string; dead: boolean }> {
  return new Promise((resolve) => {
    const settle = (dead: boolean) => resolve({ id: row.id, dead })
    let stream
    try {
      stream = session.request({
        ":method": "POST",
        ":path": `/3/device/${encodeURIComponent(row.token)}`,
        authorization: `bearer ${bearer}`,
        "apns-topic": cfg.topic,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "apns-expiration": String(Math.floor(Date.now() / 1000) + PUSH_TTL_SECONDS),
        "content-type": "application/json",
      })
    } catch (err) {
      console.error("[push-mobile] APNs request could not be opened:", describe(err))
      settle(false)
      return
    }

    let status = 0
    let text = ""
    stream.setEncoding("utf8")
    stream.setTimeout(SEND_TIMEOUT_MS, () => {
      console.error(`[push-mobile] APNs timed out after ${SEND_TIMEOUT_MS}ms`)
      stream.close()
      settle(false)
    })
    stream.on("response", (headers) => {
      status = Number(headers[":status"] ?? 0)
    })
    stream.on("data", (chunk: string) => {
      text += chunk
    })
    stream.on("error", (err) => {
      console.error("[push-mobile] APNs stream failed:", describe(err))
      settle(false)
    })
    stream.on("end", () => {
      if (status === 200) return settle(false)
      // 410 Unregistered is Apple saying the app is gone from this device - the
      // one APNs status safe to prune on. 400 BadDeviceToken is NOT: it is also
      // what a sandbox/production mismatch looks like. See the banner.
      if (status === 410) return settle(true)
      console.error(`[push-mobile] APNs ${status}: ${text.slice(0, 300)}`)
      settle(false)
    })
    stream.end(body)
  })
}

async function sendViaApns(
  cfg: ApnsSender,
  rows: DeviceRow[],
  payload: PushPayload,
): Promise<string[]> {
  const bearer = apnsBearer(cfg)
  if (!bearer) return []

  // One session per fan-out rather than a cached one. Apple prefers a long-lived
  // connection, but a module-level session must be re-created on every close,
  // unref'd so it cannot hold the process open, and re-armed with an "error"
  // listener each time - and an http2 session whose listener is missed throws at
  // the PROCESS, not at the caller. At this volume the handshake is the cheaper
  // risk; revisit only with a measurement.
  let session: ClientHttp2Session
  try {
    session = connect(cfg.host)
  } catch (err) {
    console.error("[push-mobile] APNs connection failed:", describe(err))
    return []
  }
  session.on("error", (err) => {
    console.error("[push-mobile] APNs session failed:", describe(err))
  })

  const body = JSON.stringify(apnsPayload(payload))
  try {
    const results = await Promise.all(rows.map((row) => apnsSend(session, cfg, bearer, row, body)))
    return results.filter((r) => r.dead).map((r) => r.id)
  } finally {
    try {
      session.close()
    } catch {
      // Already gone - nothing to close.
    }
  }
}

// -----------------------------------------------------------------------------
// The one entry point the notification fan-out calls
// -----------------------------------------------------------------------------

/**
 * Stop pushing to tokens the provider has declared dead. disabledAt rather than
 * a delete, per the column's own comment: the row is the only record that this
 * handset ever had push, and re-registering the same token revives it (the
 * upsert in app/api/mobile/v1/devices clears disabledAt).
 */
async function disableTokens(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  await db.deviceToken
    .updateMany({ where: { id: { in: ids } }, data: { disabledAt: new Date() } })
    .catch((err) => console.error("[push-mobile] could not disable dead tokens:", describe(err)))
}

/**
 * Fire-and-forget, the mobile half of sendPushToEmployee(). Never throws and
 * never rejects - it is called from the notification fan-out, where a push
 * failure must not cost the caller its notification row.
 */
export async function sendMobilePushToEmployee(
  employeeId: string,
  payload: PushPayload,
): Promise<void> {
  try {
    const fcmCfg = fcmSender()
    const apnsCfg = apnsSender()
    // Neither provider configured: the no-op the banner promises. Returning
    // BEFORE the query keeps an unconfigured server from paying for one.
    if (!fcmCfg && !apnsCfg) return

    // Tenant-scoped, inheriting the notification's own tenant context exactly as
    // the Web Push read does (lib/web-push.ts:57-60). Unlike mobile_tokens there
    // is nothing to resolve here - the employee already decided the company.
    const rows = await db.deviceToken.findMany({
      where: { employeeId, disabledAt: null },
      select: { id: true, token: true, platform: true },
    })
    if (rows.length === 0) return

    // A platform this sender does not know gets no push rather than a guess -
    // which is why /api/mobile/v1/devices refuses anything but ios and android.
    const jobs: Array<Promise<string[]>> = []
    const android = rows.filter((r) => r.platform === "android")
    const ios = rows.filter((r) => r.platform === "ios")
    if (fcmCfg && android.length > 0) jobs.push(sendViaFcm(fcmCfg, android, payload))
    if (apnsCfg && ios.length > 0) jobs.push(sendViaApns(apnsCfg, ios, payload))
    if (jobs.length === 0) return

    await disableTokens((await Promise.all(jobs)).flat())
  } catch (err) {
    console.error("[push-mobile] send failed:", describe(err))
  }
}
