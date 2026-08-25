/**
 * M2 login parity - READ-ONLY.
 *
 *   npx tsx prisma/verify-login-parity.ts
 *
 * The M2 rewrite replaced the sign-in path. This proves the replacement is
 * equivalent: for EVERY real account, the new path produces exactly the session
 * the old path produced - same id, same kind, same roles, same permission
 * scopes, same display fields.
 *
 * The one step not re-run here is `bcrypt.compare`, and it does not need to be:
 * prisma/verify-identity.ts proves users.password_hash is byte-identical to the
 * legacy column, and both paths pass it to the same bcrypt call. What is
 * genuinely new - the email lookup, the membership resolution, and the token
 * hydration - is exercised end to end below, per account.
 *
 * OLD PATH (reconstructed from git history, not imported - the point is to
 * compare against what the code USED to do, so it is spelled out here):
 *   employees.findUnique({ email }) → id, employeeNo, firstName, lastName,
 *   profilePhoto, mustChangePassword; roles/permissions via employeeRoles.
 *
 * NEW PATH: findLoginUser(email) → loadActiveMemberships → pick STAFF/CLIENT →
 *   hydrate from the membership's profile row.
 */
import "dotenv/config"
import { db as prisma } from "@/server/db"
import { runUnscoped } from "@/server/tenant-context"
import { findLoginUser, loadActiveMemberships } from "@/server/identity"

let failures = 0
const bad = (s: string) => {
  console.log(`  ✗ ${s}`)
  failures++
}

interface TokenShape {
  id: string
  kind: string
  employeeNo: string
  firstName: string
  lastName: string
  company: string | null
  profilePhoto: string | null
  roles: string
  permissions: string
  mustChangePassword: boolean
}

/** What server/auth.ts produced BEFORE M2, for a staff sign-in. */
async function oldStaffToken(email: string): Promise<TokenShape | null> {
  const employee = await prisma.employee.findUnique({
    where: { email },
    include: {
      employeeRoles: {
        include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
      },
    },
    omit: { passwordHash: false },
  })
  // The old guard was `!employee || !employee.passwordHash || !employee.isActive`.
  // The password-hash clause matters: a Google-only account (no hash) could never
  // sign in with a password, and must still not be able to.
  if (!employee?.isActive || !employee.passwordHash) return null
  return {
    id: employee.id,
    kind: "employee",
    employeeNo: employee.employeeNo,
    firstName: employee.firstName,
    lastName: employee.lastName,
    company: null,
    profilePhoto: employee.profilePhoto ?? null,
    roles: employee.employeeRoles
      .map((er) => er.role.name)
      .sort()
      .join(","),
    permissions: Array.from(
      new Set(
        employee.employeeRoles.flatMap((er) =>
          er.role.rolePermissions.map((rp) => rp.permission.scope),
        ),
      ),
    )
      .sort()
      .join(","),
    mustChangePassword: employee.mustChangePassword,
  }
}

/** What server/auth.ts produced BEFORE M2, for a client sign-in. */
async function oldClientToken(email: string): Promise<TokenShape | null> {
  const client = await prisma.clientUser.findUnique({ where: { email } })
  if (!client?.isActive) return null
  return {
    id: client.id,
    kind: "client",
    employeeNo: "",
    firstName: client.name,
    lastName: "",
    company: client.company ?? null,
    profilePhoto: null,
    roles: "",
    permissions: "",
    mustChangePassword: client.mustChangePassword,
  }
}

/**
 * What server/auth.ts produces NOW. Mirrors authorizeWithIdentity() +
 * hydrateFromMembership() exactly, minus the bcrypt step.
 */
async function newToken(email: string, prefer: "STAFF" | "CLIENT"): Promise<TokenShape | null> {
  const user = await findLoginUser(email)
  if (!user) return null
  if (!user.passwordHash || !user.isActive) return null

  const memberships = await loadActiveMemberships(user.id)
  if (memberships.length === 0) return null
  const preferred = memberships.filter((m) => m.kind === prefer)
  const membership = (preferred.length > 0 ? preferred : memberships)[0]
  if (!membership) return null

  if (membership.kind === "CLIENT") {
    const client = await prisma.clientUser.findUnique({ where: { id: membership.profileId } })
    if (!client) return null
    return {
      id: client.id,
      kind: "client",
      employeeNo: "",
      firstName: client.name,
      lastName: "",
      company: client.company ?? null,
      profilePhoto: null,
      roles: "",
      permissions: "",
      mustChangePassword: user.mustChangePassword,
    }
  }

  const employee = await prisma.employee.findUnique({
    where: { id: membership.profileId },
    include: {
      employeeRoles: {
        include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
      },
    },
  })
  if (!employee) return null
  return {
    id: employee.id,
    kind: "employee",
    employeeNo: employee.employeeNo,
    firstName: employee.firstName,
    lastName: employee.lastName,
    company: null,
    profilePhoto: employee.profilePhoto ?? null,
    roles: employee.employeeRoles
      .map((er) => er.role.name)
      .sort()
      .join(","),
    permissions: Array.from(
      new Set(
        employee.employeeRoles.flatMap((er) =>
          er.role.rolePermissions.map((rp) => rp.permission.scope),
        ),
      ),
    )
      .sort()
      .join(","),
    mustChangePassword: user.mustChangePassword,
  }
}

