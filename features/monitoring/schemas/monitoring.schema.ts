import { z } from "zod"

export const ASSET_KINDS = ["DOMAIN", "SSL", "HOSTING", "LICENSE", "OTHER"] as const

export const ASSET_KIND_LABELS: Record<(typeof ASSET_KINDS)[number], string> = {
  DOMAIN: "Domain",
  SSL: "SSL certificate",
  HOSTING: "Hosting / plan",
  LICENSE: "Licence",
  OTHER: "Other",
}

export const assetSchema = z.object({
  kind: z.enum(ASSET_KINDS),
  name: z.string().trim().min(2, "Name is required").max(160),
  provider: z.string().trim().max(80).optional().or(z.literal("")),
  url: z.string().trim().url("Enter a valid URL").optional().or(z.literal("")),
  /** yyyy-MM-dd */
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick an expiry date"),
  autoRenew: z.boolean().default(true),
  paymentMethod: z.string().trim().max(80).optional().or(z.literal("")),
  paymentExpiresAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  ownerId: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
})
export type AssetInput = z.infer<typeof assetSchema>

export const monitorSchema = z.object({
  // http(s) only: the probe uses fetch, and a bare hostname would throw rather
  // than report the site as down, which would look like a monitoring failure.
  url: z
    .string()
    .trim()
    .url("Enter a full URL including https://")
    .refine((u) => u.startsWith("http://") || u.startsWith("https://"), {
      message: "URL must start with http:// or https://",
    }),
  label: z.string().trim().max(80).optional().or(z.literal("")),
  ownerId: z.string().uuid().optional().or(z.literal("")),
  isActive: z.boolean().default(true),
})
export type MonitorInput = z.infer<typeof monitorSchema>

// `autoRenew` / `isActive` carry .default(), so zod's INPUT type (where they are
// optional) differs from its OUTPUT type (where they are guaranteed). react-hook-form
// needs the input type for its field values and the output type for what
// handleSubmit hands you - passing only one makes zodResolver unassignable.
export type AssetFormInput = z.input<typeof assetSchema>
export type MonitorFormInput = z.input<typeof monitorSchema>
