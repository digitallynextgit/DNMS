import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3"
import { getSignedUrl as presignUrl } from "@aws-sdk/s3-request-presigner"
import { getConfig } from "@/server/app-config"

// Backblaze B2 is S3-compatible, so we use the AWS S3 SDK against the B2
// endpoint.
//
// CONFIG NOW COMES FROM storage_accounts, not from a single block in
// app_settings: the company can run several buckets and new uploads go to
// whichever row is marked default. Every function below takes an OPTIONAL
// accountId as its LAST argument, so all 18 existing call sites keep working
// unchanged and reach the default account.
//
// The app_settings B2_EMPLOYEE_DOCS_* keys remain a fallback. They are what a
// fresh install has before anybody opens Integrations, and dropping them would
// mean a deploy where file access breaks until somebody re-enters credentials.

interface ResolvedAccount {
  s3: S3Client
  bucket: string
  accountId: string | null
}

// One client per account, built once. Constructing an S3Client per request is
// pure overhead - it holds a connection pool.
const clientCache = new Map<string, ResolvedAccount>()

/** Clear a cached client after its credentials change. */
export function invalidateStorageClient(accountId?: string): void {
  if (accountId) clientCache.delete(accountId)
  else clientCache.clear()
}

function buildClient(
  cfg: { endpoint: string; region: string; bucket: string; keyId: string; appKey: string },
  accountId: string | null,
): ResolvedAccount {
  return {
    s3: new S3Client({
      region: cfg.region,
      endpoint: cfg.endpoint,
      forcePathStyle: true, // B2 S3 API uses path-style addressing
      credentials: { accessKeyId: cfg.keyId, secretAccessKey: cfg.appKey },
    }),
    bucket: cfg.bucket,
    accountId,
  }
}

async function getClient(accountId?: string): Promise<ResolvedAccount> {
  const cacheKey = accountId ?? "__default__"
  const hit = clientCache.get(cacheKey)
  if (hit) return hit

  const { db } = await import("@/server/db")
  const { tryDecrypt } = await import("@/lib/crypto")

  const account = accountId
    ? await db.storageAccount.findUnique({ where: { id: accountId } })
    : await db.storageAccount.findFirst({ where: { isDefault: true, isActive: true } })

  if (account) {
    const appKey = tryDecrypt(account.appKey)
    if (!appKey) {
      throw new Error(`Storage account "${account.label}" has an unreadable key - re-enter it`)
    }
    const resolved = buildClient(
      {
        endpoint: account.endpoint,
        region: account.region,
        bucket: account.bucket,
        keyId: account.keyId,
        appKey,
      },
      account.id,
    )
    clientCache.set(cacheKey, resolved)
    return resolved
  }

  // Legacy fallback: no accounts configured yet.
  const resolved = buildClient(
    {
      endpoint: (await getConfig("B2_EMPLOYEE_DOCS_ENDPOINT")) || "",
      region: (await getConfig("B2_EMPLOYEE_DOCS_REGION")) || "us-east-005",
      bucket: (await getConfig("B2_EMPLOYEE_DOCS_BUCKET")) || "hrms-documents",
      keyId: (await getConfig("B2_EMPLOYEE_DOCS_KEY_ID")) || "",
      appKey: (await getConfig("B2_EMPLOYEE_DOCS_APP_KEY")) || "",
    },
    null,
  )
  clientCache.set(cacheKey, resolved)
  return resolved
}

// B2 buckets are created in the B2 console, so there's nothing to do at runtime.
// Kept for API compatibility with existing callers.
export async function ensureBucket(): Promise<void> {}

