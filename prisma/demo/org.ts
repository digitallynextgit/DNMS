// =============================================================================
// Organisation: departments (with sub-departments), designations, job roles,
// the people from features/help/demo/dataset.ts, their roles, and the platform
// identities + memberships that let each of them sign in.
// =============================================================================

import { db } from "@/server/db"
import { provisionIdentity } from "@/server/identity"
import { isDemoEmail } from "@/lib/demo"
import {
  DEMO_DEPARTMENTS,
  DEMO_FORMER_PEOPLE,
  DEMO_PEOPLE,
  type DemoFormerPerson,
  type DemoPerson,
} from "@/features/help/demo/dataset"
import { addDays, at, dayKey, isWeekend, make, ymd, type DemoContext } from "./context"

const MODULE = "Organisation"

/** Short, stable department codes (code is still required and unique per tenant). */
const DEPARTMENT_CODES: Record<string, string> = {
  Leadership: "LEAD",
  "Human Resources": "HR",
  Creative: "CRE",
  Design: "DES",
  Content: "CON",
  Technology: "TECH",
  Marketing: "MKT",
  SEO: "SEO",
  "Social Media": "SMM",
  Finance: "FIN",
  Sales: "SAL",
}

const DEPARTMENT_DESCRIPTIONS: Record<string, string> = {
  Leadership: "Company direction, key accounts and approvals.",
  "Human Resources": "Hiring, onboarding, payroll inputs and people operations.",
  Creative: "Brand, design, content and video for every client account.",
  Design: "Brand identity, social creatives, packaging and UI.",
  Content: "Copy, blogs, scripts and website content.",
  Technology: "Websites, landing pages, integrations and internal IT.",
  Marketing: "Organic and paid growth across search and social.",
  SEO: "Technical SEO, keyword strategy and link building.",
  "Social Media": "Content calendars, community management and reporting.",
  Finance: "Billing, vendor payments, reimbursements and compliance.",
  Sales: "New business, proposals and client onboarding.",
}

/** Who heads which department. Finance and Technology heads sign exit clearances. */
const DEPARTMENT_HEADS: Record<string, string> = {
  Leadership: "aarav",
  "Human Resources": "neha",
  Creative: "rohan",
  Design: "rohan",
  Content: "rohan",
  Technology: "karthik",
  Marketing: "aarav",
  SEO: "vikram",
  "Social Media": "sneha",
  Finance: "meera",
  Sales: "ishaan",
}

/** Grade for each designation in the dataset (Designation.level / code / phase). */
const DESIGNATION_GRADES: Record<string, { level: number; max: number | null }> = {
  Director: { level: 11, max: null },
  "HR Manager": { level: 7, max: 120000 },
  "Creative Lead": { level: 7, max: 150000 },
  "Full Stack Developer": { level: 5, max: 100000 },
  "Graphic Designer": { level: 4, max: 70000 },
  "SEO Specialist": { level: 4, max: 65000 },
  "Accounts Executive": { level: 4, max: 60000 },
  "Business Development Executive": { level: 4, max: 60000 },
  "Content Writer": { level: 3, max: 55000 },
  "Social Media Executive": { level: 3, max: 50000 },
  "Video Editor": { level: 3, max: 55000 },
  "HR Executive": { level: 3, max: 50000 },
  Copywriter: { level: 3, max: 55000 },
  "Junior Designer": { level: 2, max: 40000 },
}

function phaseFor(level: number): string {
  return level <= 5 ? "FOUNDATION" : level <= 9 ? "ELEVATE" : "PINNACLE"
}

/** Preset avatars from public/avatars, matched to each person (never uploaded). */
const AVATARS: Record<string, string> = {
  aarav: "av-lead-01",
  neha: "av-hr-04",
  rohan: "av-lead-05",
  priya: "av-design-06",
  karthik: "av-web-06",
  ananya: "av-content-01",
  vikram: "av-content-03",
  sneha: "av-social-05",
  arjun: "av-video-01",
  meera: "av-hr-05",
  ishaan: "av-social-04",
  kavya: "av-hr-01",
  rahul: "av-design-05",
  pooja: "av-content-04",
  manish: "av-social-06",
}

