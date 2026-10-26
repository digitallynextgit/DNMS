import { NextRequest, NextResponse } from "next/server"
import { withSession } from "@/server/api-handler"
import {
  startTelegramLink,
  telegramLinkStatus,
  unlinkTelegram,
} from "@/features/notifications/server/telegram-link.service"
import type { Session } from "next-auth"

// The caller's own Telegram link only: there is nothing to choose, so no body is read.
export const GET = withSession(async (_req: NextRequest, _ctx: unknown, session: Session) =>
  NextResponse.json({ data: await telegramLinkStatus(session.user.id) }),
)

export const POST = withSession(async (_req: NextRequest, _ctx: unknown, session: Session) =>
  NextResponse.json({ data: await startTelegramLink(session.user.id) }),
)

export const DELETE = withSession(async (_req: NextRequest, _ctx: unknown, session: Session) => {
  await unlinkTelegram(session.user.id)
  return NextResponse.json({ data: { ok: true } })
})
