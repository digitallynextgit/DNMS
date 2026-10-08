import "server-only"

import { readFileSync } from "fs"
import { getConfig } from "@/server/app-config"

// Service account per purpose: <PURPOSE>_CREDENTIALS (inline JSON), then <PURPOSE>_KEY_FILE, then the
// Drive credentials (one account can be granted on GSC and GA4 too). The account needs the API
// enabled on its own Cloud project and access on each property.

export type GooglePurpose = "GSC" | "GA4"

export interface GoogleCredentials {
  client_email: string
  private_key: string
  project_id?: string
}

function parse(raw: string): GoogleCredentials | null {
  try {
    const j = JSON.parse(raw)
    if (j?.client_email && j?.private_key) return j as GoogleCredentials
  } catch {
    /* not JSON */
  }
  return null
}

function fromFile(path: string): GoogleCredentials | null {
  try {
    return parse(readFileSync(path, "utf8"))
  } catch {
    return null
  }
}

export async function readGoogleCredentials(
  purpose: GooglePurpose,
): Promise<GoogleCredentials | null> {
  const candidates: (string | undefined)[] = await Promise.all([
    getConfig(`${purpose}_CREDENTIALS`),
    getConfig("GOOGLE_DRIVE_CREDENTIALS"),
  ])
  for (const raw of candidates) {
    if (!raw) continue
    const c = parse(raw)
    if (c) return c
  }

  const paths: (string | undefined)[] = await Promise.all([
    getConfig(`${purpose}_KEY_FILE`),
    getConfig("GOOGLE_DRIVE_KEY_FILE"),
  ])
  for (const p of paths) {
    if (!p) continue
    const c = fromFile(p)
    if (c) return c
  }
  return null
}

export async function googleServiceAccountEmail(purpose: GooglePurpose): Promise<string | null> {
  return (await readGoogleCredentials(purpose))?.client_email ?? null
}