/** Made-up personal details. Phone numbers use the 98765 43xxx dummy range. */
const PROFILE: Record<
  string,
  { dob: [number, number, number] | { inDays: number }; blood: string; city: string; area: string }
> = {
  aarav: { dob: [1984, 3, 14], blood: "B+", city: "Gurugram", area: "DLF Phase 4" },
  neha: { dob: [1989, 11, 2], blood: "O+", city: "New Delhi", area: "Saket" },
  rohan: { dob: [1990, 6, 21], blood: "A+", city: "Gurugram", area: "Sushant Lok 1" },
  priya: { dob: [1997, 12, 9], blood: "B+", city: "Gurugram", area: "Sector 56" },
  karthik: { dob: [1993, 1, 30], blood: "O-", city: "Gurugram", area: "Sohna Road" },
  // Two birthdays in the coming days (never today - a birthday is a day off
  // on the attendance calendar), so the dashboard and the birthdays calendar
  // always have something to celebrate whenever the seed is run.
  ananya: { dob: { inDays: 9 }, blood: "AB+", city: "New Delhi", area: "Lajpat Nagar" },
  vikram: { dob: [1994, 8, 17], blood: "B-", city: "Noida", area: "Sector 62" },
  sneha: { dob: { inDays: 2 }, blood: "O+", city: "Gurugram", area: "Sector 45" },
  arjun: { dob: [1998, 2, 11], blood: "A-", city: "New Delhi", area: "Dwarka" },
  meera: { dob: [1992, 5, 26], blood: "O+", city: "Faridabad", area: "Sector 15" },
  ishaan: { dob: [1996, 9, 3], blood: "B+", city: "Gurugram", area: "Golf Course Road" },
  kavya: { dob: [1997, 4, 19], blood: "A+", city: "New Delhi", area: "Malviya Nagar" },
  rahul: { dob: [2002, 7, 8], blood: "B+", city: "Gurugram", area: "Palam Vihar" },
  pooja: { dob: [1993, 10, 28], blood: "AB-", city: "New Delhi", area: "Rajouri Garden" },
  manish: { dob: [1995, 2, 20], blood: "O+", city: "Gurugram", area: "Sector 23" },
}

const STATE_OF: Record<string, string> = {
  Gurugram: "Haryana",
  Faridabad: "Haryana",
  "New Delhi": "Delhi",
  Noida: "Uttar Pradesh",
}

const RELATIONS = ["Father", "Mother", "Spouse", "Brother", "Sister"]
const RELATION_FIRST_NAMES: Record<string, string[]> = {
  Father: ["Rajesh", "Suresh", "Anil", "Ramesh"],
  Mother: ["Sunita", "Kavita", "Meena", "Anita"],
  Spouse: ["Ritika", "Aditya", "Nidhi", "Siddharth"],
  Brother: ["Varun", "Nikhil", "Akash", "Rohit"],
  Sister: ["Shreya", "Pallavi", "Divya", "Tanvi"],
}

/** Joining dates land on a working weekday, so nobody "joined on a Sunday". */
function joiningDate(ctx: DemoContext, daysAgo: number): Date {
  let d = addDays(ctx.today, -daysAgo)
  while (isWeekend(d) || ctx.holidayKeys.has(dayKey(d))) d = addDays(d, -1)
  return d
}

function dateOfBirth(ctx: DemoContext, spec: (typeof PROFILE)[string]["dob"], age: number): Date {
  const y = ctx.today.getUTCFullYear()
  if (!Array.isArray(spec)) {
    const d = addDays(ctx.today, spec.inDays)
    return ymd(y - age, d.getUTCMonth() + 1, d.getUTCDate())
  }
  return ymd(spec[0], spec[1], spec[2])
}

