import { z } from "zod"

export const CLIENT_STATUSES = ["PROSPECT", "ACTIVE", "INACTIVE"] as const
export type ClientStatusValue = (typeof CLIENT_STATUSES)[number]

/** An optional free-text field: absent, empty, or trimmed text up to `max`. */
const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""))

/**
 * A client is a company. The people at it who can sign in to the portal are
 * ClientUsers, managed by the client-portal feature; this is the account they
 * hang off.
 */
export const clientCreateSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  status: z.enum(CLIENT_STATUSES).default("ACTIVE"),
  industry: optionalText(80),
  website: optionalText(200),
  email: z.string().trim().toLowerCase().email("Enter a valid email").optional().or(z.literal("")),
  phone: optionalText(30),
  address: optionalText(500),
  taxId: optionalText(40),
  notes: optionalText(2000),
  /** The account manager for the relationship. Null clears it. */
  ownerId: z.string().min(1).nullable().optional(),
})
export type ClientCreateInput = z.infer<typeof clientCreateSchema>

export const clientUpdateSchema = clientCreateSchema.partial()
export type ClientUpdateInput = z.infer<typeof clientUpdateSchema>

export const clientListQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.enum(CLIENT_STATUSES).optional(),
  ownerId: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
export type ClientListQuery = z.infer<typeof clientListQuerySchema>
