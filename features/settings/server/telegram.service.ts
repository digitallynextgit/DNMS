import "server-only"

import { PERMISSIONS } from "@/lib/constants"
import { requirePermission } from "@/server/action-guard"
import { getConfig } from "@/server/app-config"
import { ok, fail, runAction, type ActionResult } from "@/server/action-result"
import {
  WEBHOOK_PATH,
  botUsername,
  isTelegramConfigured,
  registerWebhook,
  webhookInfo,
} from "@/lib/telegram"

export interface TelegramStatus {
  configured: boolean
  botUsername: string | null
  expectedUrl: string
  webhookUrl: string | null
  pending: number
  lastError: string | null
  /** The token is set but Telegram rejected it. */
  tokenError: string | null
}

async function appUrl(): Promise<string> {
  return ((await getConfig("APP_URL")) ?? process.env.NEXTAUTH_URL ?? "").replace(/\/+$/, "")
}

export async function getTelegramStatus(): Promise<ActionResult<{ data: TelegramStatus }>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.SETTINGS_WRITE)
    const expectedUrl = `${await appUrl()}${WEBHOOK_PATH}`
    const status: TelegramStatus = {
      configured: await isTelegramConfigured(),
      botUsername: null,
      expectedUrl,
      webhookUrl: null,
      pending: 0,
      lastError: null,
      tokenError: null,
    }
    if (status.configured) {
      try {
        status.botUsername = await botUsername()
        const info = await webhookInfo()
        status.webhookUrl = info.url || null
        status.pending = info.pending_update_count
        status.lastError = info.last_error_message ?? null
      } catch (err) {
        status.tokenError = err instanceof Error ? err.message : "Telegram did not accept the token"
      }
    }
    return ok({ data: status })
  })
}

/** Points the bot's webhook at this DNMS, so messages to the bot reach us. */
export async function connectTelegram(): Promise<ActionResult<{ data: { url: string } }>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.SETTINGS_WRITE)
    if (!(await isTelegramConfigured())) return fail("Save the bot token first", undefined, 400)
    const base = await appUrl()
    if (!base.startsWith("https://"))
      return fail("APP_URL must be an https address for Telegram to call it", undefined, 400)
    await registerWebhook(base)
    return ok({ data: { url: `${base}${WEBHOOK_PATH}` } })
  })
}
