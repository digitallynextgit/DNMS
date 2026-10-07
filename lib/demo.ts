// =============================================================================
// The demo workspace - a separate company filled with made-up people and data.
//
// It exists so the Help & Guides screenshots (features/help) never show a real
// salary, leave reason or phone number. It is seeded by `pnpm db:demo`
// (prisma/seed-demo.ts) and photographed by `pnpm help:shots`.
//
// Every demo person's email is on DEMO_EMAIL_DOMAIN. `.invalid` is reserved
// (RFC 2606) and can never receive mail, and lib/mailer.ts drops these
// addresses before anything is sent - so the scheduled jobs that run for every
// company (task reminders, birthdays, digests) cannot email a demo person, and
// nothing bounces against our sending reputation.
// =============================================================================

export const DEMO_TENANT_SLUG = "demo"
export const DEMO_TENANT_NAME = "Demo Company"
export const DEMO_EMAIL_DOMAIN = "demo.dnms.invalid"

/** True for an address on the demo domain - bare or `Name <addr>` form. */
export function isDemoEmail(address: string): boolean {
  return address.trim().toLowerCase().replace(/>$/, "").endsWith(`@${DEMO_EMAIL_DOMAIN}`)
}
