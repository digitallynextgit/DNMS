import { NextRequest, NextResponse } from "next/server"
import { handleTelegramUpdate, webhookSecret, type TelegramUpdate } from "@/lib/telegram"

// Telegram calls this for every message sent to the bot. Deliberately unauthenticated (Telegram
// holds no DNMS session); the secret header set at registration is the guard. Always 200: a
// non-200 makes Telegram retry the same update for days.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const expected = await webhookSecret()
  if (!expected || req.headers.get("x-telegram-bot-api-secret-token") !== expected) {
    return new NextResponse("Forbidden", { status: 403 })
  }
  try {
    const update = (await req.json()) as TelegramUpdate
    await handleTelegramUpdate(update)
  } catch (err) {
    console.error("[telegram] webhook failed:", err)
  }
  return NextResponse.json({ ok: true })
}
