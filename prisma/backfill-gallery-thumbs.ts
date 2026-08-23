/**
 * Backfill gallery thumbnails for photos uploaded before thumb_key existed.
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx prisma/backfill-gallery-thumbs.ts
 *
 * The `react-server` condition makes the `server-only` guard a no-op so this
 * script can reuse lib/storage (which chains through a server-only module) from
 * plain Node/tsx. Without it the import throws before anything runs.
 *
 * For every image Photo with no thumbKey it downloads the master from B2, makes
 * a small WebP thumbnail (same 480px WebP the upload path now produces), uploads
 * it, and stamps thumbKey on the row. Idempotent (only touches rows still null),
 * safe to re-run, and continues past any single failure - a photo without a
 * thumb just keeps serving its master in the grid until the next run.
 *
 * Videos are skipped: they have no server-side thumbnail (no ffmpeg), and the
 * grid renders their first frame from the master via <video preload="metadata">.
 */
import "dotenv/config"
// Reuse the app's configured client (Prisma 7 driver adapter); a bare
// `new PrismaClient()` throws.
import { db as prisma } from "@/server/db"
import { isB2Configured, downloadFile, uploadFile, getObjectKey } from "@/lib/storage"
import { makeThumb } from "@/lib/image-resize"

async function main() {
  if (!(await isB2Configured())) {
    console.error("Backblaze B2 is not configured - aborting (nothing changed).")
    process.exit(1)
  }

  const rows = await prisma.photo.findMany({
    where: { thumbKey: null, contentType: { startsWith: "image/" } },
    select: { id: true, albumId: true, objectKey: true },
  })
  console.log(`${rows.length} image(s) need a thumbnail.`)

  let done = 0
  let failed = 0
  for (const p of rows) {
    try {
      const master = await downloadFile(p.objectKey)
      const thumb = await makeThumb(master)
      if (!thumb) {
        failed++
        console.warn(`  skip ${p.id}: thumbnail encode returned nothing`)
        continue
      }
      const thumbKey = getObjectKey(
        `gallery/${p.albumId}/thumbs`,
        `thumb.${thumb.ext}`,
        crypto.randomUUID(),
      )
      await uploadFile(thumbKey, thumb.bytes, thumb.contentType)
      await prisma.photo.update({ where: { id: p.id }, data: { thumbKey } })
      done++
      if (done % 20 === 0) console.log(`  ${done}/${rows.length}…`)
    } catch (e) {
      failed++
      console.error(`  failed ${p.id}:`, e instanceof Error ? e.message : e)
    }
  }

  console.log(`Done. ${done} thumbnail(s) created, ${failed} skipped/failed.`)
}

main()
  // Explicit exit: the pg Pool behind the adapter keeps the event loop alive.
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
