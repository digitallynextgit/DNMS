// =============================================================================
// Download the generated avatar portraits into public/avatars/.
//
// The generator (Higgsfield soul_2) returns 1536px PNGs at ~3 MB each. Avatars
// render between 16px and 96px, so what we ship is a 512px WebP - the bytes we
// keep are the bytes every viewer downloads, and a directory page paints dozens
// at once.
//
// Input is a manifest mapping avatar id -> image URL:
//   { "av-web-01": "https://.../foo.png", ... }
//
// Run with: npx tsx scripts/fetch-avatars.ts <manifest.json>
// =============================================================================

import { mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync, statSync } from "node:fs"
import { join } from "node:path"
import sharp from "sharp"

const OUT_DIR = join(process.cwd(), "public", "avatars")
const SIZE = 512
const QUALITY = 82

async function main() {
  const manifestPath = process.argv[2]
  if (!manifestPath) throw new Error("usage: tsx scripts/fetch-avatars.ts <manifest.json>")

  const manifest: Record<string, string> = JSON.parse(readFileSync(manifestPath, "utf8"))
  const ids = Object.keys(manifest)
  mkdirSync(OUT_DIR, { recursive: true })

  console.log(`Fetching ${ids.length} avatars...`)
  let bytes = 0

  for (const id of ids) {
    const res = await fetch(manifest[id]!)
    if (!res.ok) throw new Error(`${id}: HTTP ${res.status}`)
    const input = Buffer.from(await res.arrayBuffer())

    const out = await sharp(input)
      .resize(SIZE, SIZE, { fit: "cover", position: "attention" })
      .webp({ quality: QUALITY })
      .toBuffer()

    writeFileSync(join(OUT_DIR, `${id}.webp`), out)
    bytes += out.length
    console.log(`  ${id}.webp  ${(out.length / 1024).toFixed(0)} KB`)
  }

  // The vector placeholders these replace are no longer referenced.
  let removed = 0
  for (const f of readdirSync(OUT_DIR)) {
    if (/^av-.*\.svg$/.test(f)) {
      unlinkSync(join(OUT_DIR, f))
      removed++
    }
  }

  const total = readdirSync(OUT_DIR)
    .filter((f) => f.endsWith(".webp"))
    .reduce((sum, f) => sum + statSync(join(OUT_DIR, f)).size, 0)

  console.log(`\n  ${ids.length} written, ${removed} old SVGs removed`)
  console.log(
    `  average ${(bytes / ids.length / 1024).toFixed(0)} KB, total ${(total / 1024 / 1024).toFixed(2)} MB`,
  )
}

main().catch((e) => {
  console.error("Fetch failed:", e)
  process.exit(1)
})
