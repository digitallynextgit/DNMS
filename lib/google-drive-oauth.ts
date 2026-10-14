import "server-only"

import { createHash } from "node:crypto"
import { google, type drive_v3 } from "googleapis"
import { db } from "@/server/db"
import { encrypt } from "@/lib/crypto"
import { getConfig, reloadConfig } from "@/server/app-config"

// The Google account DNMS stores Repository files in, connected once from Admin -> Integrations.
// drive.file only: DNMS sees the files it created, never the rest of the account's Drive.

export const DRIVE_OAUTH_SCOPES = ["https://www.googleapis.com/auth/drive.file"]
export const DRIVE_CALLBACK_PATH = "/api/integrations/google-drive/callback"
/** Ties the callback to the browser that clicked Connect. */
export const DRIVE_STATE_COOKIE = "dnms_gdrive_state"

const CLIENT_ID = "GOOGLE_DRIVE_CLIENT_ID"
const CLIENT_SECRET = "GOOGLE_DRIVE_CLIENT_SECRET"
const REFRESH_TOKEN = "GOOGLE_DRIVE_REFRESH_TOKEN"
const ACCOUNT = "GOOGLE_DRIVE_ACCOUNT"

export interface DriveAccount {
  email: string
  name: string | null
  photo: string | null
  connectedAt: string
  /** Who clicked Connect, for the audit trail on the card. */
  connectedBy: string | null
}

export async function driveOAuthCredentials(): Promise<{
  clientId: string
  clientSecret: string
} | null> {
  const [clientId, clientSecret] = await Promise.all([
    getConfig(CLIENT_ID),
    getConfig(CLIENT_SECRET),
  ])
  return clientId && clientSecret ? { clientId, clientSecret } : null
}

/** The address the admin is using (nginx passes Host and X-Forwarded-Proto through). */
export function requestOrigin(req: Request): string {
  const url = new URL(req.url)
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(/:$/, "")
  return `${proto}://${host}`
}

/** Google matches the redirect URI exactly, so it is built from the address the admin is using. */
export function driveRedirectUri(req: Request): string {
  return `${requestOrigin(req)}${DRIVE_CALLBACK_PATH}`
}

export async function driveAuthUrl(redirectUri: string, state: string): Promise<string | null> {
  const creds = await driveOAuthCredentials()
  if (!creds) return null
  const client = new google.auth.OAuth2(creds.clientId, creds.clientSecret, redirectUri)
  return client.generateAuthUrl({
    // offline + consent: Google returns a refresh token every time, including on a reconnect.
    access_type: "offline",
    prompt: "consent",
    scope: DRIVE_OAUTH_SCOPES,
    state,
  })
}

/** Swap the one-time code for a refresh token and read whose Drive it is. */
export async function exchangeDriveCode(
  code: string,
  redirectUri: string,
): Promise<{ refreshToken: string; account: Omit<DriveAccount, "connectedAt" | "connectedBy"> }> {
  const creds = await driveOAuthCredentials()
  if (!creds) throw new Error("The Google Drive client ID and secret are not set")
  const client = new google.auth.OAuth2(creds.clientId, creds.clientSecret, redirectUri)
  const { tokens } = await client.getToken(code)
  if (!tokens.refresh_token) {
    throw new Error(
      "Google did not return a refresh token. Remove DNMS from the account's third-party access and connect again.",
    )
  }
  const granted = (tokens.scope ?? "").split(" ")
  if (!DRIVE_OAUTH_SCOPES.every((s) => granted.includes(s))) {
    throw new Error("Drive access was not granted. Tick the Drive box on Google's consent screen.")
  }
  client.setCredentials(tokens)
  const about = await google
    .drive({ version: "v3", auth: client })
    .about.get({ fields: "user(displayName,emailAddress,photoLink)" })
  const user = about.data.user
  if (!user?.emailAddress) throw new Error("Could not read the Google account's email address")
  return {
    refreshToken: tokens.refresh_token,
    account: {
      email: user.emailAddress,
      name: user.displayName ?? null,
      photo: user.photoLink ?? null,
    },
  }
}

export async function saveDriveConnection(
  refreshToken: string,
  account: Omit<DriveAccount, "connectedAt" | "connectedBy">,
  connectedBy: string | null,
): Promise<void> {
  const full: DriveAccount = { ...account, connectedAt: new Date().toISOString(), connectedBy }
  await db.appSetting.upsert({
    where: { key: REFRESH_TOKEN },
    create: { key: REFRESH_TOKEN, value: encrypt(refreshToken), isSecret: true },
    update: { value: encrypt(refreshToken), isSecret: true },
  })
  await db.appSetting.upsert({
    where: { key: ACCOUNT },
    create: { key: ACCOUNT, value: JSON.stringify(full), isSecret: false },
    update: { value: JSON.stringify(full), isSecret: false },
  })
  cached = null
  await reloadConfig()
}

export async function connectedDriveAccount(): Promise<DriveAccount | null> {
  const [token, raw] = await Promise.all([getConfig(REFRESH_TOKEN), getConfig(ACCOUNT)])
  if (!token || !raw) return null
  try {
    return JSON.parse(raw) as DriveAccount
  } catch {
    return null
  }
}

export async function isDriveAccountConnected(): Promise<boolean> {
  return (await connectedDriveAccount()) !== null
}

let cached: { tokenHash: string; drive: drive_v3.Drive } | null = null

/** A Drive client acting as the connected account; null when nothing is connected. */
export async function connectedDrive(): Promise<drive_v3.Drive | null> {
  const [creds, token] = await Promise.all([driveOAuthCredentials(), getConfig(REFRESH_TOKEN)])
  if (!creds || !token) return null
  // Keyed on the token, so a reconnect (new token) never keeps using the old client.
  const tokenHash = createHash("sha256").update(token).digest("hex")
  if (cached?.tokenHash === tokenHash) return cached.drive
  const auth = new google.auth.OAuth2(creds.clientId, creds.clientSecret)
  auth.setCredentials({ refresh_token: token })
  const drive = google.drive({ version: "v3", auth })
  cached = { tokenHash, drive }
  return drive
}

/** Best effort: the account may have removed DNMS already. */
export async function revokeDriveToken(token: string): Promise<void> {
  await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }).toString(),
  }).catch(() => {})
}

/** Revoke at Google, then forget it here. */
export async function disconnectDrive(): Promise<void> {
  const token = await getConfig(REFRESH_TOKEN)
  if (token) await revokeDriveToken(token)
  await db.appSetting.deleteMany({ where: { key: { in: [REFRESH_TOKEN, ACCOUNT] } } })
  cached = null
  await reloadConfig()
}

/** Google's answer when the account revoked DNMS or changed its password: the card asks to reconnect. */
export function isRevokedGrant(error: unknown): boolean {
  const e = error as { message?: string; response?: { data?: { error?: string } } }
  return e?.response?.data?.error === "invalid_grant" || /invalid_grant/.test(e?.message ?? "")
}
