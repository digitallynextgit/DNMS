import { z } from "zod"

export const createItemSchema = z.object({
  name: z.string().trim().min(1, "Item name is required").max(120),
  pricePerPiece: z.number().min(0).max(10_000_000).nullable().optional(),
  purchasedQty: z.number().int().min(0).max(1_000_000).optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
})

export const updateItemSchema = createItemSchema.partial()

export const createIssueSchema = z.object({
  itemId: z.string().min(1, "Pick an item"),
  holderName: z.string().trim().min(1, "Who is this issued to?").max(160),
  /** Optional employee link; null/absent = free-text holder only. */
  employeeId: z.string().nullable().optional(),
  quantity: z.number().int().min(1, "Quantity must be at least 1").max(100_000),
  issuedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .nullable()
    .optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
})

export const updateIssueSchema = z.object({
  holderName: z.string().trim().min(1).max(160).optional(),
  /** null unlinks; a string links; absent leaves the link alone. */
  employeeId: z.string().nullable().optional(),
  quantity: z.number().int().min(1).max(100_000).optional(),
  issuedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
})

/** Payload the import dialog builds from a parsed workbook (features/stock/lib/parse.ts). */
export const importSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        pricePerPiece: z.number().min(0).max(10_000_000).nullable(),
        purchasedQty: z.number().int().min(0).max(1_000_000).nullable(),
      }),
    )
    .max(500),
  issues: z
    .array(
      z.object({
        holderName: z.string().trim().min(1).max(160),
        itemName: z.string().trim().min(1).max(120),
        quantity: z.number().int().min(1).max(100_000),
        issuedOn: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable(),
      }),
    )
    .max(5000),
})

export type CreateItemInput = z.infer<typeof createItemSchema>
export type UpdateItemInput = z.infer<typeof updateItemSchema>
export type CreateIssueInput = z.infer<typeof createIssueSchema>
export type UpdateIssueInput = z.infer<typeof updateIssueSchema>
export type ImportInput = z.infer<typeof importSchema>
