# Identity, tenants and roles

Who can do what in DNMS, and why it is built this way. Read this before changing
anything about sign-in, roles, or the platform console.

---

## The two kinds of administrator

This is the distinction that matters, and the one that has caused confusion:

|                                | **Platform admin** (DNMS staff)                   | **Tenant admin** (a customer's admin)                       |
| ------------------------------ | ------------------------------------------------- | ----------------------------------------------------------- |
| Role                           | `admin_`                                          | `admin`                                                     |
| Today                          | SA-002 Diwakar                                    | SA-003 Manpreet (Digitally Next)                            |
| Manages                        | Companies, plans, subscriptions, headcount limits | Their own company only: employees, roles, payroll, projects |
| Reaches `/platform`            | Yes                                               | **Never**                                                   |
| Sees other companies           | Yes, through the platform console                 | **Never**, under any circumstance                           |
| Scopes inside their own tenant | 39 (all)                                          | 39 (all)                                                    |

**The two roles carry identical scopes**, and that is deliberate. Both are full
administrators _of a tenant_. The only difference is that `admin_` may also
administer the platform, which is decided in `server/platform-admin.ts` and
nowhere else.

Before August 2026 that difference lived only in the `PLATFORM_ADMINS`
environment variable, so the two roles were indistinguishable in the database.
The role is now the primary signal; the env list remains as a bootstrap.

### How platform access is granted

`isPlatformAdmin()` requires **all** of:

1. an employee session (never a portal client), **and**
2. `tenantId === FOUNDING_TENANT_ID` (an employee of Digitally Next), **and**
3. either the `admin_` role **or** an email in `PLATFORM_ADMINS`

The env list is kept for two reasons: it is how the _first_ platform admin
exists before anyone can grant the role, and it still works when the role table
is wrong - which is exactly when you need it.

> To make someone DNMS staff: grant them `admin_` in the Digitally Next
> workspace. To remove it: take the role away. No deploy, no env change.

---

## Identity: one person, many companies

```
users                     memberships                    employees
(global identity)         (the tenant boundary)          (tenant-scoped profile)

 id                       userId    ──────────────────►  id
 email      ◄──────────►  tenantId                       tenantId
 passwordHash             kind: STAFF | CLIENT           firstName, lastName
                          profileId ──────────────────►  employeeNo, ...
```

- **`users` is global.** One email, one identity, one password.
- **`memberships` is where the tenant lives.** A person belongs to a company
  _through_ a membership, and can hold more than one.
- **`employees` is the tenant-scoped profile** - the record with a designation,
  a manager, attendance and payslips.

### Why users are global rather than per-tenant

This comes up often enough to write down. The alternative - a `tenant_id` on
`users`, with email unique _per tenant_ - sounds tidier and is worse, because it
breaks sign-in:

> If `priya@acme.com` can exist independently in two companies, then an email
> and a password no longer identify a person. Sign-in has to ask **which
> company** before it can authenticate, which means a workspace selector or a
> per-tenant subdomain in front of the password field.

The current design keeps sign-in as one email and one password. When a person
genuinely belongs to two companies they land on `/select-workspace` _after_
authenticating, which is the same shape Slack and Notion use.

**None of this weakens isolation.** Scoping is enforced on the membership and on
every query, not on the identity row:

- every tenant-scoped table carries a `tenant_id`
- `server/tenant-guard.ts` scopes every Prisma query to the session's tenant and
  **refuses** an unscoped one rather than returning everything
- a deliberate cross-tenant read must say so out loud via `runUnscoped(reason)`

A tenant admin cannot see another company's users, employees or anything else.
That is verified, not assumed - `scripts/verify-tenant-guard.ts` and
`scripts/verify-provisioning.ts` create a second real company and prove neither
can see the other.

---

## The five roles

| Role          | Scopes | Who holds it               | For                                       |
| ------------- | ------ | -------------------------- | ----------------------------------------- |
| `admin_`      | 39     | DNMS staff                 | Everything, plus the platform console     |
| `admin`       | 39     | A customer's administrator | Everything inside their own company       |
| `hr_manager`  | 34     | HR leadership              | People, leave, payroll, recruitment       |
| `hr_employee` | 17     | HR staff                   | People and leave, no payroll              |
| `employee`    | 11     | Everyone                   | Their own records, and company-wide reads |

Roles are **per tenant**. Every company gets its own copy of all five at
provisioning time, with its own `role_permissions` rows. Digitally Next's
`admin` and Acme's `admin` are different database rows that happen to share a
name - which is why the unique index is on `(tenant_id, name)` and not on `name`.

Permissions are granular scopes, not one switch: an `hr_manager` approves leave
without seeing salaries; a project manager runs projects without either.

---

## Working flows

### A new company signs up

1. Someone completes `/signup` (public, no session).
2. `provisionTenant()` creates, in one transaction:
   - the `tenants` row, on the `TRIAL` plan, 21 days, up to 5 employees
   - all five roles with their `role_permissions`
   - four default leave types
   - the founder's `employees` row, their `users` identity, and a `STAFF`
     membership joining the two
   - the founder is granted `admin` - **never** `admin_`
3. They sign in at `/login` and land on `/{slug}/dashboard`.

### DNMS staff manage a customer

1. Sign in as an employee of Digitally Next holding `admin_`.
2. Go to `/platform`. The gate is `getPlatformAdminSession()` in the page
   itself: anyone who fails it gets `notFound()` and never reaches a query.
   `proxy.ts` only requires _a_ session for this route, so the page-level check
   is the whole boundary - do not remove it.

   Verified by role: `admin_` renders the console; `admin`, `employee` and a
   signed-out visitor do not. Note that `notFound()` here answers with a 200
   carrying the not-found body rather than a 404 status. Nothing leaks, but a
   probe that checks only the status code will report a false pass.

3. From there: view companies, change plans, see headcount against the limit.

Deleting a company is `deprovisionTenant(slug)`, which refuses the founding
tenant and sweeps every tenant-scoped table - the list is discovered from
Prisma's runtime model list, so a table added later is covered automatically.

### A customer's admin manages their company

Everything under `/{slug}/...`. They cannot reach `/platform`, and the tenant
guard means they cannot read another company's rows even by guessing an id - a
`findUnique` on a real id belonging to another tenant returns `null`.

### Plans and limits

Defined once in `features/tenants/plans.ts`, which the pricing page, the signup
flow and the enforcement check all read. Changing a price or a cap there changes
all three.

| Plan       | Price (ex GST)       | Employee cap |
| ---------- | -------------------- | ------------ |
| Trial      | Free, 21 days        | 5            |
| Starter    | ₹599 /employee/month | 20           |
| Red        | ₹999 /employee/month | 50           |
| Enterprise | Negotiated           | Unlimited    |

`checkHeadcount()` runs before an employee is created and refuses with a message
written for the HR admin who hits it, because "Forbidden" from a plan ceiling is
indistinguishable from a bug.

---

## Rules to keep

1. **Never grant `admin_` to a customer.** It is the DNMS staff role. A
   customer's administrator gets `admin`.
2. **Never add `tenant_id` to `users`.** Scoping belongs on the membership. See
   the reasoning above before revisiting this.
3. **Never widen `isPlatformAdmin()`** to accept a tenant other than the
   founding one.
4. **A deliberate cross-tenant query must say so** with
   `runUnscoped("why")`. The guard refusing is the system working.
5. **Roles are per tenant.** Anything unique on a role or permission name must
   be keyed on `(tenant_id, name)`.

## Where the code lives

| Concern                 | File                                           |
| ----------------------- | ---------------------------------------------- |
| Platform admin gate     | `server/platform-admin.ts`                     |
| Tenant context (ALS)    | `server/tenant-context.ts`                     |
| Query scoping           | `server/tenant-guard.ts`                       |
| Identity and sign-in    | `server/identity.ts`, `server/auth.ts`         |
| Provisioning / deletion | `features/tenants/server/provision.service.ts` |
| Plans and limits        | `features/tenants/plans.ts`                    |
| URL space               | `lib/tenant-url.ts`, `proxy.ts`                |
| Role catalogue          | `lib/role-catalogue.ts`                        |

## Verifying it

```bash
npx tsx --conditions=react-server scripts/verify-tenant-guard.ts    # isolation
npx tsx --conditions=react-server scripts/verify-provisioning.ts    # two real tenants
npx tsx --conditions=react-server prisma/verify-identity.ts         # identity spine
npx tsx --conditions=react-server scripts/verify-tenant-urls.ts     # URL space
```
