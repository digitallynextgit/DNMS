import { config } from "dotenv"
config()
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

async function main() {
  const endpoint = process.env.B2_EMPLOYEE_DOCS_ENDPOINT
  const region = process.env.B2_EMPLOYEE_DOCS_REGION
  const bucket = process.env.B2_EMPLOYEE_DOCS_BUCKET
  const accessKeyId = process.env.B2_EMPLOYEE_DOCS_KEY_ID
  const secretAccessKey = process.env.B2_EMPLOYEE_DOCS_APP_KEY

  console.log("endpoint:", endpoint || "MISSING")
  console.log("region  :", region || "MISSING")
  console.log("bucket  :", bucket || "MISSING")
  console.log("key id  :", accessKeyId ? "set" : "MISSING")
  console.log("app key :", secretAccessKey ? "set" : "MISSING")
  if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("Missing B2_* env vars")
  }

  const s3 = new S3Client({ endpoint, region, credentials: { accessKeyId, secretAccessKey } })
  const key = `__b2-test/${Date.now()}-check.txt`

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: Buffer.from("hello from DNMS"),
      ContentType: "text/plain",
    }),
  )
  console.log("✓ uploaded:", key)

  const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: 300,
  })
  const res = await fetch(url)
  const body = await res.text()
  console.log("✓ presigned download:", res.status, JSON.stringify(body))

  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
  console.log("✓ deleted test object (cleanup done)")

  console.log("\n✅ ALL GOOD - Backblaze B2 is working.")
}

main().catch((e) => {
  console.error("\n✗ B2 test FAILED:", e?.message || e)
  process.exit(1)
})
