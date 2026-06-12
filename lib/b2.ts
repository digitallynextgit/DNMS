import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl as presign } from "@aws-sdk/s3-request-presigner"

// ---------------------------------------------------------------------------
// Backblaze B2 storage via its S3-compatible API. Files are private; reads are
// served through short-lived presigned URLs.
//
// Required env vars (from a Backblaze B2 application key + bucket):
//   B2_EMPLOYEE_DOCS_ENDPOINT   – e.g. https://s3.us-west-004.backblazeb2.com
//   B2_EMPLOYEE_DOCS_REGION     – e.g. us-west-004 (the region in the endpoint)
//   B2_EMPLOYEE_DOCS_BUCKET     – your bucket name
//   B2_EMPLOYEE_DOCS_KEY_ID     – application keyID
//   B2_EMPLOYEE_DOCS_APP_KEY    – application key (secret)
// ---------------------------------------------------------------------------

export function isB2Configured(): boolean {
  return Boolean(
    process.env.B2_EMPLOYEE_DOCS_ENDPOINT &&
    process.env.B2_EMPLOYEE_DOCS_REGION &&
    process.env.B2_EMPLOYEE_DOCS_BUCKET &&
    process.env.B2_EMPLOYEE_DOCS_KEY_ID &&
    process.env.B2_EMPLOYEE_DOCS_APP_KEY,
  )
}

function bucket(): string {
  const b = process.env.B2_EMPLOYEE_DOCS_BUCKET
  if (!b) throw new Error("B2_EMPLOYEE_DOCS_BUCKET is not set")
  return b
}

function getClient(): S3Client {
  const endpoint = process.env.B2_EMPLOYEE_DOCS_ENDPOINT
  const region = process.env.B2_EMPLOYEE_DOCS_REGION
  const accessKeyId = process.env.B2_EMPLOYEE_DOCS_KEY_ID
  const secretAccessKey = process.env.B2_EMPLOYEE_DOCS_APP_KEY
  if (!endpoint || !region || !accessKeyId || !secretAccessKey) {
    throw new Error("Backblaze B2 env vars are not configured")
  }
  return new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
  })
}

/** Upload bytes under a key. Overwrites if the key already exists. */
export async function uploadFile(
  objectKey: string,
  buffer: Buffer,
  contentType: string,
): Promise<void> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: objectKey,
      Body: buffer,
      ContentType: contentType,
    }),
  )
}

/** Delete an object. Safe to call if it's already gone. */
export async function deleteFile(objectKey: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({ Bucket: bucket(), Key: objectKey }))
}

/**
 * Short-lived presigned GET URL (B2/S3 cap is 7 days; default 1 hour).
 *
 * Pass `downloadFileName` to force the browser to download the file (sets
 * `response-content-disposition: attachment`) instead of rendering it inline.
 * Without it, images/PDFs open inline in a browser tab (the "View" behaviour).
 */
export async function getSignedUrl(
  objectKey: string,
  expirySeconds = 3600,
  opts?: { downloadFileName?: string },
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket(),
    Key: objectKey,
    ...(opts?.downloadFileName
      ? {
          // Strip quotes / CR-LF to keep the header well-formed and injection-safe.
          ResponseContentDisposition: `attachment; filename="${opts.downloadFileName.replace(/["\r\n]/g, "")}"`,
        }
      : {}),
  })
  return presign(getClient(), command, {
    expiresIn: Math.min(expirySeconds, 7 * 24 * 60 * 60),
  })
}

/** Build a stable, collision-free object key from a prefix + id + filename. */
export function getObjectKey(prefix: string, originalFileName: string, id: string): string {
  const ext = originalFileName.split(".").pop()?.toLowerCase() || "bin"
  const sanitized = originalFileName
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-z0-9]/gi, "-")
    .toLowerCase()
    .substring(0, 40)
  return `${prefix}/${id}-${sanitized}.${ext}`
}
