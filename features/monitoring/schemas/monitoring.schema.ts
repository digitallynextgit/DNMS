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
  // http(s) only: a bare hostname would make the fetch probe throw instead of reporting down.
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

// .default() fields make zod's input and output types differ; react-hook-form needs both, or
// zodResolver is unassignable.
export type AssetFormInput = z.input<typeof assetSchema>
export type MonitorFormInput = z.input<typeof monitorSchema>
