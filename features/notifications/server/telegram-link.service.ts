import "server-only"

import { randomBytes } from "node:crypto"
import { db } from "@/server/db"
import { botUsername, isTelegramConfigured } from "@/lib/telegram"

// Linking an employee's Telegram: a short-lived code in a t.me deep link; the bot's /start
// handler (lib/telegram.ts) turns it into a chat id.

const CODE_TTL_MS = 15 * 60_000

export interface TelegramLinkStatus {
  configured: boolean
  botUsername: string | null
  linked: boolean
  username: string | null
  linkedAt: string | null
  /** A link was started and not yet confirmed in Telegram. */
  pending: boolean
}

export async function telegramLinkStatus(employeeId: string): Promise<TelegramLinkStatus> {
  const configured = await isTelegramConfigured()
  let name: string | null = null
  if (configured) {
    try {
      name = await botUsername()
    } catch {
      name = null
    }
  }
  const row = await db.telegramLink.findUnique({
    where: { employeeId },
    select: { chatId: true, username: true, linkedAt: true, codeExpiresAt: true },
  })
  return {
    configured,
    botUsername: name,
    linked: !!row?.chatId,
    username: row?.username ?? null,
    linkedAt: row?.linkedAt?.toISOString() ?? null,
    pending: !row?.chatId && !!row?.codeExpiresAt && row.codeExpiresAt > new Date(),
  }
}

/** A fresh code and the t.me link to open; pressing Start in Telegram completes the link. */
export async function startTelegramLink(
  employeeId: string,
): Promise<{ url: string; expiresAt: string }> {
  const name = await botUsername()
  const code = randomBytes(18).toString("base64url")
  const codeExpiresAt = new Date(Date.now() + CODE_TTL_MS)
  await db.telegramLink.upsert({
    where: { employeeId },
    create: { employeeId, code, codeExpiresAt },
    update: { code, codeExpiresAt },
  })
  return { url: `https://t.me/${name}?start=${code}`, expiresAt: codeExpiresAt.toISOString() }
}

export async function unlinkTelegram(employeeId: string): Promise<void> {
  await db.telegramLink.updateMany({
    where: { employeeId },
    data: { chatId: null, username: null, linkedAt: null, code: null, codeExpiresAt: null },
  })
}
