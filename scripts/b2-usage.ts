/**
 * Read-only B2 storage report: total usage, breakdown by folder, and a cross-check
 * against the database to find orphaned objects (in the bucket, referenced by no row).
 *
 * Run: node --conditions=react-server --import tsx scripts/b2-usage.ts
 */
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3"
import { getConfig } from "@/server/app-config"
import { db } from "@/server/db"

const fmt = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  const u = ["KB", "MB", "GB", "TB"]
  let n = bytes / 1024
  let i = 0
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(2)} ${u[i]}`
}

async function main() {
  const endpoint = await getConfig("B2_EMPLOYEE_DOCS_ENDPOINT")
  const region = (await getConfig("B2_EMPLOYEE_DOCS_REGION")) || "us-east-005"
  const bucket = (await getConfig("B2_EMPLOYEE_DOCS_BUCKET")) || "hrms-documents"
  const accessKeyId = (await getConfig("B2_EMPLOYEE_DOCS_KEY_ID")) || ""
  const secretAccessKey = (await getConfig("B2_EMPLOYEE_DOCS_APP_KEY")) || ""

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    console.log("B2 is not configured (missing endpoint / key). Nothing to report.")
    return
  }
  console.log(`Bucket: ${bucket}  @  ${endpoint}\n`)

  const s3 = new S3Client({
    region,
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  })

  // 1. Enumerate every object (paginated - B2 returns up to 1000 per page).
  const objects: { key: string; size: number; modified?: Date }[] = []
  let token: string | undefined
  do {
    const res = await s3.send(
      new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }),
    )
    for (const o of res.Contents ?? []) {
      if (o.Key) objects.push({ key: o.Key, size: o.Size ?? 0, modified: o.LastModified })
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (token)

  const total = objects.reduce((s, o) => s + o.size, 0)
  console.log(`TOTAL: ${objects.length} objects, ${fmt(total)}\n`)

  // 2. Breakdown by top-level folder.
  const byFolder = new Map<string, { count: number; size: number }>()
  for (const o of objects) {
    const folder = o.key.includes("/") ? o.key.split("/")[0] : "(root)"
    const cur = byFolder.get(folder) ?? { count: 0, size: 0 }
    cur.count++
    cur.size += o.size
    byFolder.set(folder, cur)
  }
  console.log("BY FOLDER:")
  for (const [folder, v] of [...byFolder].sort((a, b) => b[1].size - a[1].size)) {
    console.log(`  ${folder.padEnd(20)} ${String(v.count).padStart(4)} files   ${fmt(v.size)}`)
  }

  // 3. Every object key the DB references, so we can flag orphans.
  const [photos, docs, empDocs, brand, resources] = await Promise.all([
    db.employee.findMany({
      where: { profilePhotoKey: { not: null } },
      select: { profilePhotoKey: true },
    }),
    db.document.findMany({ select: { objectKey: true } }),
    db.employeeDocument.findMany({ select: { objectKey: true } }),
    db.brandAsset.findMany({ select: { objectKey: true } }),
    db.projectResource.findMany({ select: { objectKey: true } }),
  ])
  const referenced = new Set<string>(
    [
      ...photos.map((p) => p.profilePhotoKey),
      ...docs.map((d) => d.objectKey),
      ...empDocs.map((d) => d.objectKey),
      ...brand.map((b) => b.objectKey),
      ...resources.map((r) => r.objectKey),
    ].filter((k): k is string => !!k),
  )

  const orphans = objects.filter((o) => !referenced.has(o.key))
  const missing = [...referenced].filter((k) => !objects.some((o) => o.key === k))

  console.log(`\nDB references ${referenced.size} object(s).`)
  console.log(
    `ORPHANS (in bucket, no DB row): ${orphans.length} objects, ${fmt(
      orphans.reduce((s, o) => s + o.size, 0),
    )}`,
  )
  for (const o of orphans.slice(0, 40)) console.log(`   - ${o.key}  (${fmt(o.size)})`)
  if (orphans.length > 40) console.log(`   … and ${orphans.length - 40} more`)
  if (missing.length) {
    console.log(`\nMISSING (DB row points at a deleted object): ${missing.length}`)
    for (const k of missing.slice(0, 20)) console.log(`   - ${k}`)
  }

  // 4. Largest files.
  console.log("\nLARGEST FILES:")
  for (const o of [...objects].sort((a, b) => b.size - a.size).slice(0, 15)) {
    console.log(`  ${fmt(o.size).padStart(10)}   ${o.key}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => process.exit(0))
