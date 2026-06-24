"use server"

// =============================================================================
// Forgot-password (OTP) server actions - replace the former /api/auth/* routes.
// These run unauthenticated (the user has no session yet), so they do their own
// validation and return ActionResult instead of relying on the auth guards.
// =============================================================================

import bcrypt from "bcryptjs"
import { randomUUID, randomInt } from "crypto"
import { db } from "@/server/db"
import { sendEmail } from "@/lib/mailer"
import { renderPasswordResetOtpEmail } from "@/features/auth/emails/password-reset-otp"
import {
  forgotPasswordSchema,
  verifyOtpSchema,
  resetPasswordSchema,
} from "@/features/auth/schemas/auth.schema"
import { requireSession } from "@/server/action-guard"
import { ok, fail, runAction, type ActionResult } from "@/server/action-result"

const OTP_TTL_MS = 10 * 60 * 1000 // 10 minutes
const MAX_ATTEMPTS = 5

const INVALID_CODE = "Invalid or expired code. Please request a new one."

// ---------------------------------------------------------------------------
// Step 1 - verify the email belongs to an active employee, then email a code.
// (This flow deliberately reveals whether an active account exists, per
// product requirement - it is not anti-enumeration.)
// ---------------------------------------------------------------------------
export async function requestPasswordOtp(email: string): Promise<ActionResult<{ sent: true }>> {
  return runAction(async () => {
    const parsed = forgotPasswordSchema.safeParse({ email })
    if (!parsed.success) return fail("Please enter a valid email address.")

    const normalized = parsed.data.email.toLowerCase().trim()
    const employee = await db.employee.findUnique({ where: { email: normalized } })

    if (!employee || !employee.isActive) {
      return fail("No active employee account was found for this email.")
    }

    // One live code per employee - drop any previous ones first.
    await db.passwordReset.deleteMany({ where: { employeeId: employee.id } })

    const otp = String(randomInt(0, 1_000_000)).padStart(6, "0")
    const otpHash = await bcrypt.hash(otp, 10)
    const token = randomUUID()
    const expiresAt = new Date(Date.now() + OTP_TTL_MS)

    await db.passwordReset.create({
      data: { employeeId: employee.id, token, otpHash, expiresAt },
    })

    const { subject, html, text } = renderPasswordResetOtpEmail({
      firstName: employee.firstName,
      otp,
    })
    await sendEmail({ to: employee.email, subject, html, text, profile: "notifications" })

    return ok({ sent: true as const })
  })
}

// ---------------------------------------------------------------------------
// Step 2 - verify the code; on success hand back the token for the reset step.
// ---------------------------------------------------------------------------
export async function verifyPasswordOtp(
  email: string,
  otp: string,
): Promise<ActionResult<{ token: string }>> {
  return runAction(async () => {
    const parsed = verifyOtpSchema.safeParse({ email, otp })
    if (!parsed.success) return fail("Enter the 6-digit code.")

    const normalized = parsed.data.email.toLowerCase().trim()
    const employee = await db.employee.findUnique({ where: { email: normalized } })
    if (!employee || !employee.isActive) return fail(INVALID_CODE)

    const reset = await db.passwordReset.findFirst({
      where: { employeeId: employee.id, usedAt: null },
      orderBy: { createdAt: "desc" },
    })

    // No pending code, already verified (otpHash cleared), expired, or locked.
    if (
      !reset ||
      !reset.otpHash ||
      reset.expiresAt < new Date() ||
      reset.attempts >= MAX_ATTEMPTS
    ) {
      return fail(INVALID_CODE)
    }

    const valid = await bcrypt.compare(parsed.data.otp, reset.otpHash)
    if (!valid) {
      const attempts = reset.attempts + 1
      if (attempts >= MAX_ATTEMPTS) {
        await db.passwordReset.delete({ where: { id: reset.id } })
        return fail("Too many incorrect attempts. Please request a new code.")
      }
      await db.passwordReset.update({ where: { id: reset.id }, data: { attempts } })
      return fail(`Incorrect code. ${MAX_ATTEMPTS - attempts} attempt(s) left.`)
    }

    // Verified: clear the OTP so it can't be replayed; the token now authorizes
    // the final reset step.
    await db.passwordReset.update({
      where: { id: reset.id },
      data: { otpHash: null, attempts: 0 },
    })

    return ok({ token: reset.token })
  })
}

// ---------------------------------------------------------------------------
// Step 3 - set the new password (only valid once the OTP cleared the token).
// ---------------------------------------------------------------------------
export async function resetPasswordWithToken(
  token: string,
  password: string,
): Promise<ActionResult<{ reset: true }>> {
  return runAction(async () => {
    const parsed = resetPasswordSchema.safeParse({ token, password, confirmPassword: password })
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid input.")
    }

    const reset = await db.passwordReset.findUnique({ where: { token } })
    // otpHash must be null (OTP verified), unused, and unexpired.
    if (!reset || reset.usedAt || reset.otpHash || reset.expiresAt < new Date()) {
      return fail("Invalid or expired reset session. Please start over.")
    }

    const hashed = await bcrypt.hash(parsed.data.password, 12)
    await db.$transaction([
      db.employee.update({
        where: { id: reset.employeeId },
        // Clearing the OTP-reset path also satisfies any "must change" requirement.
        data: { passwordHash: hashed, mustChangePassword: false },
      }),
      db.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
    ])

    return ok({ reset: true as const })
  })
}

// ---------------------------------------------------------------------------
// Forced first-login change: the signed-in user sets their own password, which
// clears the mustChangePassword flag so the proxy stops funneling them here.
// ---------------------------------------------------------------------------
export async function setOwnPassword(newPassword: string): Promise<ActionResult<{ ok: true }>> {
  return runAction(async () => {
    const session = await requireSession()
    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return fail("Password must be at least 8 characters")
    }
    const hashed = await bcrypt.hash(newPassword, 12)
    await db.employee.update({
      where: { id: session.user.id },
      data: { passwordHash: hashed, mustChangePassword: false },
    })
    return ok({ ok: true as const })
  })
}
