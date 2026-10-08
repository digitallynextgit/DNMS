import "server-only"

import { db } from "@/server/db"
import { slugify } from "@/lib/utils"

/**
 * "RUDIONE / LEOCYM" -> "rudione-leocym"; a collision gets "-2", "-3"…, an unusable name the code.
 * Set once at creation - a rename keeps the slug so shared links don't break.
 */
export async function generateProjectSlug(name: string, fallback: string): Promise<string> {
  const base = slugify(name) || slugify(fallback)
  const taken = await db.project.findMany({
    where: { OR: [{ slug: base }, { slug: { startsWith: `${base}-` } }] },
    select: { slug: true },
  })
  if (!taken.some((p) => p.slug === base)) return base

  const used = new Set(taken.map((p) => p.slug))
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`
    if (!used.has(candidate)) return candidate
  }
  // Codes are unique, so this can always be fallen back to.
  return slugify(fallback)
}
