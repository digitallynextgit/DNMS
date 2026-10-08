import { z } from "zod"

/** "https://blog.kyg.com/posts" -> "blog.kyg.com"; the domain builds the sc-domain: property id. */
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
 * Normalise input to a property id Search Console accepts: "sc-domain:example.com" or
 * "https://example.com/". A bare host becomes a domain property.
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
  moneyPages: listSchema.optional(),
  competitors: listSchema.optional(),
  targetClicks: z.number().int().min(0).max(10_000_000).optional().nullable(),
  targetPosition: z.number().min(1).max(100).optional().nullable(),
  isActive: z.boolean().optional(),
  isPrimary: z.boolean().optional(),
})

export type SeoPropertyInput = z.infer<typeof seoPropertySchema>
