import "server-only"

import { z } from "zod"

import { db } from "@/server/db"

export const newsletterSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
})

/** Public newsletter sign-up. Re-subscribing silently succeeds, so it never reveals the list. */
export async function subscribeToNewsletter(input: unknown): Promise<{ email: string }> {
  const { email } = newsletterSchema.parse(input)
  await db.newsletterSubscriber.upsert({
    where: { email },
    update: {},
    create: { email },
  })
  return { email }
}
