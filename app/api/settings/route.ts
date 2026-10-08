import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { getSettings, updateSettings } from "@/features/settings/server/settings.service"

export const GET = withErrorHandler(async () => respond(await getSettings()))

export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const values = (await req.json()) as Record<string, string>
  return respond(await updateSettings(values))
})
