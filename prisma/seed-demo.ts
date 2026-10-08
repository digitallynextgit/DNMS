/**
 * Builds the "demo" company (made-up people and work, dated relative to today) for Help & Guides screenshots.
 *   pnpm db:demo            # (re)build it from scratch
 *   pnpm db:demo --remove   # delete it and stop
 * Safety: DATABASE_URL is the shared production database. This only deletes the tenant whose slug is exactly
 * "demo", writes rows stamped with the demo tenant id (plus users for demo-domain addresses), and never uploads,
 * mails or notifies. Needs DEMO_PASSWORD in .env; use the pnpm script (@/server/db needs react-server).
 */
import "dotenv/config"
import bcrypt from "bcryptjs"
import { db } from "@/server/db"
import { FOUNDING_TENANT_ID, runUnscoped, runWithTenant } from "@/server/tenant-context"
import { TENANT_GUARD_INFO } from "@/server/tenant-guard"
import { isValidSlug } from "@/server/tenants"
import { deprovisionTenant, provisionTenant } from "@/features/tenants/server/provision.service"
import { DEMO_EMAIL_DOMAIN, DEMO_TENANT_NAME, DEMO_TENANT_SLUG, isDemoEmail } from "@/lib/demo"
import { DEMO_PEOPLE, DEMO_PERSONAS, demoPerson } from "@/features/help/demo/dataset"
import { Summary, istToday, makeRng, type DemoContext } from "./demo/context"
import { seedOrganisation } from "./demo/org"
import { seedHolidays, seedTimeOff } from "./demo/timeoff"
import { seedAttendance } from "./demo/attendance"
import { seedPayroll } from "./demo/payroll"
import { seedPerformance } from "./demo/performance"
import { seedHrProcesses } from "./demo/hr-processes"
import { seedRecruitment } from "./demo/recruitment"
import { seedCompany } from "./demo/company"
import { seedClientAccess, seedClients } from "./demo/clients"
import { seedProjects } from "./demo/projects"
import { seedTasks } from "./demo/tasks"
import { seedAiConnection, seedDevices, seedNotifications } from "./demo/extras"
import { tenantCounts } from "./demo/counts"

