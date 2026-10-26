import { withErrorHandler, respond } from "@/server/api-handler"
import { connectTelegram, getTelegramStatus } from "@/features/settings/server/telegram.service"

export const GET = withErrorHandler(async () => respond(await getTelegramStatus()))

/** Registers the bot's webhook with Telegram (settings:write). */
export const POST = withErrorHandler(async () => respond(await connectTelegram()))
