import { z } from "zod"
import { SLUG_PATTERN } from "@/lib/tenant-url"

/**
 * What the signup form collects (M5).
 *
 * Shared by the client form and the server action, so the browser and the
 * server disagree about nothing. The server re-checks reserved names and
 * availability, which this schema deliberately does not know about - a regex
 * cannot know what is already taken.
 */
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
  // No `.default("")`: a default makes the parsed OUTPUT type required while the
  // INPUT stays optional, and react-hook-form's resolver then refuses to line
  // the two up. The form supplies "" instead, which is the same thing without
  // the type split.
  lastName: z.string().trim().max(50),
  email: z.email("Enter a valid work email address."),
  password: z.string().min(8, "Use at least 8 characters.").max(200, "That password is too long."),
})

export type SignupInput = z.infer<typeof signupSchema>

/**
 * Turn a company name into a workspace name: "Acme Media Pvt Ltd" → "acme-media-pvt-ltd".
 *
 * Only a suggestion - the field stays editable, and the server has the final say.
 */
export function suggestSlug(companyName: string): string {
  return companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/-+$/, "")
}
