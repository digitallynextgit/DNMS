import { z } from "zod"

// Shared validation for the SEO property routes (create + update).

/** Strip protocol/path/trailing slash so "https://blog.kyg.com/posts" stores as
 *  "blog.kyg.com" - the domain is what builds the sc-domain: property id. */
export const domainSchema = z
  .string()
  .trim()
  .min(3)
  .transform((v) =>
    v
      .replace(/^https?:\/\//i, "")
      .replace(/\/.*$/, "")
      .toLowerCase(),
  )
  .refine((v) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(v), "Enter a valid domain, e.g. blog.example.com")

/**
 * Normalise whatever someone typed into a property id Search Console actually
 * accepts. Google only recognises two forms, and rejects anything else:
 *   - "sc-domain:example.com"   (domain property, covers every subdomain)
 *   - "https://example.com/"    (URL-prefix property, trailing slash required)
 * A bare "example.com" is the natural thing to type and is silently invalid, so
 * treat it as a domain property rather than sending it through to a 404.
 */
export function normalizeGscProperty(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim()
  if (!v) return null
  if (v.toLowerCase().startsWith("sc-domain:")) {
    return `sc-domain:${v.slice(10).trim().toLowerCase()}`
  }
  if (/^https?:\/\//i.test(v)) {
    // URL-prefix properties are stored WITH a trailing slash by Google.
    return v.endsWith("/") ? v : `${v}/`
  }
  // Bare host (possibly with a path) -> domain property.
  const host = v.replace(/\/.*$/, "").toLowerCase().trim()
  return host ? `sc-domain:${host}` : null
}

export const listSchema = z
  .array(z.string().trim().min(1))
  .max(200)
  .transform((arr) => Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean))))

export const seoPropertySchema = z.object({
  label: z.string().trim().min(1).max(80),
  domain: domainSchema,
  // Normalised on the way in so an invalid property id can never be stored.
  siteUrl: z
    .string()
    .trim()
    .max(300)
    .optional()
    .nullable()
    .transform((v) => normalizeGscProperty(v)),
  gaPropertyId: z.string().trim().max(50).optional().nullable(),
  moneyKeywords: listSchema.optional(),
  competitors: listSchema.optional(),
  targetClicks: z.number().int().min(0).max(10_000_000).optional().nullable(),
  targetPosition: z.number().min(1).max(100).optional().nullable(),
  isActive: z.boolean().optional(),
  isPrimary: z.boolean().optional(),
})

export type SeoPropertyInput = z.infer<typeof seoPropertySchema>