const REMOVE = process.argv.includes("--remove")

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`)
  process.exit(1)
}

/** Remove the demo company if it exists. Returns how many rows went. */
async function removeDemoTenant(): Promise<number | null> {
  const existing = await runUnscoped("demo seed: find the demo tenant", () =>
    db.tenant.findUnique({ where: { slug: DEMO_TENANT_SLUG }, select: { id: true, slug: true } }),
  )
  if (!existing) return null
  // Belt and braces on top of deprovisionTenant's own founding-tenant check.
  if (existing.id === FOUNDING_TENANT_ID || existing.slug !== DEMO_TENANT_SLUG) {
    fail(`Refusing to remove tenant ${existing.slug} (${existing.id}).`)
  }
  console.log(
    `Removing the existing "${DEMO_TENANT_SLUG}" company. Any "Foreign key constraint violated" lines below are expected: deprovisionTenant retries each table until nothing references it.`,
  )
  const { deleted } = await deprovisionTenant(DEMO_TENANT_SLUG)
  return deleted
}

async function main() {
  const started = Date.now()

  if (DEMO_TENANT_SLUG !== "demo")
    fail(`DEMO_TENANT_SLUG is "${DEMO_TENANT_SLUG}", expected "demo".`)
  if (!isValidSlug(DEMO_TENANT_SLUG)) fail(`"${DEMO_TENANT_SLUG}" is a reserved or invalid slug.`)
  if (TENANT_GUARD_INFO.mode === "off") {
    fail("TENANT_ENFORCEMENT is off. Refusing to seed: the tenant guard must be on.")
  }

  if (REMOVE) {
    const deleted = await removeDemoTenant()
    console.log(
      deleted === null
        ? `No "${DEMO_TENANT_SLUG}" company to remove.`
        : `Removed the "${DEMO_TENANT_SLUG}" company (${deleted} rows).`,
    )
    return
  }

  const password = process.env.DEMO_PASSWORD
  if (!password) {
    fail(
      'DEMO_PASSWORD is not set. Add DEMO_PASSWORD="<a long random password>" to .env - it becomes the password of every demo login.',
    )
  }
  if (password.length < 12) fail("DEMO_PASSWORD must be at least 12 characters.")
  for (const p of DEMO_PEOPLE) {
    if (!isDemoEmail(p.email)) fail(`${p.email} is not on ${DEMO_EMAIL_DOMAIN}.`)
  }

  const removed = await removeDemoTenant()
  if (removed !== null) console.log(`Removed the previous demo company (${removed} rows).`)

  const admin = demoPerson(DEMO_PERSONAS.admin)
  const provisioned = await provisionTenant({
    companyName: DEMO_TENANT_NAME,
    slug: DEMO_TENANT_SLUG,
    adminFirstName: admin.firstName,
    adminLastName: admin.lastName,
    adminEmail: admin.email,
    adminPassword: password,
    plan: "ENTERPRISE",
  })
  console.log(`Provisioned "${DEMO_TENANT_NAME}" (${provisioned.slug}, ${provisioned.tenantId}).`)
  if (provisioned.tenantId === FOUNDING_TENANT_ID)
    fail("Provisioning returned the founding tenant id.")

  const passwordHash = await bcrypt.hash(password, 12)
  const now = new Date()
  const ctx: DemoContext = {
    tenantId: provisioned.tenantId,
    slug: provisioned.slug,
    today: istToday(now),
    now,
    emp: {},
    dept: {},
    role: {},
    project: {},
    team: {},
    client: {},
    ref: {},
    holidayKeys: new Set(),
    holidayNames: new Map(),
    leaveType: {},
    floatingHoliday: new Map(),
    away: {},
    attendance: {},
    rand: makeRng(20261007),
    summary: new Summary(),
  }

  await runWithTenant({ tenantId: ctx.tenantId, slug: ctx.slug }, async () => {
    const roles = await db.role.findMany({ select: { id: true, name: true } })
    for (const r of roles) ctx.role[r.name] = r.id

    const step = async (name: string, fn: () => Promise<void>) => {
      const t = Date.now()
      process.stdout.write(`  ${name.padEnd(28)}`)
      await fn()
      console.log(`${((Date.now() - t) / 1000).toFixed(1)}s`)
    }
    console.log("Seeding:")
    await step("holidays", () => seedHolidays(ctx))
    await step("organisation + logins", () =>
      seedOrganisation(ctx, { passwordHash, adminEmployeeId: provisioned.employeeId }),
    )
    await step("attendance devices", () => seedDevices(ctx))
    await step("leave, WFH, floating", () => seedTimeOff(ctx))
    await step("attendance", () => seedAttendance(ctx))
    await step("payroll", () => seedPayroll(ctx))
    await step("performance", () => seedPerformance(ctx))
    await step("onboarding / exit / stock", () => seedHrProcesses(ctx))
    await step("recruitment + referrals", () => seedRecruitment(ctx))
    await step("company (news, chat...)", () => seedCompany(ctx))
    await step("clients", () => seedClients(ctx))
    await step("projects", () => seedProjects(ctx))
    await step("client portal access", () => seedClientAccess(ctx, passwordHash))
    await step("tasks", () => seedTasks(ctx))
    await step("notifications", () => seedNotifications(ctx))
    await step("AI connection", () => seedAiConnection(ctx))
  })

  ctx.summary.print()

  const counts = await tenantCounts(DEMO_TENANT_SLUG)
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0
  console.log(`\nDemo company: ${total} rows in ${counts ? Object.keys(counts).length : 0} tables.`)
  console.log(`Sign in at /login with DEMO_PASSWORD (from .env):`)
  for (const [persona, key] of Object.entries(DEMO_PERSONAS)) {
    const p = demoPerson(key)
    console.log(`  ${persona.padEnd(9)} ${p.firstName} ${p.lastName} <${p.email}>`)
  }
  console.log(`  client    Nandini Rao <nandini.rao@${DEMO_EMAIL_DOMAIN}> (portal)`)
  console.log(`\nDone in ${((Date.now() - started) / 1000).toFixed(0)}s.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
