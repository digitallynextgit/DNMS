// =============================================================================
// The "signed in?" hint for the PUBLIC marketing pages.
//
// The marketing pages are static HTML, so nothing in them can know who is
// visiting, and the real session cookie is httpOnly. Asking /api/auth/session
// after hydration worked, but the header showed "Log in / Start free" until
// that round trip landed and only then swapped to "Dashboard".
//
// Instead proxy.ts, which decodes the session on every request anyway, keeps
// this READABLE cookie in step on each marketing-page response. Because it
// rides on the document response itself, it is already set when
// public/theme-boot.js runs in <head>; that script copies it onto
// <html data-auth>, and globals.css shows the matching buttons on the very
// first paint.
//
// It is a display hint only - it unlocks nothing. Every real check still reads
// the session itself.
//
// No framework imports: read by the Edge proxy and client components alike,
// and MIRRORED by public/theme-boot.js, which cannot import.
// =============================================================================

export const AUTH_HINT_COOKIE = "dnms-auth"

export type AuthHint = "employee" | "client"

/** Parse a raw cookie value; anything unexpected reads as signed out. */
export function parseAuthHint(value: string | null | undefined): AuthHint | null {
  return value === "employee" || value === "client" ? value : null
}

/** Where a signed-in visitor's app lives. */
export function appHomeFor(hint: AuthHint | null): string {
  return hint === "client" ? "/portal" : "/dashboard"
}
