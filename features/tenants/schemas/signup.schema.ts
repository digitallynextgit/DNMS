import { z } from "zod"
import { SLUG_PATTERN } from "@/lib/tenant-url"

/** Signup form fields, shared by the client form and the server action (which also re-checks
 *  reserved names and availability). */
export const signupSchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(2, "Enter your company name.")
    .max(80, "That name is too long."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      SLUG_PATTERN,
      "Use 3-32 characters: lowercase letters, numbers and hyphens, not starting or ending with a hyphen.",
    ),
  firstName: z.string().trim().min(1, "Enter your first name.").max(50),
  // No `.default("")`: it splits the input/output types, which react-hook-form's resolver
  // rejects. The form supplies "" instead.
  lastName: z.string().trim().max(50),
  email: z.email("Enter a valid work email address."),
  password: z.string().min(8, "Use at least 8 characters.").max(200, "That password is too long."),
})

export type SignupInput = z.infer<typeof signupSchema>

/** Suggest a workspace name: "Acme Media Pvt Ltd" -> "acme-media-pvt-ltd" (editable; the server
 *  has the final say). */
export function suggestSlug(companyName: string): string {
  return companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/-+$/, "")
}
