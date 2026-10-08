"use server"

import { headers } from "next/headers"
import { db } from "@/server/db"
import { runUnscoped } from "@/server/tenant-context"
import { isValidSlug, slugRejectionReason } from "@/server/tenants"
import { ok, fail, runAction, type ActionResult } from "@/server/action-result"
import { provisionTenant, ProvisionError } from "./provision.service"
import { signupSchema } from "../schemas/signup.schema"

// Self-service signup - the only unauthenticated write, so it gets extra abuse checks.

/** Crude per-IP throttle (3 signups/hour), in-process and per-instance - not real rate limiting.
 *  TODO: use a shared store or a captcha before signup is advertised publicly. */
const ATTEMPTS = new Map<string, number[]>()
const WINDOW_MS = 60 * 60 * 1000
const MAX_PER_WINDOW = 3

function throttled(ip: string): boolean {
  const now = Date.now()
  const recent = (ATTEMPTS.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  recent.push(now)
  ATTEMPTS.set(ip, recent)
  // Keep the map from growing without bound on a long-lived process.
  if (ATTEMPTS.size > 5_000) ATTEMPTS.clear()
  return recent.length > MAX_PER_WINDOW
}

/** Is this workspace name free? Drives the live hint under the field. */
export async function checkSlugAvailable(
  raw: string,
): Promise<ActionResult<{ available: boolean; reason: string | null }>> {
  return runAction(async () => {
    const slug = raw.trim().toLowerCase()
    if (!slug) return ok({ available: false, reason: null })
    const reason = slugRejectionReason(slug)
    if (reason) return ok({ available: false, reason })

    const taken = await runUnscoped("signup: slug availability is a platform-wide question", () =>
      db.tenant.findUnique({ where: { slug }, select: { id: true } }),
    )
    return ok({
      available: !taken,
      reason: taken ? "That workspace name is taken." : null,
    })
  })
}

export async function createWorkspace(
  input: unknown,
): Promise<ActionResult<{ slug: string; redirectTo: string }>> {
  return runAction(async () => {
    const h = await headers()
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown"
    if (throttled(ip)) {
      return fail("Too many signups from this network. Please try again later.", undefined, 429)
    }

    const parsed = signupSchema.safeParse(input)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return fail(first?.message ?? "Please check the form.", undefined, 422)
    }
    const data = parsed.data

    if (!isValidSlug(data.slug)) {
      return fail(
        slugRejectionReason(data.slug) ?? "That workspace name cannot be used.",
        undefined,
        422,
      )
    }

    try {
      const result = await provisionTenant({
        companyName: data.companyName,
        slug: data.slug,
        adminFirstName: data.firstName,
        adminLastName: data.lastName,
        adminEmail: data.email,
        adminPassword: data.password,
      })
      return ok({
        slug: result.slug,
        // The form signs them in with the new password first, then lands here.
        redirectTo: `/${result.slug}/dashboard`,
      })
    } catch (err) {
      if (err instanceof ProvisionError) return fail(err.message, undefined, 422)
      throw err
    }
  })
}
