import { z } from "zod"

const tone = z.enum(["red", "teal"])
const status = z.enum(["DRAFT", "PUBLISHED"])
const mode = z.enum(["FULL_TIME", "INTERNSHIP"])

// Slug is optional on create (derived from the title when omitted).
const optionalSlug = z
  .string()
  .trim()
  .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers and hyphens")
  .optional()

export const createGroupSchema = z.object({
  mode,
  code: z.string().trim().min(1, "Code is required"),
  title: z.string().trim().min(1, "Title is required"),
  slug: optionalSlug,
  jobsLabel: z.string().trim().min(1, "Jobs label is required"),
  tone: tone.default("teal"),
  order: z.number().int().min(0).optional(),
  status: status.optional(),
})
export const updateGroupSchema = createGroupSchema.partial()

export const createSubDepartmentSchema = z.object({
  groupId: z.string().min(1),
  title: z.string().trim().min(1, "Title is required"),
  slug: optionalSlug,
  jobsLabel: z.string().trim().min(1, "Jobs label is required"),
  tone: tone.default("teal"),
  order: z.number().int().min(0).optional(),
  status: status.optional(),
})
export const updateSubDepartmentSchema = createSubDepartmentSchema.partial().omit({ groupId: true })

export const createRoleSchema = z.object({
  subDepartmentId: z.string().min(1),
  title: z.string().trim().min(1, "Title is required"),
  slug: optionalSlug,
  meta: z.string().trim().nullish(),
  summary: z.string().trim().nullish(),
  intro: z.string().trim().nullish(),
  jobEssence: z.string().trim().nullish(),
  keyRequirements: z.array(z.string().trim().min(1)).optional(),
  order: z.number().int().min(0).optional(),
  status: status.optional(),
})
export const updateRoleSchema = createRoleSchema.partial().omit({ subDepartmentId: true })

export const createOpeningSchema = z.object({
  roleId: z.string().min(1),
  label: z.string().trim().min(1, "Label is required"),
  order: z.number().int().min(0).optional(),
  status: status.optional(),
})
export const updateOpeningSchema = createOpeningSchema.partial().omit({ roleId: true })

export type CreateGroupInput = z.infer<typeof createGroupSchema>
export type CreateSubDepartmentInput = z.infer<typeof createSubDepartmentSchema>
export type CreateRoleInput = z.infer<typeof createRoleSchema>
export type CreateOpeningInput = z.infer<typeof createOpeningSchema>