/** Whether the B2 storage settings are fully configured (DB → env). */
export async function isB2Configured(): Promise<boolean> {
  // Wrapped: this is a CONFIG CHECK, and a database hiccup here should fall
  // through to the legacy settings rather than answering "not configured" and
  // blanking the whole storage screen behind it.
  try {
    const { db } = await import("@/server/db")
    if (await db.storageAccount.count({ where: { isActive: true } })) return true
  } catch (e) {
    console.error("[storage] account lookup failed, falling back to settings:", e)
  }

  const [endpoint, bucket, keyId, appKey] = await Promise.all([
    getConfig("B2_EMPLOYEE_DOCS_ENDPOINT"),
    getConfig("B2_EMPLOYEE_DOCS_BUCKET"),
    getConfig("B2_EMPLOYEE_DOCS_KEY_ID"),
    getConfig("B2_EMPLOYEE_DOCS_APP_KEY"),
  ])
  return Boolean(endpoint && bucket && keyId && appKey)
}

export async function uploadFile(
  objectKey: string,
  buffer: Buffer,
  contentType: string,
  _size?: number,
  accountId?: string,
): Promise<void> {
  const { s3, bucket } = await getClient(accountId)
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: buffer,
      ContentType: contentType,
    }),
  )
  // AFTER the write, not before: clearing first leaves a window where a read
  // could re-cache the pre-upload listing for the next minute.
  invalidateObjectList(accountId)
}

/** Download an object's raw bytes (server-side use only, e.g. text extraction
 *  for the AI assistant). */
export async function downloadFile(objectKey: string, accountId?: string): Promise<Buffer> {
  const { s3, bucket } = await getClient(accountId)
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }))
  const body = res.Body as unknown as { transformToByteArray?: () => Promise<Uint8Array> }
  if (body?.transformToByteArray) {
    return Buffer.from(await body.transformToByteArray())
  }
  // Fallback: stream to buffer.
  const chunks: Buffer[] = []
  for await (const chunk of res.Body as unknown as AsyncIterable<Buffer>) chunks.push(chunk)
  return Buffer.concat(chunks)
}

/**
 * `attachment; filename="…"; filename*=UTF-8''…`
 *
 * `filename` is a latin-1 header, so anything outside it - an accent, a
 * Devanagari character, an em dash - cannot travel in it and would arrive
 * mangled or truncate the header. Both forms are sent: the ASCII one is the
 * fallback, and every current browser prefers `filename*`.
 *
 * Quotes and CR/LF are stripped either way: a filename is user input, and a raw
 * newline here splits the header.
 */
/**
 * RFC 5987 ext-value encoding for the `filename*` parameter.
 *
 * `encodeURIComponent` leaves `( ) ' * ! . - _ ~` unescaped, but the RFC 5987
 * `attr-char` set does NOT include `( ) ' *`, and Backblaze B2 validates the
 * `b2-content-disposition` strictly - an unescaped `(` in a filename (e.g.
 * "photo (1).png") is exactly the "expected a token character … but got '('"
 * rejection on download. Percent-encode those four so the value is valid.
 */
function rfc5987(str: string): string {
  return encodeURIComponent(str).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  )
}

