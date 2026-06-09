/**
 * Replaces the employee roster with the 10 records from
 * docs/Employee_Onboarding_Filled.xlsx, keeping ONLY the admin account
 * (admin@hrms.dev / Admin@123).
 *
 * Run:  node scripts/reseed-employees.mjs
 *
 * What it does:
 *   1. Clears the 3 demo projects (releases the Restrict FKs: Project.owner,
 *      ProjectTask.creator, ProjectResource.uploadedBy) so employees can be deleted.
 *   2. Deletes every employee except admin@hrms.dev. Dependent rows
 *      (roles, leave, salary, attendance, notifications, …) cascade away.
 *   3. Ensures the departments/designations referenced by the sheet exist.
 *   4. Inserts the 10 employees, each with the "employee" role and a default
 *      login password of Admin@123 (per project convention).
 *
 * Idempotent: safe to re-run. Phones are blank in the sheet, so they are left null.
 */

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import bcrypt from "bcryptjs"
import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Minimal .env loader (no dotenv dependency) ───────────────────────────────
const raw = await readFile(resolve(__dirname, "..", ".env"), "utf8")
for (const line of raw.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i)
  if (!m) continue
  let v = m[2].trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
    v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  idleTimeoutMillis: 0,
  keepAlive: true,
})
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

// UTC-midnight date so @db.Date columns don't shift a day across timezones.
const d = (iso) => new Date(`${iso}T00:00:00.000Z`)
const addr = (line1, line2, city, state, zip) =>
  line1 ? { line1, line2, city, state, zip, country: "India" } : null

