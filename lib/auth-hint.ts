// Readable "signed in?" cookie for the static marketing pages. proxy.ts keeps it in sync so the
// header shows the right buttons on first paint. Display hint only - it unlocks nothing.
// Mirrored in public/theme-boot.js (which can't import), so keep the two in step.

export const AUTH_HINT_COOKIE = "dnms-auth"

export type AuthHint = "employee" | "client"

/** Anything unexpected reads as signed out. */
export function parseAuthHint(value: string | null | undefined): AuthHint | null {
  return value === "employee" || value === "client" ? value : null
}

export function appHomeFor(hint: AuthHint | null): string {
  return hint === "client" ? "/portal" : "/dashboard"
}