function contentDisposition(name: string): string {
  const clean = name.replace(/["\r\n]/g, "").trim() || "download"
  // The ASCII fallback is a quoted-string, but strip the few characters that are
  // unsafe even quoted; parens/spaces/commas are fine inside quotes. The
  // RFC 5987 `filename*` (which modern clients prefer) carries the exact name.
  const ascii = clean.replace(/[^\x20-\x7E]/g, "_").replace(/[\\"]/g, "_")
  return `attachment; filename="${ascii}"; filename*=UTF-8''${rfc5987(clean)}`
}

export async function getSignedUrl(
  objectKey: string,
  expirySeconds = 900,
  opts?: { downloadFileName?: string },
): Promise<string> {
  const { s3, bucket } = await getClient()
  // ResponseContentDisposition=attachment forces a download (and names the
  // file); omitting it lets images/PDFs open inline in the browser ("View").
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    ResponseContentDisposition: opts?.downloadFileName
      ? contentDisposition(opts.downloadFileName)
      : undefined,
  })
  // SigV4 presigned URLs cannot be valid for more than 7 days; clamp so callers
  // asking for longer don't trigger a hard rejection from the signer.
  const SEVEN_DAYS = 7 * 24 * 60 * 60
  return presignUrl(s3, command, { expiresIn: Math.min(expirySeconds, SEVEN_DAYS) })
}

// ── Shared signed-URL cache (perf) ───────────────────────────────────────────
// Every inline <img> in the gallery/chat hits a Next route that re-signs the
// object on each request. Signing is CPU-only, but doing it per image per user
// per page still adds up; memoising the plain (no-disposition) URL lets repeat
// and cross-user views skip the re-sign. NOT used for downloads - those carry a
// per-filename Content-Disposition and must not share a cache slot.
//
// The reuse window is the SIGNATURE life MINUS the browser cache window, not the
// full signature life: these routes 302 to the signed URL with a long
// Cache-Control max-age, so the browser remembers the redirect target. If we
// hand out a URL whose remaining life is shorter than that max-age, the viewer
// keeps redirecting to a dead URL and every hit 403s until their cache expires -
// for days. So a cached URL is only reused while it still outlives a full fresh
// browser cache window; callers pass that window (+ a buffer) as
// minRemainingSeconds. SigV4 caps signatures at 7 days, so the signature TTL
// cannot simply be raised to sidestep this - the two windows have to be paired.
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>()

export async function getCachedSignedUrl(
  objectKey: string,
  expirySeconds = 900,
  minRemainingSeconds = 60,
): Promise<string> {
  const hit = signedUrlCache.get(objectKey)
  if (hit && hit.expiresAt > Date.now() + minRemainingSeconds * 1000) return hit.url
  const url = await getSignedUrl(objectKey, expirySeconds)
  signedUrlCache.set(objectKey, { url, expiresAt: Date.now() + expirySeconds * 1000 })
  // Bound the map: signed URLs are cheap to regenerate, so evict oldest when large.
  if (signedUrlCache.size > 5_000) {
    const now = Date.now()
    for (const [k, v] of signedUrlCache) if (v.expiresAt <= now) signedUrlCache.delete(k)
  }
  return url
}

export async function deleteFile(objectKey: string, accountId?: string): Promise<void> {
  const { s3, bucket } = await getClient(accountId)
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }))
  invalidateObjectList(accountId)
}

export interface StorageObject {
  key: string
  size: number
  lastModified: string | null
}

// A bucket listing costs a round trip to B2 - measured at ~550ms warm and ~3.5s
// on a cold connection from here. The Storage screen calls it on every load, and
// a bucket does not change between two clicks, so the result is held briefly.
//
// Deliberately SHORT: this is a cache for one person clicking around, not a
// source of truth. A file uploaded elsewhere shows up within the minute, and any
// write path clears it outright (see invalidateObjectList).
const OBJECT_LIST_TTL_MS = 60_000
const objectListCache = new Map<string, { at: number; objects: StorageObject[] }>()

/** Drop the cached listing after an upload or delete, so the screen is honest. */
export function invalidateObjectList(accountId?: string): void {
  if (accountId) objectListCache.delete(accountId)
  else objectListCache.clear()
}

/** Every object in the bucket, paginated (B2 returns up to 1000 per page). */
export async function listAllObjects(accountId?: string): Promise<StorageObject[]> {
  const cacheKey = accountId ?? "__default__"
  const hit = objectListCache.get(cacheKey)
  if (hit && Date.now() - hit.at < OBJECT_LIST_TTL_MS) return hit.objects

  const { s3, bucket } = await getClient(accountId)
  const out: StorageObject[] = []
  let token: string | undefined
  do {
    const res = await s3.send(
      new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }),
    )
    for (const o of res.Contents ?? []) {
      if (o.Key) {
        out.push({
          key: o.Key,
          size: o.Size ?? 0,
          lastModified: o.LastModified ? o.LastModified.toISOString() : null,
        })
      }
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (token)
  objectListCache.set(cacheKey, { at: Date.now(), objects: out })
  return out
}

export function getObjectKey(prefix: string, originalFileName: string, id: string): string {
  const ext = originalFileName.split(".").pop()?.toLowerCase() || "bin"
  const sanitized = originalFileName
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-z0-9]/gi, "-")
    .toLowerCase()
    .substring(0, 40)
  return `${prefix}/${id}-${sanitized}.${ext}`
}
