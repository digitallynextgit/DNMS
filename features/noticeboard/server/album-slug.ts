import "server-only"

import { db } from "@/server/db"
import { slugify } from "@/lib/utils"

/**
 * Build a unique URL slug for an album title.
 *
 * "Diwali 2026" -> "diwali-2026". A title that collides gets "-2", "-3"…
 * appended rather than failing the create, and a title with no usable
 * characters falls back to the id the caller passes.
 *
 * Mirrors generateProjectSlug deliberately - two different slug rules in one app
 * is how you end up with two different sets of broken links.
 */
export async function generateAlbumSlug(title: string, fallback: string): Promise<string> {
  const base = slugify(title)
  if (!base) return fallback

  const taken = await db.photoAlbum.findMany({
    where: { OR: [{ slug: base }, { slug: { startsWith: `${base}-` } }] },
    select: { slug: true },
  })
  if (!taken.some((a) => a.slug === base)) return base

  const used = new Set(taken.map((a) => a.slug))
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`
    if (!used.has(candidate)) return candidate
  }
  return fallback
}

/**
 * Turn whatever is in the URL into a real album id.
 *
 * Both forms keep working: links shared before slugs existed are uuids. Returns
 * null when nothing matches.
 *
 * EVERY caller that writes must go through this. A route that stores
 * `params.albumId` directly would happily write a slug into photos.album_id and
 * break the foreign key - the same trap the project routes hit.
 */
export async function resolveAlbumId(ref: string): Promise<string | null> {
  if (!ref) return null
  const album = await db.photoAlbum.findFirst({
    where: { OR: [{ id: ref }, { slug: ref }] },
    select: { id: true },
  })
  return album?.id ?? null
}
