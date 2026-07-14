/**
 * One-off backfill: re-encode every already-stored profile photo to the same
 * 512px WebP thumbnail that new uploads now produce.
 *
 * Photos uploaded before the resize-on-upload change are the full original file
 * (up to 5 MB) and get downloaded in full to paint a 32px avatar. This walks each
 * one, downscales it, re-uploads, repoints the employee, and deletes the old object.
 *
 * Run:  node --env-file=.env --import tsx scripts/resize-existing-photos.ts
 * Add --dry to report sizes without writing anything.
 */
import sharp from "sharp"
import { db } from "@/server/db"
import { uploadFile, deleteFile, getObjectKey, getSignedUrl } from "@/lib/storage"

const DRY = process.argv.includes("--dry")
const MAX_DIM = 512
const QUALITY = 80

const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`

async function main() {
  const employees = await db.employee.findMany({
    where: { profilePhotoKey: { not: null } },
    select: { id: true, firstName: true, lastName: true, profilePhotoKey: true },
  })
  console.log(`${employees.length} photo(s) to process${DRY ? " (dry run)" : ""}\n`)

  let before = 0
  let after = 0

  for (const emp of employees) {
    const oldKey = emp.profilePhotoKey!
    const name = `${emp.firstName} ${emp.lastName}`.trim()
    try {
      // Pull the current object down through a signed URL.
      const signed = await getSignedUrl(oldKey, 300)
      const res = await fetch(signed)
      if (!res.ok) {
        console.log(`  SKIP ${name}: fetch failed (${res.status})`)
        continue
      }
      const original = Buffer.from(await res.arrayBuffer())

      const resized = await sharp(original)
        .rotate()
        .resize(MAX_DIM, MAX_DIM, { fit: "cover", withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toBuffer()

      before += original.length
      after += resized.length
      const saved = (100 * (1 - resized.length / original.length)).toFixed(1)
      console.log(`  ${name}: ${kb(original.length)} -> ${kb(resized.length)}  (-${saved}%)`)

      if (DRY) continue
      if (resized.length >= original.length) {
        console.log(`     already small - leaving as is`)
        after += original.length - resized.length // keep the accounting honest
        continue
      }

      const newKey = getObjectKey(`profile-photos/${emp.id}`, "photo.webp", crypto.randomUUID())
      await uploadFile(newKey, resized, "image/webp")
      await db.employee.update({
        where: { id: emp.id },
        data: {
          profilePhotoKey: newKey,
          // Bump ?v= so any cached <img> picks the new object up.
          profilePhoto: `/api/employees/${emp.id}/photo?v=${Date.now()}`,
        },
      })
      await deleteFile(oldKey).catch((e) => console.error("     old-object delete failed:", e))
      console.log(`     repointed -> ${newKey}`)
    } catch (e) {
      console.error(`  FAIL ${name}:`, e)
    }
  }

  if (before) {
    console.log(
      `\nTotal: ${kb(before)} -> ${kb(after)} (-${(100 * (1 - after / before)).toFixed(1)}%)`,
    )
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => process.exit(0))
