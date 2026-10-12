import { z } from "zod"

import { AI_KIND_IDS, splitModels } from "@/lib/ai-providers"

const models = z
  .string()
  .trim()
  .max(500)
  .refine((v) => splitModels(v).length > 0, "Add at least one model")

/** Cloudflare's dashboard shows it as 32 hex characters. */
const accountId = z
  .string()
  .trim()
  .regex(
    /^[0-9a-f]{32}$/i,
    "The Account ID is 32 letters and numbers, from the Cloudflare dashboard",
  )

const httpsUrl = z
  .string()
  .trim()
  .url("Enter the full URL, starting with https://")
  .refine((v) => v.startsWith("https://"), "The URL must start with https://")

export const aiProviderCreateSchema = z
  .object({
    kind: z.enum(AI_KIND_IDS),
    label: z.string().trim().min(2, "Give it a name").max(60),
    baseUrl: httpsUrl.nullish(),
    accountId: accountId.nullish(),
    fastModels: models,
    smartModels: models,
    /** The first key, so a new provider works straight away. */
    key: z.string().trim().min(8, "That doesn't look like an API key").max(500),
    keyLabel: z.string().trim().max(60).nullish(),
  })
  .refine((v) => v.kind !== "custom" || !!v.baseUrl, {
    message: "An OpenAI-compatible provider needs its chat-completions URL",
    path: ["baseUrl"],
  })
  .refine((v) => v.kind !== "cloudflare" || !!v.accountId, {
    message: "Cloudflare needs your Account ID",
    path: ["accountId"],
  })

export const aiProviderUpdateSchema = z.object({
  label: z.string().trim().min(2).max(60).optional(),
  baseUrl: httpsUrl.nullish(),
  accountId: accountId.optional(),
  fastModels: models.optional(),
  smartModels: models.optional(),
  isActive: z.boolean().optional(),
  /** Only `true`: the default moves to another provider, it is never just cleared. */
  isDefault: z.literal(true).optional(),
  move: z.enum(["up", "down"]).optional(),
})

export const aiKeyCreateSchema = z.object({
  key: z.string().trim().min(8, "That doesn't look like an API key").max(500),
  label: z.string().trim().max(60).nullish(),
})

export const aiKeyUpdateSchema = z.object({
  label: z.string().trim().max(60).nullish(),
  isActive: z.boolean().optional(),
  move: z.enum(["up", "down"]).optional(),
})

export type AiProviderCreateInput = z.infer<typeof aiProviderCreateSchema>
export type AiProviderUpdateInput = z.infer<typeof aiProviderUpdateSchema>
export type AiKeyCreateInput = z.infer<typeof aiKeyCreateSchema>
export type AiKeyUpdateInput = z.infer<typeof aiKeyUpdateSchema>
