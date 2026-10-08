import "server-only"

import { z } from "zod"
import { db } from "@/server/db"
import { LIFETIME, TOKEN_PREFIX } from "../constants"
import { generateToken } from "./tokens"
import { isAllowedRedirect } from "./redirects"
import { UnsafeUrlError, assertPublicHost } from "./safe-fetch"

// OAuth clients. CIMD (preferred): client_id is an https URL serving JSON metadata, fetched and
// cached for 24h. DCR (deprecated, for older agents): the app registers via /api/oauth/register.

export interface ResolvedClient {
  clientId: string
  kind: "cimd" | "dcr"
  name: string
  clientUri: string | null
  redirectUris: string[]
}

export class ClientError extends Error {
  constructor(
    message: string,
    public readonly code: "invalid_client" | "invalid_client_metadata" | "invalid_redirect_uri",
  ) {
    super(message)
  }
}

const MAX_DOC_BYTES = 64 * 1024

const cimdSchema = z
  .object({
    client_id: z.string(),
    client_name: z.string().max(200).optional(),
    client_uri: z.string().max(500).optional(),
    redirect_uris: z.array(z.string().max(2000)).min(1).max(30),
  })
  .passthrough()

export function looksLikeCimdClientId(clientId: string): boolean {
  return /^https:\/\//i.test(clientId)
}

/** Find (and if needed fetch/refresh) the client behind a client_id. */
export async function resolveClient(clientId: string): Promise<ResolvedClient> {
  if (!clientId || clientId.length > 2000) {
    throw new ClientError("Missing or invalid client_id", "invalid_client")
  }

  const existing = await db.oAuthClient.findUnique({ where: { clientId } })

  if (looksLikeCimdClientId(clientId)) {
    const fresh =
      existing?.fetchedAt && Date.now() - existing.fetchedAt.getTime() < LIFETIME.CIMD_CACHE_MS
    if (existing && fresh) return toResolved(existing)
    try {
      return await fetchAndStoreCimd(clientId)
    } catch (err) {
      // Metadata host down: use the last good copy. A client we've never seen fails.
      if (existing) return toResolved(existing)
      throw err
    }
  }

  if (!existing || existing.kind !== "dcr") {
    throw new ClientError("Unknown client_id", "invalid_client")
  }
  return toResolved(existing)
}

function toResolved(row: {
  clientId: string
  kind: string
  name: string
  clientUri: string | null
  redirectUris: string[]
}): ResolvedClient {
  return {
    clientId: row.clientId,
    kind: row.kind === "dcr" ? "dcr" : "cimd",
    name: row.name,
    clientUri: row.clientUri,
    redirectUris: row.redirectUris,
  }
}

async function fetchAndStoreCimd(clientId: string): Promise<ResolvedClient> {
  const url = new URL(clientId)
  if (url.protocol !== "https:" || url.pathname === "/" || url.hash) {
    throw new ClientError("client_id URL must be https with a path", "invalid_client")
  }
  await assertPublicClientHost(url.hostname)

  let res: Response
  try {
    res = await fetch(url, {
      headers: { accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    })
  } catch {
    throw new ClientError("Could not fetch the app's metadata document", "invalid_client")
  }
  if (!res.ok) {
    throw new ClientError(`The app's metadata document returned ${res.status}`, "invalid_client")
  }
  const text = await readCapped(res, MAX_DOC_BYTES)

  let doc: unknown
  try {
    doc = JSON.parse(text)
  } catch {
    throw new ClientError("The app's metadata document is not JSON", "invalid_client")
  }
  const parsed = cimdSchema.safeParse(doc)
  if (!parsed.success) {
    throw new ClientError("The app's metadata document is incomplete", "invalid_client")
  }
  // The document must name itself - otherwise any page could claim to be Claude.
  if (parsed.data.client_id !== clientId) {
    throw new ClientError("The app's metadata document names a different client", "invalid_client")
  }

  const name = (parsed.data.client_name || url.hostname).trim().slice(0, 200)
  const data = {
    kind: "cimd",
    name,
    clientUri: parsed.data.client_uri ?? null,
    redirectUris: parsed.data.redirect_uris,
    metadata: parsed.data as never,
    fetchedAt: new Date(),
  }
  const row = await db.oAuthClient.upsert({
    where: { clientId },
    create: { clientId, ...data },
    update: data,
  })
  return toResolved(row)
}

/** Read a response body, refusing anything larger than `max` bytes. */
async function readCapped(res: Response, max: number): Promise<string> {
  const reader = res.body?.getReader()
  if (!reader) return ""
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > max) {
      await reader.cancel()
      throw new ClientError("The app's metadata document is too large", "invalid_client")
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks).toString("utf8")
}

// SSRF guard: the client_id URL is attacker-chosen (see ./safe-fetch).
async function assertPublicClientHost(hostname: string): Promise<void> {
  try {
    await assertPublicHost(hostname)
  } catch (err) {
    if (err instanceof UnsafeUrlError) {
      throw new ClientError(`The app's metadata host problem: ${err.message}`, "invalid_client")
    }
    throw err
  }
}

// Dynamic Client Registration (RFC 7591). Open by design: registering grants nothing - a person
// still has to sign in and click Allow, and redirect URIs must pass the allowlist.
const dcrSchema = z
  .object({
    redirect_uris: z.array(z.string().max(2000)).min(1).max(20),
    client_name: z.string().max(200).optional(),
    client_uri: z.string().max(500).optional(),
    grant_types: z.array(z.string()).optional(),
    response_types: z.array(z.string()).optional(),
    token_endpoint_auth_method: z.string().optional(),
    scope: z.string().optional(),
  })
  .passthrough()

export async function registerDynamicClient(body: unknown) {
  const parsed = dcrSchema.safeParse(body)
  if (!parsed.success) {
    throw new ClientError("redirect_uris is required", "invalid_client_metadata")
  }
  const meta = parsed.data
  for (const uri of meta.redirect_uris) {
    if (!isAllowedRedirect(uri)) {
      throw new ClientError(
        `Redirect URI not allowed by this server: ${uri}`,
        "invalid_redirect_uri",
      )
    }
  }
  const unsupported = (meta.grant_types ?? []).filter(
    (g) => g !== "authorization_code" && g !== "refresh_token",
  )
  if (unsupported.length) {
    throw new ClientError(
      `Unsupported grant_types: ${unsupported.join(", ")}`,
      "invalid_client_metadata",
    )
  }

  const clientId = generateToken(TOKEN_PREFIX.DCR_CLIENT)
  const name = (meta.client_name || "AI app").trim().slice(0, 200)
  const row = await db.oAuthClient.create({
    data: {
      clientId,
      kind: "dcr",
      name,
      clientUri: meta.client_uri ?? null,
      redirectUris: meta.redirect_uris,
      metadata: meta as never,
    },
  })

  // Public client: we never issue a secret, whatever was asked for.
  return {
    client_id: row.clientId,
    client_id_issued_at: Math.floor(row.createdAt.getTime() / 1000),
    client_name: row.name,
    redirect_uris: row.redirectUris,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  }
}
