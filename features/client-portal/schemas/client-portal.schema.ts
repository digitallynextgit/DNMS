import { z } from "zod"
import { CLIENT_MODULES } from "../modules"

const MODULE_KEYS = CLIENT_MODULES.map((m) => m.key) as [string, ...string[]]

/** At least one module: a grant that unlocks nothing produces an account that
 *  can sign in and stare at a blank portal. */
const modulesSchema = z.array(z.enum(MODULE_KEYS)).min(1, "Pick at least one section")

/**
 * Add a client to the project you're looking at. The project comes from the URL,
 * never the body - so this form can't be used to grant access to some other
 * project.
 */
const newPersonSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  modules: modulesSchema,
  /**
   * Whether the emailed password must be replaced on first sign-in. Default on:
   * a password that travelled through an inbox should not stay the live one.
   */
  forcePasswordChange: z.boolean().default(true),
})

/**
 * Someone who already has a login at this project's client, being given this
 * project too. No name or email - those are on their account already - and no
 * password is issued, because they have one.
 */
const existingContactSchema = z.object({
  contactId: z.string().min(1),
  modules: modulesSchema,
})

export const projectClientCreateSchema = z.union([existingContactSchema, newPersonSchema])
export type ProjectClientCreateInput = z.infer<typeof projectClientCreateSchema>

/** Change what an existing client on this project can see, or pause them. */
export const projectClientUpdateSchema = z.object({
  modules: modulesSchema.optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  isActive: z.boolean().optional(),
})
export type ProjectClientUpdateInput = z.infer<typeof projectClientUpdateSchema>

/** Re-issue a password. `forcePasswordChange` is asked again, not inherited. */
export const projectClientResetSchema = z.object({
  forcePasswordChange: z.boolean().default(true),
})
export type ProjectClientResetInput = z.infer<typeof projectClientResetSchema>

export const clientPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z
      .string()
      .min(8, "Use at least 8 characters")
      .max(72, "Passwords are limited to 72 characters")
      .regex(/[a-z]/, "Include a lowercase letter")
      .regex(/[A-Z]/, "Include an uppercase letter")
      .regex(/[0-9]/, "Include a number"),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: "Choose a password you haven't used here before",
    path: ["newPassword"],
  })
export type ClientPasswordInput = z.infer<typeof clientPasswordSchema>

export const productListQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.enum(["active", "draft", "archived"]).optional(),
  channelId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
})
export type ProductListQuery = z.infer<typeof productListQuerySchema>

// ─── Client book (features/clients) → contacts and grants ────────────────────
// The same accounts and grants, reached from the client's own page: the client
// is fixed by the URL, so a grant names a project and a person, never a client.

export const clientContactCreateSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  forcePasswordChange: z.boolean().default(true),
  /** A first project grant, so a person is not created and then granted in two trips. */
  grant: z.object({ projectId: z.string().min(1), modules: modulesSchema }).optional(),
})
export type ClientContactCreateInput = z.infer<typeof clientContactCreateSchema>

export const clientContactUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  isActive: z.boolean().optional(),
})
export type ClientContactUpdateInput = z.infer<typeof clientContactUpdateSchema>

export const clientContactResetSchema = z.object({
  forcePasswordChange: z.boolean().default(true),
})
export type ClientContactResetInput = z.infer<typeof clientContactResetSchema>

export const clientGrantCreateSchema = z.object({
  contactId: z.string().min(1),
  projectId: z.string().min(1),
  modules: modulesSchema,
})
export type ClientGrantCreateInput = z.infer<typeof clientGrantCreateSchema>

export const clientGrantUpdateSchema = z.object({
  modules: modulesSchema.optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
})
export type ClientGrantUpdateInput = z.infer<typeof clientGrantUpdateSchema>
