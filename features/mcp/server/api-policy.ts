// What the AI connector may NOT reach, even though the person could: the superadmin/platform
// layer, machine-only routes, and endpoints that hand out stored secrets. Also imported by
// scripts/generate-mcp-api-map.ts, so no server-only imports.

export const EXCLUDED_API_PATHS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^\/api\/auth(\/|$)/, "sign-in internals"],
  [/^\/api\/oauth(\/|$)/, "the connector's own OAuth server"],
  [/^\/api\/mcp(\/|$)/, "the connector itself"],
  [/^\/api\/ai-connections(\/|$)/, "managing AI connections (do that in the DNMS web app)"],
  [/^\/api\/cron(\/|$)/, "scheduled machine jobs"],
  [/^\/api\/public(\/|$)/, "public website APIs"],
  [/^\/api\/marketing(\/|$)/, "the signed-out marketing site"],
  [/^\/api\/portal(\/|$)/, "the client portal (client accounts only)"],
  [/^\/api\/mobile(\/|$)/, "the mobile app API"],
  [/^\/api\/password(\/|$)/, "changing or resetting passwords"],
  [/^\/api\/attendance\/hook(\/|$)/, "the biometric terminal push hook"],
  [/^\/api\/ai(\/|$)/, "the in-app assistant"],
  [/\/stream$/, "live event streams"],
  [/^\/api\/notifications\/push(\/|$)/, "browser push subscriptions"],
  [/^\/api\/settings(\/|$)/, "platform integrations and secrets (superadmin)"],
  [/^\/api\/admin\/storage(\/|$)/, "platform storage (superadmin)"],
  [/^\/api\/admin\/storage-accounts(\/|$)/, "platform storage accounts (superadmin)"],
  [/^\/api\/admin\/google-drive(\/|$)/, "the platform's Google Drive account (superadmin)"],
  [/^\/api\/admin\/ai-models(\/|$)/, "AI provider keys (superadmin)"],
  [/^\/api\/integrations(\/|$)/, "connecting platform integrations (superadmin)"],
  [/^\/api\/celebrations(\/|$)/, "birthday-surprise photos"],
  [/^\/api\/profile\/sessions(\/|$)/, "signed-in devices (manage them in Profile -> Security)"],
  [/^\/api\/clients\/\[id\]\/contacts\/\[contactId\]\/password$/, "client portal passwords"],
]

/** Single methods that would hand stored secrets to the AI. */
export const BLOCKED_API_METHODS: Readonly<Record<string, readonly string[]>> = {
  // Decrypts a project password-vault entry.
  "/api/projects/[id]/passwords/[entryId]": ["GET"],
  // Returns decrypted Meta (ads) credentials.
  "/api/projects/[id]/integration/credentials": ["GET"],
}

/** Body fields the AI may not send because they set a sign-in password. The rest of the call is fine. */
export const BLOCKED_BODY_FIELDS: Readonly<
  Record<string, Readonly<Record<string, readonly string[]>>>
> = {
  // Changing your own password from the profile page.
  "/api/profile": { PATCH: ["currentPassword", "newPassword"] },
  // Left out, a new hire gets a generated password emailed to them - the normal path.
  "/api/employees": { POST: ["password"] },
}

/** The first body field this call may not send, or null. */
export function blockedBodyField(
  routePattern: string,
  method: string,
  body: unknown,
): string | null {
  const fields = BLOCKED_BODY_FIELDS[routePattern]?.[method]
  if (!fields || !body || typeof body !== "object") return null
  return fields.find((f) => (body as Record<string, unknown>)[f] !== undefined) ?? null
}

/** Why a route pattern is off-limits, or null if it is allowed. */
export function exclusionReason(routePattern: string, method?: string): string | null {
  for (const [re, reason] of EXCLUDED_API_PATHS) {
    if (re.test(routePattern)) return reason
  }
  if (method && BLOCKED_API_METHODS[routePattern]?.includes(method)) {
    return "it would reveal a stored secret"
  }
  return null
}