// ── Source data (from docs/Employee_Onboarding_Filled.xlsx) ───────────────────
const EMPLOYEES = [
  {
    employeeNo: "132",
    firstName: "Mridul",
    lastName: "Singh Bisht",
    email: "mridul@digitallynext.com",
    personalEmail: "mridulsinghbisht1008@gmail.com",
    dateOfBirth: d("2002-08-10"),
    gender: "MALE",
    department: "Web Development",
    designation: "Web Developer",
    dateOfJoining: d("2025-06-16"),
    workLocation: "Office",
    currentAddress: addr("A-3/54 Kaushik Enclave", "Burari", "Delhi", "Delhi", "110084"),
    permanentAddress: addr("A-3/54 Kaushik Enclave", "Burari", "Delhi", "Delhi", "110084"),
    emergencyContact: { relation: "Brother", phone: "9318337612" },
  },
  {
    employeeNo: "136",
    firstName: "Hemant",
    lastName: "Nandal",
    email: "hemant@digitallynext.com",
    personalEmail: "nandalhemant03@gmail.com",
    dateOfBirth: d("2003-02-18"),
    gender: "MALE",
    department: "Design",
    designation: "UI/UX Designer",
    dateOfJoining: d("2025-10-29"),
    workLocation: "Office",
    currentAddress: addr(
      "House no. 163, Street no. 5",
      "Sangam Vihar, Najafgarh",
      "New Delhi",
      "Delhi",
      "110043",
    ),
    permanentAddress: addr(
      "House no. 163, Street no. 5",
      "Sangam Vihar, Najafgarh",
      "New Delhi",
      "Delhi",
      "110043",
    ),
    emergencyContact: { relation: "Father", phone: "9871156057" },
  },
  {
    employeeNo: "137",
    firstName: "Ayushi",
    lastName: "Pandey",
    email: "ayushi@digitallynext.com",
    personalEmail: "ayushipandey582@gmail.com",
    dateOfBirth: d("2003-12-06"),
    gender: "FEMALE",
    department: "Human Resources",
    designation: "HR Executive",
    dateOfJoining: d("2025-12-01"),
    workLocation: "Office",
    currentAddress: addr(
      "WZ-42, A, Om Vihar",
      "Phase 2, Uttam Nagar",
      "New Delhi",
      "Delhi",
      "110059",
    ),
    permanentAddress: addr(
      "WZ-42, A, Om Vihar",
      "Phase 2, Uttam Nagar",
      "New Delhi",
      "Delhi",
      "110059",
    ),
    emergencyContact: { relation: "Father", phone: "9560450107" },
  },
  {
    employeeNo: "DN01",
    firstName: "Guruprasad",
    lastName: "",
    email: "guruprasad@digitallynext.com",
    personalEmail: "dezinerguru42@gmail.com",
    dateOfBirth: d("2002-03-20"),
    gender: "MALE",
    department: "Video Production",
    designation: "Video Editor",
    dateOfJoining: d("2025-12-03"),
    workLocation: "Remote",
    currentAddress: null,
    permanentAddress: null,
    emergencyContact: { relation: "Father", phone: "9449525714" },
  },
  {
    employeeNo: "DN02",
    firstName: "Gavisha",
    lastName: "",
    email: "gavisha@digitallynext.com",
    personalEmail: "gavishadhonsiofficial@gmail.com",
    dateOfBirth: d("1995-11-01"),
    gender: "FEMALE",
    department: "Design",
    designation: "UI/UX Designer",
    dateOfJoining: d("2025-12-03"),
    workLocation: "Remote",
    currentAddress: addr(
      "6th Main Rd, Hal",
      "HAL 3rd Stage, New Tippasandra",
      "Bengaluru",
      "Karnataka",
      "560075",
    ),
    permanentAddress: addr(
      "5053 Prestige Sunrise Park",
      "Electronic City Phase I, Norwood",
      "Bengaluru",
      "Karnataka",
      "560100",
    ),
    emergencyContact: { relation: "Father", phone: "8452052672" },
  },
  {
    employeeNo: "143",
    firstName: "Teesha",
    lastName: "Jain",
    email: "teesha@digitallynext.com",
    personalEmail: "teeshajain001@gmail.com",
    dateOfBirth: d("2003-07-01"),
    gender: "FEMALE",
    department: "Research",
    designation: "Market Research Specialist",
    dateOfJoining: d("2026-01-05"),
    workLocation: "Office",
    currentAddress: addr("22, Sukh Vihar", "Opposite Gagan Vihar", "East Delhi", "Delhi", "110051"),
    permanentAddress: addr(
      "22, Sukh Vihar",
      "Opposite Gagan Vihar",
      "East Delhi",
      "Delhi",
      "110051",
    ),
    emergencyContact: { relation: "Father", phone: "9625099487" },
  },
  {
    employeeNo: "144",
    firstName: "Karan",
    lastName: "Joshi",
    email: "karanj@digitallynext.com",
    personalEmail: "joshikaran.aad.0007@gmail.com",
    dateOfBirth: d("2003-08-12"),
    gender: "MALE",
    department: "Web Development",
    designation: "Jr. Full Stack Developer",
    dateOfJoining: d("2026-02-23"),
    workLocation: "Office",
    currentAddress: addr(
      "House no. 113, Block D",
      "Khora Colony",
      "Ghaziabad",
      "Uttar Pradesh",
      "201001",
    ),
    permanentAddress: addr(
      "House no. 113, Block D",
      "Khora Colony",
      "Ghaziabad",
      "Uttar Pradesh",
      "201001",
    ),
    emergencyContact: { relation: "Sister", phone: "9911728554" },
  },
  {
    employeeNo: "145",
    firstName: "Diwakar",
    lastName: "Jha",
    email: "diwakar@digitallynext.com",
    personalEmail: "diwakarjha554@gmail.com",
    dateOfBirth: d("2002-07-03"),
    gender: "MALE",
    department: "Web Development",
    designation: "Web Developer",
    dateOfJoining: d("2026-02-23"),
    workLocation: "Office",
    currentAddress: addr(
      "House no. 406, Block J",
      "Arpan Vihar, Jaitpur",
      "Badarpur",
      "Delhi",
      "110044",
    ),
    permanentAddress: addr(
      "House no. 406, Block J",
      "Arpan Vihar, Jaitpur",
      "Badarpur",
      "Delhi",
      "110044",
    ),
    emergencyContact: { relation: "Father", phone: "87000278406" },
  },
  {
    employeeNo: "146",
    firstName: "Komal",
    lastName: "Gautam",
    email: "komal@digitallynext.com",
    personalEmail: "komalgoutam600@gmail.com",
    dateOfBirth: d("2001-11-06"),
    gender: "FEMALE",
    department: "Design",
    designation: "Graphic Designer",
    dateOfJoining: d("2026-03-06"),
    workLocation: "Office",
    currentAddress: addr("TC Camp 482", "Raghubir Nagar", "West Delhi", "Delhi", "110027"),
    permanentAddress: addr("TC Camp 482", "Raghubir Nagar", "West Delhi", "Delhi", "110027"),
    emergencyContact: { relation: "Sister", phone: "7827815507" },
  },
  {
    employeeNo: "149",
    firstName: "Aashutosh",
    lastName: "Jaiswal",
    email: "aashutosh@digitallynext.com",
    personalEmail: "aashujaiswal201@gmail.com",
    dateOfBirth: d("2001-04-19"),
    gender: "MALE",
    department: "MSG",
    designation: "Content Strategist",
    dateOfJoining: d("2026-05-11"),
    workLocation: "Office",
    currentAddress: addr("House No. 339, Pocket A", "Sector 21", "Gurugram", "Haryana", "122001"),
    permanentAddress: addr(
      "House no. 13",
      "Vijay Nagar Phase II, Devrikhurd",
      "Bilaspur",
      "Chhattisgarh",
      "495001",
    ),
    emergencyContact: { relation: "Sister", phone: "7898511083" },
  },
]

