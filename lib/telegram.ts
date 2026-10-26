import "server-only"

import { createHash } from "node:crypto"
import { db } from "@/server/db"
import { getConfig } from "@/server/app-config"
import { currentTenant, runUnscoped } from "@/server/tenant-context"
import { withTenant } from "@/lib/tenant-url"
import type { PushPayload } from "@/lib/web-push"

// Telegram as a notification transport: one bot for the company, one private chat per employee,
// linked once from their profile (lib/notifications.ts fans every notification out here too).

const API = "https://api.telegram.org"

async function token(): Promise<string | null> {
  return (await getConfig("TELEGRAM_BOT_TOKEN")) || null
}

export async function isTelegramConfigured(): Promise<boolean> {
  return !!(await token())
}

class TelegramError extends Error {
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(message)
    this.name = "TelegramError"
  }
}

async function call<T>(method: string, body: Record<string, unknown> = {}): Promise<T> {
  const t = await token()
  if (!t) throw new TelegramError("Telegram bot token is not set")
  const res = await fetch(`${API}/bot${t}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  const json = (await res.json()) as {
    ok: boolean
    result?: T
    description?: string
    error_code?: number
  }
  if (!json.ok)
    throw new TelegramError(json.description ?? `Telegram ${method} failed`, json.error_code)
  return json.result as T
}

let bot: { username: string; at: number } | null = null

/** The bot's @username, for the t.me link; cached for an hour. */
export async function botUsername(): Promise<string> {
  if (bot && Date.now() - bot.at < 3_600_000) return bot.username
  const me = await call<{ username: string }>("getMe")
  bot = { username: me.username, at: Date.now() }
  return me.username
}

/** Sent by Telegram with every webhook call; derived from the token so nothing else is stored. */
export async function webhookSecret(): Promise<string | null> {
  const t = await token()
  return t ? createHash("sha256").update(t).digest("hex").slice(0, 40) : null
}

export const WEBHOOK_PATH = "/api/public/telegram/webhook"

export async function registerWebhook(appUrl: string): Promise<void> {
  await call("setWebhook", {
    url: `${appUrl.replace(/\/+$/, "")}${WEBHOOK_PATH}`,
    secret_token: await webhookSecret(),
    allowed_updates: ["message"],
    drop_pending_updates: true,
  })
  bot = null
}

export interface WebhookInfo {
  url: string
  pending_update_count: number
  last_error_message?: string
  last_error_date?: number
}

export function webhookInfo(): Promise<WebhookInfo> {
  return call<WebhookInfo>("getWebhookInfo")
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/** Fire-and-forget: a notification for an employee, to their linked chat. Never throws. */
export async function sendTelegramToEmployee(
  employeeId: string,
  payload: PushPayload,
): Promise<void> {
  try {
    if (!(await isTelegramConfigured())) return
    const link = await db.telegramLink.findUnique({
      where: { employeeId },
      select: { id: true, chatId: true },
    })
    if (!link?.chatId) return

    const lines = [`<b>${escapeHtml(payload.title)}</b>`, escapeHtml(payload.message)]
    const appUrl = (await getConfig("APP_URL")) ?? process.env.NEXTAUTH_URL ?? ""
    if (payload.link && appUrl) {
      const path = withTenant(payload.link, currentTenant()?.slug)
      lines.push(`<a href="${appUrl.replace(/\/+$/, "")}${path}">Open in DNMS</a>`)
    }
    try {
      await call("sendMessage", {
        chat_id: link.chatId,
        text: lines.join("\n"),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      })
    } catch (err) {
      // 403: they blocked the bot. Forget the chat, so they can link again later.
      if (err instanceof TelegramError && err.code === 403) {
        await db.telegramLink.update({
          where: { id: link.id },
          data: { chatId: null, username: null, linkedAt: null },
        })
        return
      }
      throw err
    }
  } catch (err) {
    console.error("[telegram] send failed:", err)
  }
}

export interface TelegramUpdate {
  message?: {
    chat: { id: number; type: string }
    from?: { username?: string; first_name?: string }
    text?: string
  }
}

/** One incoming message from the bot's webhook: /start <code> links, /stop unlinks. */
export async function handleTelegramUpdate(update: TelegramUpdate): Promise<void> {
  const m = update.message
  if (!m?.text || m.chat.type !== "private") return
  const chatId = String(m.chat.id)
  const text = m.text.trim()
  const reply = (html: string) =>
    call("sendMessage", { chat_id: chatId, text: html, parse_mode: "HTML" })

  const start = /^\/start(?:@\w+)?(?:\s+([A-Za-z0-9_-]+))?$/.exec(text)
  if (start) {
    const code = start[1]
    if (!code) {
      await reply(
        "To get your DNMS notifications here, open DNMS → Profile → Notifications and press <b>Link Telegram</b>.",
      )
      return
    }
    // The code carries the tenant; the lookup has to cross tenants to find it.
    const row = await runUnscoped("telegram link by code", () =>
      db.telegramLink.findFirst({
        where: { code, codeExpiresAt: { gt: new Date() } },
        select: { id: true, employee: { select: { firstName: true, lastName: true } } },
      }),
    )
    if (!row) {
      await reply(
        "That link has expired. Open DNMS → Profile → Notifications and press <b>Link Telegram</b> again.",
      )
      return
    }
    await runUnscoped("telegram link by code", () =>
      db.telegramLink.update({
        where: { id: row.id },
        data: {
          chatId,
          username: m.from?.username ?? null,
          linkedAt: new Date(),
          code: null,
          codeExpiresAt: null,
        },
      }),
    )
    const name = `${row.employee.firstName} ${row.employee.lastName}`.trim()
    await reply(
      `Linked to DNMS as <b>${escapeHtml(name)}</b>. Your DNMS notifications will arrive here.\nSend /stop to unlink.`,
    )
    return
  }

  if (/^\/stop(?:@\w+)?$/.test(text)) {
    const n = await runUnscoped("telegram unlink by chat", () =>
      db.telegramLink.updateMany({
        where: { chatId },
        data: { chatId: null, username: null, linkedAt: null },
      }),
    )
    await reply(
      n.count
        ? "Unlinked. DNMS will not message you here any more."
        : "This chat is not linked to DNMS.",
    )
    return
  }

  await reply("DNMS sends your notifications here. Send /stop to unlink.")
}
