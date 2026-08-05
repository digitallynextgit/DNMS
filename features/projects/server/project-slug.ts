import "server-only"

import { db } from "@/server/db"
import { slugify } from "@/lib/utils"

/**
 * Build a unique URL slug for a project name.
 *
 * "RUDIONE / LEOCYM" -> "rudione-leocym". A name that collides with an existing
 * project gets "-2", "-3"… appended rather than failing the create, and a name
 * with no usable characters at all falls back to the caller's code.
 *
 * Slugs are generated ONCE, at creation. Renaming a project deliberately leaves
 * the slug alone: a URL that moves silently breaks every link already shared.
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