export async function seedOrganisation(
  ctx: DemoContext,
  opts: { passwordHash: string; adminEmployeeId: string },
): Promise<void> {
  // ── departments, parents first ─────────────────────────────────────────────
  for (const d of DEMO_DEPARTMENTS) {
    ctx.dept[d.name] = await make(ctx, "department", {
      name: d.name,
      code: DEPARTMENT_CODES[d.name] ?? d.name.slice(0, 4).toUpperCase(),
      description: DEPARTMENT_DESCRIPTIONS[d.name] ?? null,
      parentId: d.parent ? ctx.dept[d.parent] : null,
    })
  }
  ctx.summary.add(MODULE, "departments (incl. sub-departments)", DEMO_DEPARTMENTS.length)

  // ── designations + job roles ───────────────────────────────────────────────
  const designationId: Record<string, string> = {}
  for (const [title, grade] of Object.entries(DESIGNATION_GRADES)) {
    designationId[title] = await make(ctx, "designation", {
      title,
      level: grade.level,
      code: `L${grade.level}`,
      phase: phaseFor(grade.level),
      maxMonthlySalary: grade.max,
    })
  }
  ctx.summary.add(MODULE, "designations", Object.keys(designationId).length)

  const jobRoleId: Record<string, string> = {}
  for (const p of DEMO_PEOPLE) {
    const k = `${p.department}|${p.designation}`
    if (jobRoleId[k]) continue
    jobRoleId[k] = await make(ctx, "jobRole", {
      name: p.designation,
      departmentId: ctx.dept[p.department],
    })
  }
  // A few roles nobody holds yet, so the Job Roles screen reads like a real org.
  for (const [dept, name] of [
    ["Technology", "QA Engineer"],
    ["Social Media", "Community Manager"],
    ["SEO", "Link Building Executive"],
    ["Design", "UI/UX Designer"],
  ] as const) {
    jobRoleId[`${dept}|${name}`] = await make(ctx, "jobRole", {
      name,
      departmentId: ctx.dept[dept],
    })
  }
  ctx.summary.add(MODULE, "job roles", Object.keys(jobRoleId).length)

  // ── people ─────────────────────────────────────────────────────────────────
  // Managers before reports, so managerId always points at a row that exists.
  // Current staff, then the one who has left (GUIDE REQUIREMENT, analytics:
  // the status chart needs more than "Active").
  const everyone: (DemoPerson | DemoFormerPerson)[] = [...DEMO_PEOPLE, ...DEMO_FORMER_PEOPLE]
  const ordered: (DemoPerson | DemoFormerPerson)[] = []
  const placed = new Set<string>()
  while (ordered.length < everyone.length) {
    for (const p of everyone) {
      if (placed.has(p.key)) continue
      if (p.manager && !placed.has(p.manager)) continue
      ordered.push(p)
      placed.add(p.key)
    }
  }

  let phoneSeq = 1
  for (const p of ordered) {
    if (!isDemoEmail(p.email)) throw new Error(`Refusing non-demo email ${p.email}`)
    const prof = PROFILE[p.key]
    if (!prof) throw new Error(`No demo profile for ${p.key}`)
    const joined = joiningDate(ctx, p.joinedDaysAgo)
    const former = "leftDaysAgo" in p ? p : null
    const lastDay = former ? joiningDate(ctx, former.leftDaysAgo) : null
    if (former && lastDay) ctx.ref[`left:${p.key}`] = dayKey(lastDay)
    const age = 24 + ((p.monthlyGross / 10000) | 0) // older for senior people, roughly
    // Three months for this year's hires, six for everyone else; only Rahul is
    // still on probation.
    const probation = p.joinedDaysAgo < 200 ? 3 : 6
    const onProbation = p.joinedDaysAgo < 91
    const phone = `+91 98765 43${String(phoneSeq++).padStart(3, "0")}`
    const relation = RELATIONS[phoneSeq % RELATIONS.length] ?? "Father"
    const address = {
      line1: `${100 + phoneSeq * 7}, ${prof.area}`,
      line2: "",
      city: prof.city,
      state: STATE_OF[prof.city] ?? "Haryana",
      zip: prof.city === "New Delhi" ? "110017" : prof.city === "Noida" ? "201301" : "122002",
      country: "India",
    }

    const data = {
      employeeNo: p.employeeNo,
      firstName: p.firstName,
      lastName: p.lastName,
      email: p.email,
      phone,
      dateOfBirth: dateOfBirth(ctx, prof.dob, Math.min(age, 42)),
      gender: p.gender as "MALE" | "FEMALE",
      nationality: "Indian",
      bloodGroup: prof.blood,
      profilePhoto: `/avatars/${AVATARS[p.key] ?? "av-lead-01"}.webp`,
      currentAddress: address,
      permanentAddress: address,
      emergencyContact: {
        name: `${RELATION_FIRST_NAMES[relation]?.[phoneSeq % 4] ?? "Rajesh"} ${p.lastName}`,
        relation,
        phone: `+91 98765 44${String(phoneSeq).padStart(3, "0")}`,
      },
      departmentId: ctx.dept[p.department],
      designationId: designationId[p.designation],
      jobRoleId: jobRoleId[`${p.department}|${p.designation}`],
      managerId: p.manager ? ctx.emp[p.manager] : null,
      employmentType: "FULL_TIME" as const,
      status: former ? former.exitStatus : ("ACTIVE" as const),
      resignationDate: lastDay ? addDays(lastDay, -30) : null,
      lastWorkingDate: lastDay,
      // Biometric code on the attendance device. Rahul is not enrolled yet, so
      // "Sync by employee" shows him as "No code".
      deviceId: p.key === "rahul" ? null : String(100 + Number(p.employeeNo.slice(2))),
      dateOfJoining: joined,
      onProbation,
      probationMonths: probation,
      probationEndDate: addDays(joined, probation === 3 ? 91 : 182),
      confirmationDate: onProbation ? null : addDays(joined, probation === 3 ? 91 : 182),
      workLocation: "Gurugram Office",
      passwordHash: opts.passwordHash,
      mustChangePassword: false,
      isActive: !former,
      // The record was created the day they joined, so "new hires this month"
      // and the six-month hire trend (both read createdAt) tell the truth.
      createdAt: at(joined, "10:00"),
    }

    if (p.key === "aarav") {
      // Created by provisionTenant as the founding admin - fill in the rest.
      await db.employee.update({ where: { id: opts.adminEmployeeId }, data })
      ctx.emp[p.key] = opts.adminEmployeeId
      continue
    }

    const id = await make(ctx, "employee", data)
    ctx.emp[p.key] = id
    await provisionIdentity({
      email: p.email,
      name: `${p.firstName} ${p.lastName}`,
      tenantId: ctx.tenantId,
      kind: "STAFF",
      employeeId: id,
      passwordHash: opts.passwordHash,
      mustChangePassword: false,
    })
    await make(ctx, "employeeRole", { employeeId: id, roleId: ctx.role[p.role] })
    // Someone who has left keeps their record but can no longer sign in.
    if (former)
      await db.membership.updateMany({ where: { employeeId: id }, data: { isActive: false } })
  }

  // The platform `users` rows outlive the tenant (they are platform-level), so a
  // re-run keeps the old credential unless it is reset here - and DEMO_PASSWORD
  // may have changed since. Only demo-domain addresses, checked above.
  const emails = DEMO_PEOPLE.map((p) => p.email.toLowerCase())
  if (!emails.every(isDemoEmail)) throw new Error("Refusing to touch non-demo users")
  await db.user.updateMany({
    where: { email: { in: emails } },
    data: {
      passwordHash: opts.passwordHash,
      mustChangePassword: false,
      isActive: true,
      passwordChangedAt: ctx.now,
    },
  })

  // Department heads, now that everyone exists.
  for (const [dept, key] of Object.entries(DEPARTMENT_HEADS)) {
    await db.department.update({
      where: { id: ctx.dept[dept] },
      data: { headId: ctx.emp[key] },
    })
  }

  ctx.summary.add(MODULE, "employees (with logins)", DEMO_PEOPLE.length)
  ctx.summary.add(MODULE, "former employees (left last month, inactive)", DEMO_FORMER_PEOPLE.length)
  ctx.summary.add(MODULE, "preset avatars assigned", Object.keys(AVATARS).length)
}
