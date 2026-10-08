// The demo workspace: a fake company for the Help screenshots (`pnpm db:demo`, `pnpm help:shots`).
// Demo emails use the reserved `.invalid` domain and lib/mailer.ts drops them, so no job can mail them.

export const DEMO_TENANT_SLUG = "demo"
export const DEMO_TENANT_NAME = "Demo Company"
export const DEMO_EMAIL_DOMAIN = "demo.dnms.invalid"

/** Accepts a bare address or the `Name <addr>` form. */
export function isDemoEmail(address: string): boolean {
  return address.trim().toLowerCase().replace(/>$/, "").endsWith(`@${DEMO_EMAIL_DOMAIN}`)
}