function diff(who: string, old: TokenShape | null, next: TokenShape | null): boolean {
  if (old === null && next === null) return true
  if (old === null || next === null) {
    bad(`${who}: old=${old ? "signs in" : "rejected"} new=${next ? "signs in" : "rejected"}`)
    return false
  }
  let same = true
  for (const key of Object.keys(old) as (keyof TokenShape)[]) {
    if (old[key] !== next[key]) {
      bad(`${who}: ${key}\n      old: ${String(old[key])}\n      new: ${String(next[key])}`)
      same = false
    }
  }
  return same
}

async function main() {
  console.log("\nLOGIN PARITY - old sign-in path vs new, per account")
  console.log("─".repeat(78))

  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    select: { email: true, employeeNo: true },
    orderBy: { employeeNo: "asc" },
  })
  let staffOk = 0
  let passwordless = 0
  for (const e of employees) {
    const [old, next] = await Promise.all([oldStaffToken(e.email), newToken(e.email, "STAFF")])
    // Both null = an account with no password (Google-only). Agreeing that it
    // cannot use a password IS parity, so count it and move on.
    if (old === null && next === null) {
      passwordless++
      staffOk++
      console.log(`  · ${e.employeeNo} ${e.email}: no password on either path (Google-only)`)
      continue
    }
    if (diff(`${e.employeeNo} ${e.email}`, old, next)) staffOk++
  }
  console.log(
    `  ${staffOk}/${employees.length} active employees: identical session` +
      (passwordless ? ` (${passwordless} password-less, rejected by both)` : ""),
  )

  const clients = await prisma.clientUser.findMany({
    where: { isActive: true },
    select: { email: true },
  })
  let clientOk = 0
  for (const c of clients) {
    const [old, next] = await Promise.all([oldClientToken(c.email), newToken(c.email, "CLIENT")])
    if (next === null) {
      bad(`${c.email}: the NEW path cannot sign them in`)
      continue
    }
    if (diff(c.email, old, next)) clientOk++
  }
  console.log(`  ${clientOk}/${clients.length} active client users: identical session`)

  // Deactivated accounts must be rejected by the new path, as before.
  console.log("\nDeactivated accounts stay locked out")
  const inactive = await prisma.employee.findMany({
    where: { isActive: false },
    select: { email: true, employeeNo: true },
  })
  let lockedOut = 0
  for (const e of inactive) {
    const next = await newToken(e.email, "STAFF")
    if (next === null) lockedOut++
    else bad(`${e.employeeNo} ${e.email} is deactivated but the new path signs them in`)
  }
  console.log(`  ${lockedOut}/${inactive.length} deactivated employees rejected`)

  // A password-less account signs in with Google, and the M2 signIn callback
  // gates that on findLoginUser + an active STAFF membership - deliberately NOT
  // on a password hash. Prove that door is still open for them.
  console.log("\nGoogle sign-in still resolves for password-less accounts")
  const noPassword = await prisma.employee.findMany({
    where: { isActive: true, passwordHash: null },
    select: { email: true, employeeNo: true },
  })
  for (const e of noPassword) {
    const user = await findLoginUser(e.email)
    const staff = user
      ? (await loadActiveMemberships(user.id)).filter((m) => m.kind === "STAFF")
      : []
    if (!user || staff.length === 0) {
      bad(`${e.employeeNo} ${e.email}: Google sign-in would now be refused`)
    } else {
      console.log(`  ✓ ${e.employeeNo} ${e.email}: identity + STAFF membership resolve`)
    }
  }

  // The one-login-point promise: a client typing their address into the STAFF
  // form must still land as a client, not be refused.
  console.log("\nOne login point: a client using /login")
  for (const c of clients) {
    const viaStaffForm = await newToken(c.email, "STAFF")
    if (viaStaffForm?.kind !== "client") {
      bad(`${c.email} via /login resolved to ${viaStaffForm?.kind ?? "nothing"}, expected client`)
    } else {
      console.log(`  ✓ ${c.email} signs in through /login and resolves as a client`)
    }
  }

  console.log("─".repeat(78))
  console.log(
    failures === 0
      ? "PARITY CONFIRMED. Every account gets the same session it did before M2.\n"
      : `${failures} difference(s) found - DO NOT DEPLOY.\n`,
  )
  process.exitCode = failures === 0 ? 0 : 1
}

runUnscoped("verification: compares every account on the platform", main)
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
