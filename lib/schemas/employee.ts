import { z } from "zod"

const addressSchema = z
  .object({
    line1: z.string().optional(),
    line2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    country: z.string().optional().default("India"),
  })
  .optional()

const emergencyContactSchema = z
  .object({
    name: z.string().optional(),
    relation: z.string().optional(),
    phone: z.string().optional(),
  })
  .optional()

export const createEmployeeSchema = z.object({
  // Optional override for the employee code/number. Blank or omitted ⇒ auto-generated
  // as EMP-YYYY-####. When provided, must be unique across the table.
  employeeNo: z.string().trim().min(1).max(32).optional(),

  // Personal
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid work email is required"),
  personalEmail: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  personalPhone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]).optional(),
  nationality: z.string().optional(),
  bloodGroup: z.string().optional(),

  // Employment
  departmentId: z.string().uuid("Select a department").optional(),
  designationId: z.string().uuid("Select a designation").optional(),
  roleId: z.string().uuid("Select a role").optional(),
  managerId: z.string().uuid().optional(),
  dottedManagerId: z.string().uuid().optional(),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"]).default("FULL_TIME"),
  dateOfJoining: z.string().optional(),
  probationEndDate: z.string().optional(),
  // Offboarding
  status: z.enum(["ACTIVE", "ON_LEAVE", "SUSPENDED", "RESIGNED", "TERMINATED"]).optional(),
  resignationDate: z.string().optional(),
  lastWorkingDate: z.string().optional(),
  // Biometric device person ID (e.g. Hikvision "Employee ID") used to match
  // imported/synced punches to this employee.
  deviceId: z.string().optional(),
  // Probation (admin-controlled). Effective status is computed from dateOfJoining + probationMonths.
  onProbation: z.boolean().optional(),
  probationMonths: z.coerce
    .number()
    .int()
    .refine((v) => v === 3 || v === 6, "Probation must be 3 or 6 months")
    .optional(),
  workLocation: z.string().optional(),

  // Address & Emergency
  currentAddress: addressSchema,
  permanentAddress: addressSchema,
  emergencyContact: emergencyContactSchema,

  // Optional initial password
  password: z.string().min(8).optional(),

  // Required Gmail App Password (16-char string Google generates).
  // We strip spaces before validation since Google formats it as "abcd efgh ijkl mnop".
  gmailAppPassword: z
    .string()
    .transform((s) => s.replace(/\s+/g, ""))
    .pipe(z.string().min(16, "Gmail App Password must be 16 characters").max(16)),
})

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>

export const updateEmployeeSchema = createEmployeeSchema.partial()
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>

export const employeeFilterSchema = z.object({
  search: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  designationId: z.string().uuid().optional(),
  status: z.enum(["ACTIVE", "ON_LEAVE", "SUSPENDED", "RESIGNED", "TERMINATED"]).optional(),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"]).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
})

export type EmployeeFilter = z.infer<typeof employeeFilterSchema>
