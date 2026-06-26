import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
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
      ? `attachment; filename="${opts.downloadFileName.replace(/"/g, "")}"`
      : undefined,
  })
  return presignUrl(s3, command, { expiresIn: expirySeconds })
}

export async function deleteFile(objectKey: string): Promise<void> {
  const { s3, bucket } = await getClient()
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }))
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
