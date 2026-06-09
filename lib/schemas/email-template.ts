import { z } from "zod"

export const emailTemplateSchema = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens"),
  name: z.string().min(1, "Template name is required"),
  subject: z.string().min(1, "Email subject is required"),
  bodyHtml: z.string().min(1, "Email body is required"),
  bodyText: z.string().optional(),
  mergeFields: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  trigger: z.string().optional(),
})

export type EmailTemplateInput = z.infer<typeof emailTemplateSchema>
