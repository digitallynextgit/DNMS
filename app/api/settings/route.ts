import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { getSettings, updateSettings } from "@/features/settings/server/settings.service"

// GET /api/settings - current effective config for the Integrations page.
export const GET = withErrorHandler(async () => respond(await getSettings()))

// PATCH /api/settings - upsert the provided setting keys.
export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const values = (await req.json()) as Record<string, string>
  return respond(await updateSettings(values))
})
