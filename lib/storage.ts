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
// endpoint. Config resolves from the Integrations admin settings (DB) → env,
// using the B2_EMPLOYEE_DOCS_* keys.
async function getClient(): Promise<{ s3: S3Client; bucket: string }> {
  const endpoint = await getConfig("B2_EMPLOYEE_DOCS_ENDPOINT")
  const region = (await getConfig("B2_EMPLOYEE_DOCS_REGION")) || "us-east-005"
  const bucket = (await getConfig("B2_EMPLOYEE_DOCS_BUCKET")) || "hrms-documents"
  const accessKeyId = (await getConfig("B2_EMPLOYEE_DOCS_KEY_ID")) || ""
  const secretAccessKey = (await getConfig("B2_EMPLOYEE_DOCS_APP_KEY")) || ""

  const s3 = new S3Client({
    region,
    endpoint,
    forcePathStyle: true, // B2 S3 API uses path-style addressing
    credentials: { accessKeyId, secretAccessKey },
  })
  return { s3, bucket }
}

// B2 buckets are created in the B2 console, so there's nothing to do at runtime.
// Kept for API compatibility with existing callers.
export async function ensureBucket(): Promise<void> {}

/** Whether the B2 storage settings are fully configured (DB → env). */
export async function isB2Configured(): Promise<boolean> {
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
): Promise<void> {
  const { s3, bucket } = await getClient()
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: buffer,
      ContentType: contentType,
    }),
  )
}

/** Download an object's raw bytes (server-side use only, e.g. text extraction
 *  for the AI assistant). */
export async function downloadFile(objectKey: string): Promise<Buffer> {
  const { s3, bucket } = await getClient()
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

export async function getSignedUrl(
  objectKey: string,
  expirySeconds = 900,
  opts?: { downloadFileName?: string },
): Promise<string> {
  const { s3, bucket } = await getClient()
  // ResponseContentDisposition=attachment forces a download (and names the
  // file); omitting it lets images/PDFs open inline in the browser ("View").
  // Strip quotes + CR/LF from the filename to keep the header well-formed.
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    ResponseContentDisposition: opts?.downloadFileName
      ? `attachment; filename="${opts.downloadFileName.replace(/["\r\n]/g, "")}"`
      : undefined,
  })
  // SigV4 presigned URLs cannot be valid for more than 7 days; clamp so callers
  // asking for longer don't trigger a hard rejection from the signer.
  const SEVEN_DAYS = 7 * 24 * 60 * 60
  return presignUrl(s3, command, { expiresIn: Math.min(expirySeconds, SEVEN_DAYS) })
}

export async function deleteFile(objectKey: string): Promise<void> {
  const { s3, bucket } = await getClient()
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }))
}

export interface StorageObject {
  key: string
  size: number
  lastModified: string | null
}

/** Every object in the bucket, paginated (B2 returns up to 1000 per page). */
export async function listAllObjects(): Promise<StorageObject[]> {
  const { s3, bucket } = await getClient()
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
