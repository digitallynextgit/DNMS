"use server"

import { requireSession } from "@/server/action-guard"
import { fail, ok, runAction, type ActionResult } from "@/server/action-result"
import { OAuthFlowError, approveAuthorization, denyAuthorization } from "./oauth.service"

// Allow / Deny on the AI-connector consent screen (/oauth/consent/[id]).
// Both return the URL to send the browser to - back to Claude/ChatGPT with
// either a one-time code or access_denied. Server actions bring Next's origin
// check, so a third-party page cannot click Allow on the person's behalf.

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

export async function denyConsent(id: string): Promise<ActionResult<{ redirectTo: string | null }>> {
  return runAction(async () => {
    await requireSession()
    return ok({ redirectTo: await denyAuthorization(id) })
  })
}
