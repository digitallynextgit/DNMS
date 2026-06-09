import { z } from "zod"

export const uploadDocumentSchema = z.object({
  title: z.string().min(1, "Document title is required").max(200),
  description: z.string().max(500).optional(),
  category: z
    .enum([
      "IDENTITY",
      "ACADEMIC",
      "PROFESSIONAL",
      "EMPLOYMENT",
      "TAX",
      "COMPANY_POLICY",
      "TEMPLATE",
      "OTHER",
    ])
    .default("OTHER"),
  employeeId: z.string().uuid().optional(),
  expiresAt: z.string().optional(),
})

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>
