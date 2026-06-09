import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "hrms-documents"

export async function ensureBucket(): Promise<void> {
  try {
    const { data } = await supabase.storage.getBucket(BUCKET)
    if (data) return
    const { error } = await supabase.storage.createBucket(BUCKET, { public: false })
    if (error && !error.message?.toLowerCase().includes("already exists")) {
      console.error("[STORAGE] Failed to create bucket:", error.message)
    }
  } catch (error) {
    console.error("[STORAGE] ensureBucket error:", error)
  }
}

export async function uploadFile(
  objectKey: string,
  buffer: Buffer,
  contentType: string,
  _size: number,
): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(objectKey, buffer, { contentType, upsert: true })
  if (error) throw new Error(`Storage upload failed: ${error.message}`)
}

export async function getSignedUrl(objectKey: string, expirySeconds = 900): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(objectKey, expirySeconds)
  if (error || !data?.signedUrl) throw new Error(`Failed to get signed URL: ${error?.message}`)
  return data.signedUrl
}

export async function deleteFile(objectKey: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([objectKey])
  if (error) throw new Error(`Storage delete failed: ${error.message}`)
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
