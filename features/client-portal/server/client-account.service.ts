// =============================================================================
// Client self-service (portal side)
// =============================================================================
// The only writes a client account can perform on itself. Deliberately tiny:
// a client can change their password and nothing else. Name/email/company are
// staff-managed, because they are how staff identify who a grant belongs to.
// =============================================================================

import "server-only"

import bcrypt from "bcryptjs"
import { db } from "@/server/db"
import { setPassword } from "@/server/identity"
import { requireClientSession } from "@/server/client-guard"
import { ok, fail, runAction, type ActionResult } from "@/server/action-result"
import { clientPasswordSchema, type ClientPasswordInput } from "../schemas/client-portal.schema"

export async function changeClientPassword(
  body: ClientPasswordInput,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requireClientSession()
    const input = clientPasswordSchema.parse(body)

    const user = await db.clientUser.findUnique({
      where: { id: session.user.id },
      // passwordHash is globally omitted (server/db.ts); opt back in to verify.
      omit: { passwordHash: false },
    })
    if (!user?.passwordHash) return fail("Account not found", undefined, 404)

    const valid = await bcrypt.compare(input.currentPassword, user.passwordHash)
    if (!valid) return fail("Your current password is incorrect", undefined, 400)

    // Writes the platform credential AND client_users.password_hash (M2 dual-write).
    // Clearing mustChangePassword releases the gate in proxy.ts; the client must
    // refresh their session (session.update()) for the new flag to reach their token.
    await setPassword({ clientUserId: session.user.id }, input.newPassword)

    return ok({ changed: true })
  })
}
