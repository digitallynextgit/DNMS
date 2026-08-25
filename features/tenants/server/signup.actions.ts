"use server"

import { headers } from "next/headers"
import { db } from "@/server/db"
import { runUnscoped } from "@/server/tenant-context"
import { isValidSlug, slugRejectionReason } from "@/server/tenants"
import { ok, fail, runAction, type ActionResult } from "@/server/action-result"
import { provisionTenant, ProvisionError } from "./provision.service"
import { signupSchema } from "../schemas/signup.schema"

// =============================================================================
// Self-service signup (M5) - the only unauthenticated WRITE in the app.
//
// Everything else that creates data sits behind a session. This does not, by
// definition: the person has no account yet. That makes it the one endpoint
// where abuse costs something real (a tenant, five roles, an employee), so it
// gets checks the authenticated paths do not need.
// =============================================================================

/**
 * Crude per-IP throttle: 3 signups per hour from one address.
 *
 * In-process, so it resets on deploy and is per-instance. That is enough to stop
 * a script creating a thousand workspaces and NOT enough to call rate limiting -
 * a determined abuser rotates addresses. Before this is advertised publicly it
 * wants something shared and durable (the same store the queue uses, or a
 * captcha). Written down here rather than left as an assumption.
 */
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
        // They are not signed in yet - the form signs them in with the password
        // they just chose, then lands here.
        redirectTo: `/${result.slug}/dashboard`,
      })
    } catch (err) {
      if (err instanceof ProvisionError) return fail(err.message, undefined, 422)
      throw err
    }
  })
}
