"use server"

import { requireSession } from "@/server/action-guard"
import { fail, ok, runAction, type ActionResult } from "@/server/action-result"
import { OAuthFlowError, approveAuthorization, denyAuthorization } from "./oauth.service"

// Allow / Deny on the consent screen. Server actions bring Next's origin check, so a third-party
// page can't click Allow for the person.

export async function approveConsent(id: string): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(async () => {
    const session = await requireSession()
    try {
      return ok({ redirectTo: await approveAuthorization(id, session) })
    } catch (err) {
      if (err instanceof OAuthFlowError) return fail(err.message, undefined, 400)
      throw err
    }
  })
}

export async function denyConsent(
  id: string,
): Promise<ActionResult<{ redirectTo: string | null }>> {
  return runAction(async () => {
    await requireSession()
    return ok({ redirectTo: await denyAuthorization(id) })
  })
}
