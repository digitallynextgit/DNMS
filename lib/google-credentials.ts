import "server-only"

import { readFileSync } from "fs"
import { getConfig } from "@/server/app-config"

// =============================================================================
// One place that answers "which Google service account do we authenticate as?"
//
// Resolution order for a purpose (GSC, GA4):
//   1. <PURPOSE>_CREDENTIALS   - inline service-account JSON
//   2. <PURPOSE>_KEY_FILE      - path to that JSON
//   3. GOOGLE_DRIVE_CREDENTIALS / GOOGLE_DRIVE_KEY_FILE
//
// The Drive fallback exists because the SAME service account can be granted on
// Search Console properties and GA4 properties - one credential to manage
// instead of three. Set a purpose-specific key only when that product lives in
// a different Cloud project.
//
// Whichever account ends up being used must have (a) the relevant API enabled
// on ITS OWN Cloud project and (b) access granted on each property.
// =============================================================================

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

/** The service-account email to grant access to, or null if none is configured. */
export async function googleServiceAccountEmail(purpose: GooglePurpose): Promise<string | null> {
  return (await readGoogleCredentials(purpose))?.client_email ?? null
}