// Departments referenced by the sheet that aren't already in the DB.
const DEPARTMENTS_TO_ENSURE = [
  { name: "Research", code: "RESEARCH" },
  { name: "MSG", code: "MSG" },
]

// Job titles from the sheet - created as Designation rows so they show in the UI.
// Level is a neutral IC default; no salary cap.
const DESIGNATIONS_TO_ENSURE = [
  "Web Developer",
  "UI/UX Designer",
  "HR Executive",
  "Video Editor",
  "Market Research Specialist",
  "Jr. Full Stack Developer",
  "Graphic Designer",
  "Content Strategist",
]

async function main() {
  console.log("Reseeding employees from onboarding sheet…")

  const admin = await prisma.employee.findUnique({
    where: { email: "admin@hrms.dev" },
    select: { id: true },
  })
  if (!admin) {
    throw new Error(
      "admin@hrms.dev not found - aborting so the platform isn't left without an admin.",
    )
  }

  // 1. Clear demo projects (releases Restrict FKs) so employees can be deleted.
  await prisma.project.deleteMany()
  await prisma.projectPhase.deleteMany()
  await prisma.jobPosting.deleteMany() // none expected, but releases postedBy Restrict
  console.log("  ✓ Cleared demo projects / job postings")

  // 2. Delete everyone except admin. Cascades remove dependent rows.
  const del = await prisma.employee.deleteMany({ where: { NOT: { id: admin.id } } })
  console.log(`  ✓ Deleted ${del.count} employees (kept admin@hrms.dev)`)

  // 3. Ensure departments + designations exist.
  for (const dept of DEPARTMENTS_TO_ENSURE) {
    await prisma.department.upsert({
      where: { name: dept.name },
      update: {},
      create: dept,
    })
  }
  for (const title of DESIGNATIONS_TO_ENSURE) {
    await prisma.designation.upsert({
      where: { title },
      update: {},
      create: { title, level: 3 },
    })
  }
  console.log("  ✓ Ensured departments & designations")

  const departments = await prisma.department.findMany({ select: { id: true, name: true } })
  const designations = await prisma.designation.findMany({ select: { id: true, title: true } })
  const deptMap = new Map(departments.map((x) => [x.name, x.id]))
  const desigMap = new Map(designations.map((x) => [x.title, x.id]))

  const employeeRole = await prisma.role.findFirst({
    where: { name: "employee" },
    select: { id: true },
  })
  if (!employeeRole) throw new Error('Role "employee" not found.')

  const passwordHash = await bcrypt.hash("Admin@123", 12)

  // 4. Insert the 10 employees.
  for (const e of EMPLOYEES) {
    const created = await prisma.employee.create({
      data: {
        employeeNo: e.employeeNo,
        firstName: e.firstName,
        lastName: e.lastName,
        email: e.email,
        personalEmail: e.personalEmail || null,
        dateOfBirth: e.dateOfBirth,
        gender: e.gender,
        nationality: "Indian",
        departmentId: deptMap.get(e.department) ?? null,
        designationId: desigMap.get(e.designation) ?? null,
        employmentType: "FULL_TIME",
        status: "ACTIVE",
        isActive: true,
        dateOfJoining: e.dateOfJoining,
        workLocation: e.workLocation || null,
        currentAddress: e.currentAddress ?? undefined,
        permanentAddress: e.permanentAddress ?? undefined,
        emergencyContact: e.emergencyContact ?? undefined,
        passwordHash,
        emailVerified: new Date(),
      },
    })
    await prisma.employeeRole.create({
      data: { employeeId: created.id, roleId: employeeRole.id },
    })
    console.log(`  ✓ ${e.employeeNo}  ${e.firstName} ${e.lastName}  <${e.email}>`)
  }

  console.log(`\nDone. ${EMPLOYEES.length} employees + admin. Login password for all: Admin@123`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end().catch(() => {})
  })
