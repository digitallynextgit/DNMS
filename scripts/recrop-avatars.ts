// =============================================================================
// Re-crop specific avatars tighter, from their original source images.
//
// The generator occasionally decorates an image with a signature, sticker,
// social-media chrome or a picture frame, always at the edges. Cropping in
// removes them, and a tighter crop suits an avatar anyway. Cropping from the
// ORIGINAL rather than the shipped 512px file avoids compounding quality loss.
//
// Run with: npx tsx scripts/recrop-avatars.ts <manifest.json> <ids...> [--factor 0.72]
// =============================================================================

import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import sharp from "sharp"

const OUT_DIR = join(process.cwd(), "public", "avatars")
const SIZE = 512
const QUALITY = 82
/** Faces sit above centre, so bias the crop upward rather than dead-centre. */
const VERTICAL_BIAS = 0.42

async function main() {
  const [manifestPath, ...rest] = process.argv.slice(2)
  if (!manifestPath)
    throw new Error("usage: tsx scripts/recrop-avatars.ts <manifest.json> <ids...>")

  const factorIdx = rest.indexOf("--factor")
  const factor = factorIdx >= 0 ? Number(rest[factorIdx + 1]) : 0.72
  const ids = rest.filter((a, i) => !a.startsWith("--") && i !== factorIdx + 1)

  const manifest: Record<string, string> = JSON.parse(readFileSync(manifestPath, "utf8"))
  mkdirSync(OUT_DIR, { recursive: true })

  console.log(`Re-cropping ${ids.length} avatars at ${factor}x...`)

  for (const id of ids) {
    const url = manifest[id]
    if (!url) throw new Error(`${id}: not in manifest`)

    const res = await fetch(url)
    if (!res.ok) throw new Error(`${id}: HTTP ${res.status}`)
    const input = Buffer.from(await res.arrayBuffer())

    const meta = await sharp(input).metadata()
    const w = meta.width!
    const h = meta.height!
    const side = Math.round(Math.min(w, h) * factor)
    const left = Math.round((w - side) / 2)
    const top = Math.max(0, Math.min(h - side, Math.round(h * VERTICAL_BIAS - side / 2)))

    const out = await sharp(input)
      .extract({ left, top, width: side, height: side })
      .resize(SIZE, SIZE)
      .webp({ quality: QUALITY })
      .toBuffer()

    writeFileSync(join(OUT_DIR, `${id}.webp`), out)
    console.log(
      `  ${id}.webp  ${(out.length / 1024).toFixed(0)} KB  (crop ${side}px @ ${left},${top})`,
    )
  }
}

main().catch((e) => {
  console.error("Re-crop failed:", e)
  process.exit(1)
})
