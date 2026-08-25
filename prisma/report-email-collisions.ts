/**
 * M2 pre-flight: email collisions between staff and portal-client logins.
 *
 *   npx tsx prisma/report-email-collisions.ts
 *
 * READ-ONLY. Writes nothing, decides nothing.
 *
 * WHY THIS RUNS FIRST
 * M2 lifts credentials out of `employees` and `client_users` into one platform
 * `User` keyed by email, with a `Membership` per (user, tenant, kind). That merge
 * is only safe where one address means one human. Two cases it cannot decide by
 * itself:
 *
 *   - SAME HUMAN, two rows (a staff member who also has portal access). Merging
 *     is correct: one login, two memberships.
 *   - DIFFERENT HUMANS sharing an inbox (info@, accounts@, a shared agency
 *     mailbox). Merging would hand one person the other's session. These have to
 *     be split - a distinct address or a per-kind login - BEFORE M2 runs.
 *
 * Nothing but a human can tell those apart, so this prints the evidence and stops.
 *
 * Three surfaces are checked, because M2 keys on the address, not the column:
 *   1. employees.email        vs client_users.email
 *   2. employees.personal_email vs client_users.email
 *   3. duplicates within each table under case-folding (Postgres unique indexes
 *      are case-SENSITIVE, so "A@x.com" and "a@x.com" coexist today and would
 *      collide the moment M2 lower-cases addresses)
 */
import "dotenv/config"
import { db as prisma } from "@/server/db"

interface Row {
  email: string
  emp_id: string
  emp_name: string
  emp_no: string
  emp_status: string
  emp_active: boolean
  emp_has_pw: boolean
  emp_matched_on: string
  cli_id: string
  cli_name: string
  cli_company: string | null
  cli_active: boolean
  cli_has_pw: boolean
  cli_last_login: Date | null
}

const line = (n = 78) => console.log("─".repeat(n))

async function main() {
  console.log("\nEMAIL COLLISION REPORT — staff vs portal clients")
  line()

  const [{ employees, clients }] = await prisma.$queryRaw<
    { employees: bigint; clients: bigint }[]
  >`SELECT (SELECT COUNT(*) FROM employees)::bigint    AS employees,
           (SELECT COUNT(*) FROM client_users)::bigint AS clients`
  console.log(`${employees} employees · ${clients} client users\n`)

  // ---- 1 + 2. Cross-table collisions, case-insensitive -----------------------
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT lower(c.email)                                   AS email,
           e.id                                             AS emp_id,
           e.first_name || ' ' || e.last_name               AS emp_name,
           e.employee_no                                    AS emp_no,
           e.status::text                                   AS emp_status,
           e.is_active                                      AS emp_active,
           (e.password_hash IS NOT NULL)                    AS emp_has_pw,
           CASE WHEN lower(e.email) = lower(c.email)
                THEN 'work email' ELSE 'personal email' END AS emp_matched_on,
           c.id                                             AS cli_id,
           c.name                                           AS cli_name,
           c.company                                        AS cli_company,
           c.is_active                                      AS cli_active,
           (c.password_hash IS NOT NULL)                    AS cli_has_pw,
           c.last_login_at                                  AS cli_last_login
      FROM client_users c
      JOIN employees e
        ON lower(e.email) = lower(c.email)
        OR lower(e.personal_email) = lower(c.email)
     ORDER BY 1`

  if (rows.length === 0) {
    console.log("✓ No address is used by both an employee and a client user.")
    console.log("  The M2 merge has nothing to decide — every address is one human.\n")
  } else {
    console.log(`⚠ ${rows.length} collision(s). Each needs a human call:\n`)
    for (const r of rows) {
      console.log(`  ${r.email}   (matched on the employee's ${r.emp_matched_on})`)
      console.log(
        `    staff   ${r.emp_name} · ${r.emp_no} · ${r.emp_status}` +
          `${r.emp_active ? "" : " · DEACTIVATED"}${r.emp_has_pw ? " · has password" : " · no password set"}`,
      )
      console.log(
        `    client  ${r.cli_name}${r.cli_company ? ` · ${r.cli_company}` : ""}` +
          `${r.cli_active ? "" : " · DEACTIVATED"}${r.cli_has_pw ? " · has password" : " · no password set"}` +
          ` · last login ${r.cli_last_login ? r.cli_last_login.toISOString().slice(0, 10) : "never"}`,
      )
      console.log(
        `    → same person?  MERGE (one login, two memberships)` +
          `\n    → two people?   SPLIT before M2 (give one of them a distinct address)\n`,
      )
    }
  }

  // ---- 3. Case-only duplicates inside one table ------------------------------
  line()
  console.log("Case-only duplicates (invisible to today's case-sensitive unique index)\n")
  for (const table of ["employees", "client_users"] as const) {
    const dupes = await prisma.$queryRawUnsafe<{ folded: string; variants: string }[]>(
      `SELECT lower(email) AS folded, string_agg(email, ' | ' ORDER BY email) AS variants
         FROM "${table}" GROUP BY lower(email) HAVING COUNT(*) > 1 ORDER BY 1`,
    )
    if (dupes.length === 0) console.log(`  ✓ ${table}: none`)
    else {
      console.log(`  ⚠ ${table}: ${dupes.length}`)
      for (const d of dupes) console.log(`      ${d.variants}`)
    }
  }

  // employees.personal_email colliding with any employees.email
  const selfDupes = await prisma.$queryRaw<{ email: string; a: string; b: string }[]>`
    SELECT lower(a.personal_email) AS email,
           a.first_name || ' ' || a.last_name AS a,
           b.first_name || ' ' || b.last_name AS b
      FROM employees a
      JOIN employees b ON lower(a.personal_email) = lower(b.email) AND a.id <> b.id`
  if (selfDupes.length === 0)
    console.log("  ✓ employees: no personal email equals another's work email")
  else {
    console.log(`  ⚠ employees: ${selfDupes.length} personal/work email crossover`)
    for (const d of selfDupes) console.log(`      ${d.email}: ${d.a}'s personal = ${d.b}'s work`)
  }

  line()
  console.log(
    rows.length === 0
      ? "VERDICT: clear. M2 can key on email with no manual merges.\n"
      : "VERDICT: resolve the collisions above before M2 rewrites the auth flows.\n",
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
