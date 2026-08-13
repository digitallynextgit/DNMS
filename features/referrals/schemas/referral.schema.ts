import { z } from "zod"

/** http(s) only - never javascript:, data: or file:. */
const httpUrl = z
  .string()
  .trim()
  .max(1000)
  .refine(
    (v) => {
      try {
        const u = new URL(v)
        return u.protocol === "http:" || u.protocol === "https:"
      } catch {
        return false
      }
    },
    { message: "Enter a full URL, including https://" },
  )

/**
 * An employee referring somebody directly inside DNMS.
 *
 * Lighter than the public careers form on purpose: the referrer is a colleague
 * we already trust, not an anonymous stranger, and demanding a portfolio and a
 * LinkedIn before they can pass on a friend's CV is how a referral scheme goes
 * unused. Name, a way to contact them, and the role is the honest minimum.
 */
export const submitReferralSchema = z.object({
  fullName: z.string().trim().min(1, "Their name is required.").max(200),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(320),
  phone: z.string().trim().max(50).optional().default(""),
  resumeUrl: httpUrl,
  linkedIn: z
    .union([httpUrl, z.literal("")])
    .optional()
    .default(""),
  /** The live role they are being put forward for. */
  careerRoleId: z.string().trim().min(1, "Pick the role you are referring them for."),
  note: z.string().trim().max(2000).optional().default(""),
})

export type SubmitReferralInput = z.infer<typeof submitReferralSchema>

/** HR linking a hired applicant to the employee record created for them. */
export const linkHireSchema = z.object({
  hiredEmployeeId: z.string().trim().min(1, "Pick the employee record for this hire."),
})

/** HR recording that the reward has actually been paid. */
export const markPaidSchema = z.object({
  /**
   * Rupees. Optional - omitted means "use what DNMS calculated", which is the
   * normal case; supplying it covers a negotiated or rounded figure.
   */
  amount: z.number().positive().max(10_000_000).optional(),
})
