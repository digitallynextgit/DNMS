/**
 * Build public/favicon.ico from the brand mark.
 *
 *   npx tsx scripts/build-favicon.ts
 *
 * WHY THIS EXISTS
 * `public/favicon.ico` used to be a straight copy of `app/icon.png` with the
 * extension changed. A bare PNG is not an ICO: the format needs a 6-byte
 * ICONDIR plus one 16-byte directory entry per image before the pixel data.
 * Browsers were being handed `Content-Type: image/x-icon` for bytes that begin
 * `89 50 4E 47`, and were left to guess. Chrome usually guesses right; not
 * everything does, which is how you get a tab with no icon.
 *
 * The source is also 128x112 - not square - so anything that did render it got
 * a stretched or letterboxed mark. Each size below is composited onto a square
 * transparent canvas instead of being squashed.
 *
 * ICO entries may hold PNG data (supported since Windows Vista, and by every
 * browser in use), so the PNGs go in as-is rather than being re-encoded to BMP.
 */
import { writeFileSync } from "node:fs"
import { join } from "node:path"
import sharp from "sharp"

/**
 * The 2505x2200 master, for the sharpest possible downscale.
 *
 * NOT `public/brand-mark-72.png`: that one is square, which looks like the right
 * choice until you open it - it is a tight crop with the boot tips cut off.
 * NOT `app/icon.png` either: correct artwork, but only 128x112 to start with.
 *
 * The mark is ~1.14:1, so `fit: contain` centres it on a square transparent
 * canvas rather than squashing it to fit.
 */
const SOURCE = join(process.cwd(), "public", "brand-mark.png")
const OUT = join(process.cwd(), "public", "favicon.ico")

/** 16 is the tab, 32 is the bookmark bar and retina tab, 48 is Windows shortcuts. */
const SIZES = [16, 32, 48]

async function main() {
  const pngs: Buffer[] = []
  for (const size of SIZES) {
    pngs.push(
      await sharp(SOURCE)
        .resize(size, size, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png({ compressionLevel: 9 })
        .toBuffer(),
    )
  }

  // ICONDIR: reserved(2)=0, type(2)=1 (icon), count(2)
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(SIZES.length, 4)

  // One 16-byte ICONDIRENTRY per image, then the image data.
  const entries: Buffer[] = []
  let offset = 6 + SIZES.length * 16

  SIZES.forEach((size, i) => {
    const png = pngs[i]!
    const entry = Buffer.alloc(16)
    // 256 is stored as 0; every size here is smaller, but keep the rule honest.
    entry.writeUInt8(size >= 256 ? 0 : size, 0) // width
    entry.writeUInt8(size >= 256 ? 0 : size, 1) // height
    entry.writeUInt8(0, 2) // palette size - 0 for truecolour
    entry.writeUInt8(0, 3) // reserved
    entry.writeUInt16LE(1, 4) // colour planes
    entry.writeUInt16LE(32, 6) // bits per pixel
    entry.writeUInt32LE(png.length, 8) // bytes of image data
    entry.writeUInt32LE(offset, 12) // where it starts
    entries.push(entry)
    offset += png.length
  })

  const ico = Buffer.concat([header, ...entries, ...pngs])
  writeFileSync(OUT, ico)

  console.log(`wrote ${OUT}`)
  console.log(`  ${SIZES.length} sizes: ${SIZES.map((s) => `${s}x${s}`).join(", ")}`)
  console.log(`  ${ico.length} bytes`)
  console.log(
    `  magic: ${[...ico.subarray(0, 4)].map((b) => b.toString(16).padStart(2, "0")).join(" ")} (00 00 01 00 = a real ICO)`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
