import "server-only"

import { db } from "@/server/db"
import { slugify } from "@/lib/utils"

/** Unique slug for an album title ("Diwali 2026" -> "diwali-2026", "-2"... on collision,
 *  `fallback` when nothing usable). Same rule as generateProjectSlug. */
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

/** Resolve a slug or legacy uuid to an album id (null if none). Every writing route must use it -
 *  storing a raw slug in photos.album_id breaks the foreign key. */
export async function resolveAlbumId(ref: string): Promise<string | null> {
  if (!ref) return null
  const album = await db.photoAlbum.findFirst({
    where: { OR: [{ id: ref }, { slug: ref }] },
    select: { id: true },
  })
  return album?.id ?? null
}
