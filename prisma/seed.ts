// =============================================================================
// DNMS Database Seed Script
// Run with: pnpm prisma db seed
// =============================================================================

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import bcrypt from "bcryptjs"
import { PERMISSION_DEFINITIONS } from "../lib/constants"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  idleTimeoutMillis: 0,
  keepAlive: true,
})
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

// Prisma 7 + pg adapter breaks on createMany with session pooler.
// This helper inserts rows one-by-one instead.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safeCreateMany(model: any, rows: Record<string, unknown>[]) {
  for (const row of rows) {
    await model.create({ data: row })
  }
}

async function main() {
  console.log("Starting DNMS database seed...")
  console.log("─────────────────────────────────────────")

  // ===========================================================================
  // STEP 1 - Clear existing data (safe re-runs)
  // ===========================================================================
  console.log("Step 1: Clearing existing data...")

  // New module tables (Phase 3+)
  await prisma.interview.deleteMany()
  await prisma.applicant.deleteMany()
  await prisma.jobPosting.deleteMany()
  await prisma.goal.deleteMany()
  await prisma.performanceReview.deleteMany()
  await prisma.reviewCycle.deleteMany()
  await prisma.timesheet.deleteMany()
  await prisma.projectResource.deleteMany()
  await prisma.projectTask.deleteMany()
  await prisma.projectTeamMember.deleteMany()
  await prisma.projectTeam.deleteMany()
  await prisma.projectPhase.deleteMany()
  await prisma.projectMember.deleteMany()
  await prisma.project.deleteMany()
  await prisma.passwordReset.deleteMany()

  await prisma.payrollRecord.deleteMany()
  await prisma.salaryStructure.deleteMany()
  await prisma.leaveRequest.deleteMany()
  await prisma.leaveBalance.deleteMany()
  await prisma.leaveType.deleteMany()
  await prisma.attendanceLog.deleteMany()
  await prisma.attendancePolicy.deleteMany()
  await prisma.holiday.deleteMany()
  await prisma.hikvisionDevice.deleteMany()
  await prisma.emailLog.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.document.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.employeeRole.deleteMany()
  await prisma.rolePermission.deleteMany()
  await prisma.session.deleteMany()
  await prisma.account.deleteMany()
  await prisma.verificationToken.deleteMany()
  await prisma.employee.deleteMany()
  await prisma.permission.deleteMany()
  await prisma.role.deleteMany()
  await prisma.designation.deleteMany()
  await prisma.department.deleteMany()
  await prisma.emailTemplate.deleteMany()

  console.log("  ✓ Existing data cleared")

  // ===========================================================================
  // STEP 2 - Create permissions
  // ===========================================================================
  console.log("Step 2: Creating permissions...")

  await safeCreateMany(
    prisma.permission,
    PERMISSION_DEFINITIONS.map((def) => ({
      scope: def.scope,
      module: def.module,
      action: def.action,
      description: def.description,
    })),
  )
  const permissionRecords = await prisma.permission.findMany()

  console.log(`  ✓ Created ${permissionRecords.length} permissions`)

  // ===========================================================================
  // STEP 3 - Create roles with permissions
  // ===========================================================================
  console.log("Step 3: Creating roles...")

  const rolesData = [
    {
      name: "super_admin",
      displayName: "Super Admin",
      description: "CEO-only role. Hidden from every UI listing. Full system access.",
      isSystem: true,
      permissions: "ALL" as const,
    },
    {
      name: "admin",
      displayName: "Admin",
      description: "Full system access and permissions",
      isSystem: true,
      permissions: "ALL" as const,
    },
    {
      name: "hr_manager",
      displayName: "HR Manager",
      description: "Full HR access across all modules",
      isSystem: true,
      permissions: [
        "employee:read",
        "employee:write",
        "employee:delete",
        "document:read",
        "document:write",
        "document:delete",
        "dashboard:read",
        "attendance:read",
        "attendance:write",
        "leave:read",
        "leave:write",
        "leave:approve",
        "wfh:read",
        "wfh:write",
        "wfh:approve",
        "payroll:read",
        "payroll:write",
        "payroll:process",
        "performance:read",
        "performance:write",
        "performance:review",
        "recruitment:read",
        "recruitment:write",
        "analytics:read",
        "email_template:read",
        "email_template:write",
      ],
    },
    {
      name: "hr_employee",
      displayName: "HR Employee",
      description: "HR access with limited scope (no payroll administration)",
      isSystem: true,
      permissions: [
        "employee:read",
        "document:read",
        "document:write",
        "dashboard:read",
        "attendance:read",
        "leave:read",
        "leave:approve",
        "wfh:read",
        "wfh:approve",
        "performance:read",
        "recruitment:read",
        "recruitment:write",
      ],
    },
    {
      name: "employee",
      displayName: "Employee",
      description: "Self-service access for own profile, leave, attendance, payslips",
      isSystem: true,
      permissions: [
        "dashboard:read",
        "attendance:read",
        "leave:read",
        "leave:write",
        "wfh:read",
        "wfh:write",
        "payroll:read",
        "document:read",
        "performance:read",
        "performance:write",
        "project:read",
      ],
    },
  ]

  const roleMap = new Map<string, string>() // name → id

  for (const roleData of rolesData) {
    const { permissions, ...roleFields } = roleData

    const role = await prisma.role.create({ data: roleFields })
    roleMap.set(role.name, role.id)

    // Determine which permission records to link
    const permsToAssign =
      permissions === "ALL"
        ? permissionRecords
        : permissionRecords.filter((p) => (permissions as string[]).includes(p.scope))

    if (permsToAssign.length > 0) {
      await safeCreateMany(
        prisma.rolePermission,
        permsToAssign.map((p) => ({
          roleId: role.id,
          permissionId: p.id,
        })),
      )
    }

    console.log(`  ✓ Created role "${role.displayName}" with ${permsToAssign.length} permissions`)
  }

  // ===========================================================================
  // STEP 4 - Create departments
  // ===========================================================================
  console.log("Step 4: Creating departments...")

  // 8 vertical teams from Digitally Next hierarchy + leadership departments
  const departmentsData = [
    // Leadership / Corporate
    { name: "Business", code: "BIZ" },
    { name: "Finance", code: "FIN" },
    { name: "Human Resources", code: "HR" },
    { name: "Product", code: "PROD" },
    // Two-phase delivery structure
    { name: "Create", code: "CREATE" },
    { name: "Promote", code: "PROMOTE" },
    // 8 vertical teams
    { name: "Video Production", code: "VIDEO" },
    { name: "Web Development", code: "WEB" },
    { name: "Content", code: "CONTENT" },
    { name: "Design", code: "DESIGN" },
    { name: "Paid Ads", code: "ADS" },
    { name: "SEO", code: "SEO" },
    { name: "SMO", code: "SMO" },
    { name: "Digital PR", code: "PR" },
    // Legacy / operational
    { name: "Operations", code: "OPS" },
  ]

  await safeCreateMany(prisma.department, departmentsData)
  const departmentRecords = await prisma.department.findMany()

  const departmentMap = new Map(departmentRecords.map((d) => [d.name, d.id]))
  console.log(`  ✓ Created ${departmentRecords.length} departments`)

  // ===========================================================================
  // STEP 5 - Create designations
  // ===========================================================================
  console.log("Step 5: Creating designations...")

  // Digitally Next 13-level hierarchy + legacy titles for existing seed data
  const designationsData = [
    // ─── Foundation Phase (L1–L5) ─── Operational / Individual Contributors
    { title: "Trainee", level: 1, code: "L1", phase: "FOUNDATION", maxMonthlySalary: 20000 },
    { title: "Junior", level: 2, code: "L2", phase: "FOUNDATION", maxMonthlySalary: 40000 },
    { title: "Associate", level: 3, code: "L3", phase: "FOUNDATION", maxMonthlySalary: 40000 },
    { title: "Specialist", level: 4, code: "L4", phase: "FOUNDATION", maxMonthlySalary: 40000 },
    {
      title: "Senior Specialist",
      level: 5,
      code: "L5",
      phase: "FOUNDATION",
      maxMonthlySalary: 60000,
    },

    // ─── Elevate Phase (L6–L9) ─── Functional / Team Management
    { title: "Team Lead", level: 6, code: "L6", phase: "ELEVATE", maxMonthlySalary: 80000 },
    { title: "Manager", level: 7, code: "L7", phase: "ELEVATE", maxMonthlySalary: 80000 },
    { title: "Senior Manager", level: 8, code: "L8", phase: "ELEVATE", maxMonthlySalary: 100000 },
    { title: "AVP", level: 9, code: "L9", phase: "ELEVATE", maxMonthlySalary: 300000 },

    // ─── Pinnacle Phase (L10–L13) ─── Business Leadership (no salary cap)
    { title: "VP", level: 10, code: "L10", phase: "PINNACLE", maxMonthlySalary: null },
    { title: "CCO", level: 11, code: "L11", phase: "PINNACLE", maxMonthlySalary: null },
    { title: "CHRO", level: 11, code: "L11", phase: "PINNACLE", maxMonthlySalary: null },
    { title: "CPO", level: 12, code: "L12", phase: "PINNACLE", maxMonthlySalary: null },
    { title: "CFO", level: 12, code: "L12", phase: "PINNACLE", maxMonthlySalary: null },
    { title: "COO", level: 12, code: "L12", phase: "PINNACLE", maxMonthlySalary: null },
    { title: "CBO", level: 12, code: "L12", phase: "PINNACLE", maxMonthlySalary: null },
    { title: "CEO", level: 13, code: "L13", phase: "PINNACLE", maxMonthlySalary: null },

    // ─── Legacy titles (kept so existing seeded employees still resolve) ───
    { title: "Team Member", level: 3, code: null, phase: null, maxMonthlySalary: null },
    { title: "Senior Executive", level: 4, code: null, phase: null, maxMonthlySalary: null },
  ]

  // await prisma.designation.createMany({ data: designationsData })

  for (const d of designationsData) {
    await prisma.designation.create({ data: d })
  }

  const designationRecords = await prisma.designation.findMany()

  const designationMap = new Map(designationRecords.map((d) => [d.title, d.id]))
  console.log(`  ✓ Created ${designationRecords.length} designations`)

  // ===========================================================================
  // STEP 6 - Create employees (two-pass for manager references)
  // ===========================================================================
  console.log("Step 6: Creating employees...")

  // Hash password once - reuse for all employees
  const passwordHash = await bcrypt.hash("Admin@123", 12)

  const employeesData = [
    // ── System admin account (required for platform access) ──────────────────
    {
      employeeNo: "EMP-001",
      firstName: "Admin",
      lastName: "",
      email: "admin@hrms.dev",
      designation: "Manager",
      department: "Management",
      role: "super_admin",
      managerEmployeeNo: null as string | null,
      dateOfJoining: new Date("2024-01-01") as Date | null,
      phone: null as string | null,
      workLocation: "Delhi",
      dateOfBirth: null as Date | null,
      status: "ACTIVE",
      isActive: true,
      lastWorkingDate: null as Date | null,
      permanentAddress: null,
      currentAddress: null,
      emergencyContact: null,
    },
    // 1. Aditi (EMP-112)
    {
      employeeNo: "EMP-112",
      firstName: "Aditi",
      lastName: "",
      email: "singhaditii099@gmail.com",
      designation: "Team Member",
      department: "Operations",
      role: "employee",
      managerEmployeeNo: null as string | null,
      dateOfJoining: new Date("2024-03-26") as Date | null,
      phone: "+91 82993 64233",
      workLocation: "New Delhi",
      dateOfBirth: new Date("1999-06-01") as Date | null,
      status: "ACTIVE",
      isActive: true,
      lastWorkingDate: null as Date | null,
      permanentAddress: {
        line1: "8 laxmanpuri faizabad road, Indira nagar",
        city: "Lucknow",
        state: "Uttar Pradesh",
        country: "India",
      },
      currentAddress: {
        line1: "H. no 255, Saini chopal, Masjid Moth, South extension II",
        city: "New Delhi",
        state: "Delhi",
        country: "India",
      },
      emergencyContact: { phone: "9161763111" },
    },
    // 2. Sudhanshu (EMP-115) - resigned 19 Feb 2026
    {
      employeeNo: "EMP-115",
      firstName: "Sudhanshu",
      lastName: "",
      email: "sri.sudhanshu1@gmail.com",
      designation: "Team Member",
      department: "Operations",
      role: "employee",
      managerEmployeeNo: null as string | null,
      dateOfJoining: new Date("2024-04-10") as Date | null,
      phone: "+91 85778 68240",
      workLocation: "Delhi",
      dateOfBirth: new Date("2002-04-07") as Date | null,
      status: "RESIGNED",
      isActive: false,
      lastWorkingDate: new Date("2026-02-19") as Date | null,
      permanentAddress: {
        line1: "T3/7 Printing staff colony, N.R.I.P.T Campus, teliarganj",
        city: "Allahabad",
        state: "Uttar Pradesh",
        country: "India",
      },
      currentAddress: null,
      emergencyContact: { phone: "6394905925" },
    },
    // 3. Shivam (EMP-119)
    {
      employeeNo: "EMP-119",
      firstName: "Shivam",
      lastName: "",
      email: "connectnow.shivam@gmail.com",
      designation: "Team Member",
      department: "Operations",
      role: "employee",
      managerEmployeeNo: null as string | null,
      dateOfJoining: new Date("2024-07-08") as Date | null,
      phone: "+91 63938 48140",
      workLocation: "New Delhi",
      dateOfBirth: new Date("2000-05-16") as Date | null,
      status: "ACTIVE",
      isActive: true,
      lastWorkingDate: null as Date | null,
      permanentAddress: {
        line1: "529c/15/1, kamla nehru nagar, vikas nagar",
        city: "Lucknow",
        state: "Uttar Pradesh",
        country: "India",
      },
      currentAddress: {
        line1: "Flat no 215, Kaveri apartments, Vasant Kunj",
        city: "New Delhi",
        state: "Delhi",
        country: "India",
      },
      emergencyContact: { phone: "7652081654" },
    },
    // 4. Yashasvi (EMP-118)
    {
      employeeNo: "EMP-118",
      firstName: "Yashasvi",
      lastName: "",
      email: "yashasvidiwedi.soa21@aaft.net",
      designation: "Team Member",
      department: "Operations",
      role: "employee",
      managerEmployeeNo: null as string | null,
      dateOfJoining: new Date("2024-06-04") as Date | null,
      phone: "+91 80524 75318",
      workLocation: "New Delhi",
      dateOfBirth: new Date("2003-11-26") as Date | null,
      status: "ACTIVE",
      isActive: true,
      lastWorkingDate: null as Date | null,
      permanentAddress: {
        line1: "58-B, Hamayunpur village, safdarjung enclave",
        city: "New Delhi",
        state: "Delhi",
        country: "India",
      },
      currentAddress: {
        line1: "SF-1, A-Block, building no-4/9, DLF ankur vihar, Loni",
        city: "Ghaziabad",
        state: "Uttar Pradesh",
        country: "India",
      },
      emergencyContact: { phone: "9873497710" },
    },
    // 5. Rupam (EMP-113)
    {
      employeeNo: "EMP-113",
      firstName: "Rupam",
      lastName: "",
      email: "rupam.bharti@gmail.com",
      designation: "Senior Executive",
      department: "Operations",
      role: "employee",
      managerEmployeeNo: null as string | null,
      dateOfJoining: new Date("2024-04-01") as Date | null,
      phone: "+91 88775 55709",
      workLocation: "Patna",
      dateOfBirth: new Date("1995-09-12") as Date | null,
      status: "ACTIVE",
      isActive: true,
      lastWorkingDate: null as Date | null,
      permanentAddress: {
        line1: "Girls hostel lane, opposite loyla high school, Kunji, Phulwari",
        city: "Patna",
        state: "Bihar",
        country: "India",
      },
      currentAddress: null,
      emergencyContact: null,
    },
    // 6. Anmol Juneja (EMP-121) - resigned 13 Mar 2026
    {
      employeeNo: "EMP-121",
      firstName: "Anmol",
      lastName: "Juneja",
      email: "anmoljuneja13@gmail.com",
      designation: "Team Member",
      department: "Operations",
      role: "employee",
      managerEmployeeNo: null as string | null,
      dateOfJoining: new Date("2024-10-01") as Date | null,
      phone: "+91 80763 28280",
      workLocation: "New Delhi",
      dateOfBirth: new Date("2001-09-26") as Date | null,
      status: "RESIGNED",
      isActive: false,
      lastWorkingDate: new Date("2026-03-13") as Date | null,
      permanentAddress: {
        line1: "F-215, Vikaspuri",
        city: "New Delhi",
        state: "Delhi",
        country: "India",
      },
      currentAddress: {
        line1: "F-215, Vikaspuri",
        city: "New Delhi",
        state: "Delhi",
        country: "India",
      },
      emergencyContact: { phone: "8851979980" },
    },
    // 7. Saumya (EMP-148) - incomplete record
    {
      employeeNo: "EMP-148",
      firstName: "Saumya",
      lastName: "",
      email: "saumya@hrms.internal",
      designation: "Team Member",
      department: "Operations",
      role: "employee",
      managerEmployeeNo: null as string | null,
      dateOfJoining: null as Date | null,
      phone: null as string | null,
      workLocation: "Delhi",
      dateOfBirth: null as Date | null,
      status: "ACTIVE",
      isActive: true,
      lastWorkingDate: null as Date | null,
      permanentAddress: null,
      currentAddress: null,
      emergencyContact: null,
    },
    // 8. Pankaz (EMP-123) - resigned 9 Apr 2026
    {
      employeeNo: "EMP-123",
      firstName: "Pankaz",
      lastName: "",
      email: "pankazandyou@gmail.com",
      designation: "Manager",
      department: "Operations",
      role: "hr_manager",
      managerEmployeeNo: null as string | null,
      dateOfJoining: new Date("2024-12-09") as Date | null,
      phone: "+91 95993 68486",
      workLocation: "New Delhi",
      dateOfBirth: new Date("1993-12-12") as Date | null,
      status: "RESIGNED",
      isActive: false,
      lastWorkingDate: new Date("2026-04-09") as Date | null,
      permanentAddress: {
        line1: "House No.-81, Village Sevraha, Post Office - Khargupur, District - Gonda",
        city: "Gonda",
        state: "Uttar Pradesh",
        country: "India",
      },
      currentAddress: {
        line1: "210 F, Pocket 1, DDA, Mayur Vihar, Phase 1",
        city: "New Delhi",
        state: "Delhi",
        country: "India",
      },
      emergencyContact: { phone: "8076867625" },
    },
    // 9. Vivek (EMP-124)
    {
      employeeNo: "EMP-124",
      firstName: "Vivek",
      lastName: "",
      email: "vkchaturvedi72@gmail.com",
      designation: "Team Member",
      department: "Operations",
      role: "employee",
      managerEmployeeNo: null as string | null,
      dateOfJoining: new Date("2025-02-03") as Date | null,
      phone: "+91 63967 08773",
      workLocation: "New Delhi",
      dateOfBirth: new Date("2000-07-10") as Date | null,
      status: "ACTIVE",
      isActive: true,
      lastWorkingDate: null as Date | null,
      permanentAddress: {
        line1: "Village Bamani, Post Luheta, Dist. Hathras",
        city: "Hathras",
        state: "Uttar Pradesh",
        country: "India",
      },
      currentAddress: {
        line1: "D-40, Okhla Phase 1",
        city: "New Delhi",
        state: "Delhi",
        country: "India",
      },
      emergencyContact: { phone: "8287119018" },
    },
    // 10. Shailesh Patwal (EMP-125)
    {
      employeeNo: "EMP-125",
      firstName: "Shailesh",
      lastName: "Patwal",
      email: "shaileshpatwal99@gmail.com",
      designation: "Team Member",
      department: "Operations",
      role: "employee",
      managerEmployeeNo: null as string | null,
      dateOfJoining: new Date("2025-02-24") as Date | null,
      phone: "+91 85272 88764",
      workLocation: "New Delhi",
      dateOfBirth: new Date("1993-01-25") as Date | null,
      status: "ACTIVE",
      isActive: true,
      lastWorkingDate: null as Date | null,
      permanentAddress: {
        line1: "38 A, Bhagwati Garden Extension, Uttam Nagar",
        city: "New Delhi",
        state: "Delhi",
        country: "India",
      },
      currentAddress: {
        line1: "38 A, Bhagwati Garden Extension, Uttam Nagar",
        city: "New Delhi",
        state: "Delhi",
        country: "India",
      },
      emergencyContact: { phone: "9599604356" },
    },
    // 11. Praneet Nitin (EMP-126)
    {
      employeeNo: "EMP-126",
      firstName: "Praneet",
      lastName: "Nitin",
      email: "praneet.nitin@gmail.com",
      designation: "Team Member",
      department: "Operations",
      role: "employee",
      managerEmployeeNo: null as string | null,
      dateOfJoining: new Date("2025-03-03") as Date | null,
      phone: "+91 79790 20982",
      workLocation: "Delhi",
      dateOfBirth: new Date("2002-10-09") as Date | null,
      status: "ACTIVE",
      isActive: true,
      lastWorkingDate: null as Date | null,
      permanentAddress: {
        line1: "powerganj bageshwari road gaya",
        city: "Gaya",
        state: "Bihar",
        country: "India",
      },
      currentAddress: {
        line1: "Khizarabad police chauki near ctr public school",
        city: "Delhi",
        state: "Delhi",
        country: "India",
      },
      emergencyContact: { phone: "7979891019" },
    },
    // 12. Kajal Garg (EMP-127) - incomplete record
    {
      employeeNo: "EMP-127",
      firstName: "Kajal",
      lastName: "Garg",
      email: "kajal.garg@hrms.internal",
      designation: "Team Member",
      department: "Operations",
      role: "employee",
      managerEmployeeNo: null as string | null,
      dateOfJoining: null as Date | null,
      phone: null as string | null,
      workLocation: "Delhi",
      dateOfBirth: null as Date | null,
      status: "ACTIVE",
      isActive: true,
      lastWorkingDate: null as Date | null,
      permanentAddress: null,
      currentAddress: null,
      emergencyContact: null,
    },
    // 13. Aryamaan Sharma (EMP-128) - incomplete record
    {
      employeeNo: "EMP-128",
      firstName: "Aryamaan",
      lastName: "Sharma",
      email: "aryamaan.sharma@hrms.internal",
      designation: "Team Member",
      department: "Operations",
      role: "employee",
      managerEmployeeNo: null as string | null,
      dateOfJoining: null as Date | null,
      phone: null as string | null,
      workLocation: "Delhi",
      dateOfBirth: null as Date | null,
      status: "ACTIVE",
      isActive: true,
      lastWorkingDate: null as Date | null,
      permanentAddress: null,
      currentAddress: null,
      emergencyContact: null,
    },
    // 14. Saurabh Singh Rawat (EMP-129)
    {
      employeeNo: "EMP-129",
      firstName: "Saurabh",
      lastName: "Singh Rawat",
      email: "rawatsaurabh022@gmail.com",
      designation: "Team Member",
      department: "Operations",
      role: "employee",
      managerEmployeeNo: null as string | null,
      dateOfJoining: new Date("2025-04-07") as Date | null,
      phone: "+91 96504 91774",
      workLocation: "New Delhi",
      dateOfBirth: new Date("2000-09-23") as Date | null,
      status: "ACTIVE",
      isActive: true,
      lastWorkingDate: null as Date | null,
      permanentAddress: {
        line1: "16 feet, Sarkari Rasta, B block, Kaushik Enclave, Burari, North Delhi",
        city: "New Delhi",
        state: "Delhi",
        country: "India",
      },
      currentAddress: {
        line1: "16 feet, Sarkari Rasta, B block, Kaushik Enclave, Burari, North Delhi",
        city: "New Delhi",
        state: "Delhi",
        country: "India",
      },
      emergencyContact: { phone: "9891300348" },
    },
    // 15. Anjali Gautam (EMP-130) - resigned 18 Nov 2025
    {
      employeeNo: "EMP-130",
      firstName: "Anjali",
      lastName: "Gautam",
      email: "anjaligoutam380@gmail.com",
      designation: "Team Member",
      department: "Operations",
      role: "employee",
      managerEmployeeNo: null as string | null,
      dateOfJoining: new Date("2025-05-12") as Date | null,
      phone: "+91 93544 46940",
      workLocation: "New Delhi",
      dateOfBirth: new Date("2005-11-10") as Date | null,
      status: "RESIGNED",
      isActive: false,
      lastWorkingDate: new Date("2025-11-18") as Date | null,
      permanentAddress: {
        line1: "482 Raghuveer Nagar TC camp",
        city: "New Delhi",
        state: "Delhi",
        country: "India",
      },
      currentAddress: {
        line1: "283/372 Vishnu Garden Maddi wali galli No. 11",
        city: "New Delhi",
        state: "Delhi",
        country: "India",
      },
      emergencyContact: { phone: "7428641278" },
    },
    // 16. Shivam Kumar (EMP-131) - resigned 17 Sep 2025
    {
      employeeNo: "EMP-131",
      firstName: "Shivam",
      lastName: "Kumar",
      email: "findshivamkumar@gmail.com",
      designation: "Team Member",
      department: "Operations",
      role: "employee",
      managerEmployeeNo: null as string | null,
      dateOfJoining: new Date("2025-06-09") as Date | null,
      phone: "+91 74288 03512",
      workLocation: "New Delhi",
      dateOfBirth: new Date("2001-06-17") as Date | null,
      status: "RESIGNED",
      isActive: false,
      lastWorkingDate: new Date("2025-09-17") as Date | null,
      permanentAddress: {
        line1: "55 Haiderpur, Shamilar bagh",
        city: "New Delhi",
        state: "Delhi",
        country: "India",
      },
      currentAddress: {
        line1: "Street no. 41, Kaushik Enclave, Baurari",
        city: "New Delhi",
        state: "Delhi",
        country: "India",
      },
      emergencyContact: { phone: "9289926328" },
    },
    // 17. Mridul Singh Bisht (EMP-132)
    {
      employeeNo: "EMP-132",
      firstName: "Mridul",
      lastName: "Singh Bisht",
      email: "mridulsinghbisht1008@gmail.com",
      designation: "Team Member",
      department: "Operations",
      role: "employee",
      managerEmployeeNo: null as string | null,
      dateOfJoining: new Date("2025-06-16") as Date | null,
      phone: "+91 99587 84985",
      workLocation: "New Delhi",
      dateOfBirth: new Date("2002-08-10") as Date | null,
      status: "ACTIVE",
      isActive: true,
      lastWorkingDate: null as Date | null,
      permanentAddress: {
        line1: "A-3/54 kaushik enclave Burari",
        city: "New Delhi",
        state: "Delhi",
        country: "India",
      },
      currentAddress: {
        line1: "A-3/54 kaushik enclave Burari",
        city: "New Delhi",
        state: "Delhi",
        country: "India",
      },
      emergencyContact: { phone: "9318337612" },
    },
    // 18. Poorva Bisht (EMP-133) - resigned 11 Dec 2025
    {
      employeeNo: "EMP-133",
      firstName: "Poorva",
      lastName: "Bisht",
      email: "poorvabisht09@gmail.com",
      designation: "Team Member",
      department: "Operations",
      role: "employee",
      managerEmployeeNo: null as string | null,
      dateOfJoining: new Date("2025-08-18") as Date | null,
      phone: "+91 95601 40968",
      workLocation: "New Delhi",
      dateOfBirth: new Date("2004-09-14") as Date | null,
      status: "RESIGNED",
      isActive: false,
      lastWorkingDate: new Date("2025-12-11") as Date | null,
      permanentAddress: {
        line1: "Eg-48, 3rd floor, Inderpuri",
        city: "New Delhi",
        state: "Delhi",
        country: "India",
      },
      currentAddress: {
        line1: "Eg-48, 3rd floor, Inderpuri",
        city: "New Delhi",
        state: "Delhi",
        country: "India",
      },
      emergencyContact: { phone: "9953452909" },
    },
    // 19. Tanya Singh (EMP-134) - resigned 31 Oct 2025
    {
      employeeNo: "EMP-134",
      firstName: "Tanya",
      lastName: "Singh",
      email: "tanya9330226154@gmail.com",
      designation: "Team Member",
      department: "Operations",
      role: "employee",
      managerEmployeeNo: null as string | null,
      dateOfJoining: new Date("2025-08-19") as Date | null,
      phone: "+91 93302 26154",
      workLocation: "Howrah",
      dateOfBirth: new Date("2003-11-29") as Date | null,
      status: "RESIGNED",
      isActive: false,
      lastWorkingDate: new Date("2025-10-31") as Date | null,
      permanentAddress: {
        line1: "1 MP Lane (Belur-Howrah)",
        city: "Howrah",
        state: "West Bengal",
        country: "India",
      },
      currentAddress: {
        line1: "Plot-299 A One PG Sec-38 Medicity Islampur",
        city: "Gurugram",
        state: "Haryana",
        country: "India",
      },
      emergencyContact: { phone: "9007834892" },
    },
    // 20. Jatin (EMP-135)
    {
      employeeNo: "EMP-135",
      firstName: "Jatin",
      lastName: "",
      email: "gk2013digital@gmail.com",
      designation: "Team Member",
      department: "Operations",
      role: "employee",
      managerEmployeeNo: null as string | null,
      dateOfJoining: new Date("2025-10-07") as Date | null,
      phone: "+91 87449 88880",
      workLocation: "New Delhi",
      dateOfBirth: new Date("1992-11-29") as Date | null,
      status: "ACTIVE",
      isActive: true,
      lastWorkingDate: null as Date | null,
      permanentAddress: {
        line1: "T-17, Mulchand colony, Adarsh Nagar",
        city: "New Delhi",
        state: "Delhi",
        country: "India",
      },
      currentAddress: {
        line1: "T-17, Mulchand colony, Adarsh Nagar",
        city: "New Delhi",
        state: "Delhi",
        country: "India",
      },
      emergencyContact: { phone: "7678695954" },
    },
    // 21. Hemant (EMP-136)
    {
      employeeNo: "EMP-136",
      firstName: "Hemant",
      lastName: "",
      email: "nandalhemant03@gmail.com",
      designation: "Team Member",
      department: "Operations",
      role: "employee",
      managerEmployeeNo: null as string | null,
      dateOfJoining: new Date("2025-10-29") as Date | null,
      phone: "+91 80761 24881",
      workLocation: "New Delhi",
      dateOfBirth: new Date("2003-02-18") as Date | null,
      status: "ACTIVE",
      isActive: true,
      lastWorkingDate: null as Date | null,
      permanentAddress: {
        line1: "House no. 163, street no. 5, Sangam Vihar, Najafgarh",
        city: "New Delhi",
        state: "Delhi",
        country: "India",
      },
      currentAddress: {
        line1: "House no. 163, street no. 5, Sangam Vihar, Najafgarh",
        city: "New Delhi",
        state: "Delhi",
        country: "India",
      },
      emergencyContact: { phone: "9871156057" },
    },
    // 22. Guruprasad (EMP-149) - resigned 20 Mar 2026; managed by Pankaz
    {
      employeeNo: "EMP-149",
      firstName: "Guruprasad",
      lastName: "",
      email: "dezinerguru42@gmail.com",
      designation: "Video Editor",
      department: "Video Production & Editing",
      role: "employee",
      managerEmployeeNo: "EMP-123" as string | null,
      dateOfJoining: new Date("2025-12-03") as Date | null,
      phone: "+91 99648 15586",
      workLocation: "Bengaluru",
      dateOfBirth: null as Date | null,
      status: "RESIGNED",
      isActive: false,
      lastWorkingDate: new Date("2026-03-20") as Date | null,
      permanentAddress: null,
      currentAddress: null,
      emergencyContact: { phone: "9449525714" },
    },
    // 23. Gavisha (EMP-150) - managed by Pankaz
    {
      employeeNo: "EMP-150",
      firstName: "Gavisha",
      lastName: "",
      email: "gavishadhonsiofficial@gmail.com",
      designation: "UI/UX Designer",
      department: "Design & UX",
      role: "employee",
      managerEmployeeNo: "EMP-123" as string | null,
      dateOfJoining: new Date("2025-12-03") as Date | null,
      phone: "+91 89793 93980",
      workLocation: "Bengaluru",
      dateOfBirth: new Date("1995-11-01") as Date | null,
      status: "ACTIVE",
      isActive: true,
      lastWorkingDate: null as Date | null,
      permanentAddress: {
        line1: "5053 PRESTIGE SUNRISE PARK, Electronic City Phase I",
        city: "Bengaluru",
        state: "Karnataka",
        country: "India",
      },
      currentAddress: {
        line1: "6th Main Rd, Hal, HAL 3rd Stage, New Tippasandra",
        city: "Bengaluru",
        state: "Karnataka",
        country: "India",
      },
      emergencyContact: { phone: "8452052672" },
    },
    // 24. Ayushi Pandey (EMP-137)
    {
      employeeNo: "EMP-137",
      firstName: "Ayushi",
      lastName: "Pandey",
      email: "ayushipandey582@gmail.com",
      designation: "Team Member",
      department: "Operations",
      role: "employee",
      managerEmployeeNo: null as string | null,
      dateOfJoining: new Date("2025-12-01") as Date | null,
      phone: "+91 98185 27772",
      workLocation: "New Delhi",
      dateOfBirth: new Date("2003-12-06") as Date | null,
      status: "ACTIVE",
      isActive: true,
      lastWorkingDate: null as Date | null,
      permanentAddress: {
        line1: "WZ-42, A, Om Vihar, Phase 2, Uttam Nagar",
        city: "New Delhi",
        state: "Delhi",
        country: "India",
      },
      currentAddress: {
        line1: "WZ-42, A, Om Vihar, Phase 2, Uttam Nagar",
        city: "New Delhi",
        state: "Delhi",
        country: "India",
      },
      emergencyContact: { phone: "9560450107" },
    },
    // 25. Shrey Srivastava (EMP-138) - resigned 23 Feb 2026
    {
      employeeNo: "EMP-138",
      firstName: "Shrey",
      lastName: "Srivastava",
      email: "shreyspn@gmail.com",
      designation: "Team Member",
      department: "Operations",
      role: "employee",
      managerEmployeeNo: null as string | null,
      dateOfJoining: new Date("2025-12-08") as Date | null,
      phone: "+91 81759 37590",
      workLocation: "New Delhi",
      dateOfBirth: new Date("1996-06-10") as Date | null,
      status: "RESIGNED",
      isActive: false,
      lastWorkingDate: new Date("2026-02-23") as Date | null,
      permanentAddress: {
        line1: "97, Khalil Sharki Teen",
        city: "Delhi",
        state: "Delhi",
        country: "India",
      },
      currentAddress: {
        line1: "2nd Floor, F-142, Pandav Nagar, Mayur Vihar Phase 1",
        city: "New Delhi",
        state: "Delhi",
        country: "India",
      },
      emergencyContact: { phone: "8826606801" },
    },
    // 26. Raunak (EMP-139) - resigned 13 Jan 2026
    {
      employeeNo: "EMP-139",
      firstName: "Raunak",
      lastName: "",
      email: "raunaksahu0000@gmail.com",
      designation: "Team Member",
      department: "Operations",
      role: "employee",
      managerEmployeeNo: null as string | null,
      dateOfJoining: new Date("2025-12-15") as Date | null,
      phone: "+91 70075 90756",
      workLocation: "Delhi",
      dateOfBirth: null as Date | null,
      status: "RESIGNED",
      isActive: false,
      lastWorkingDate: new Date("2026-01-13") as Date | null,
      permanentAddress: null,
      currentAddress: null,
      emergencyContact: null,
    },
    // 27. Karan Batham (EMP-140)
    {
      employeeNo: "EMP-140",
      firstName: "Karan",
      lastName: "Batham",
      email: "karanbatham211@gmaill.com",
      designation: "Team Member",
      department: "Operations",
      role: "employee",
      managerEmployeeNo: null as string | null,
      dateOfJoining: new Date("2025-12-15") as Date | null,
      phone: "+91 93546 05338",
      workLocation: "Noida",
      dateOfBirth: new Date("1999-04-16") as Date | null,
      status: "ACTIVE",
      isActive: true,
      lastWorkingDate: null as Date | null,
      permanentAddress: {
        line1: "F-60, Sector 27",
        city: "Noida",
        state: "Uttar Pradesh",
        country: "India",
      },
      currentAddress: {
        line1: "F-60, Sector 27",
        city: "Noida",
        state: "Uttar Pradesh",
        country: "India",
      },
      emergencyContact: { phone: "8766286344" },
    },
    // 28. Abdul Ahad Sheikh (EMP-141)
    {
      employeeNo: "EMP-141",
      firstName: "Abdul Ahad",
      lastName: "Sheikh",
      email: "abdulahad.sheikh@hrms.internal",
      designation: "Team Member",
      department: "Operations",
      role: "employee",
      managerEmployeeNo: null as string | null,
      dateOfJoining: new Date("2025-12-22") as Date | null,
      phone: null as string | null,
      workLocation: "Delhi",
      dateOfBirth: null as Date | null,
      status: "ACTIVE",
      isActive: true,
      lastWorkingDate: null as Date | null,
      permanentAddress: null,
      currentAddress: null,
      emergencyContact: null,
    },
    // 29. Sachin BR (EMP-142)
    {
      employeeNo: "EMP-142",
      firstName: "Sachin",
      lastName: "BR",
      email: "brsachin2@gmail.com",
      designation: "Team Member",
      department: "Operations",
      role: "employee",
      managerEmployeeNo: null as string | null,
      dateOfJoining: new Date("2025-12-22") as Date | null,
      phone: "+91 63627 39694",
      workLocation: "Gurugram",
      dateOfBirth: new Date("2000-07-14") as Date | null,
      status: "ACTIVE",
      isActive: true,
      lastWorkingDate: null as Date | null,
      permanentAddress: {
        line1: "Kankeri, Marur Road, Sorab",
        city: "Sorab",
        state: "Karnataka",
        country: "India",
      },
      currentAddress: {
        line1: "U26, DLF Phase-3, Sector 24",
        city: "Gurugram",
        state: "Haryana",
        country: "India",
      },
      emergencyContact: { name: "Brother", phone: "8088028664" },
    },
    // 30. Teesha Jain (EMP-143)
    {
      employeeNo: "EMP-143",
      firstName: "Teesha",
      lastName: "Jain",
      email: "teeshajain001@gmail.com",
      designation: "Team Member",
      department: "Operations",
      role: "employee",
      managerEmployeeNo: null as string | null,
      dateOfJoining: new Date("2026-01-05") as Date | null,
      phone: "+91 98912 31109",
      workLocation: "New Delhi",
      dateOfBirth: new Date("2003-07-01") as Date | null,
      status: "ACTIVE",
      isActive: true,
      lastWorkingDate: null as Date | null,
      permanentAddress: {
        line1: "22, Sukh Vihar, Opposite Gagan Vihar, East Delhi",
        city: "New Delhi",
        state: "Delhi",
        country: "India",
      },
      currentAddress: {
        line1: "22, Sukh Vihar, Opposite Gagan Vihar, East Delhi",
        city: "New Delhi",
        state: "Delhi",
        country: "India",
      },
      emergencyContact: { name: "Father", phone: "9625099487" },
    },
    // 31. Karan Joshi (EMP-144)
    {
      employeeNo: "EMP-144",
      firstName: "Karan",
      lastName: "Joshi",
      email: "joshikaran.aad.0007@gmail.com",
      designation: "Team Member",
      department: "Operations",
      role: "employee",
      managerEmployeeNo: null as string | null,
      dateOfJoining: new Date("2026-02-23") as Date | null,
      phone: "+91 96259 02351",
      workLocation: "Ghaziabad",
      dateOfBirth: new Date("2003-08-12") as Date | null,
      status: "ACTIVE",
      isActive: true,
      lastWorkingDate: null as Date | null,
      permanentAddress: {
        line1: "house no-113, block-d, Khora colony",
        city: "Ghaziabad",
        state: "Uttar Pradesh",
        country: "India",
      },
      currentAddress: {
        line1: "house no-113, block-d, Khora colony",
        city: "Ghaziabad",
        state: "Uttar Pradesh",
        country: "India",
      },
      emergencyContact: { name: "Sister", phone: "9911728554" },
    },
    // 32. Diwakar Jha (EMP-145)
    {
      employeeNo: "EMP-145",
      firstName: "Diwakar",
      lastName: "Jha",
      email: "diwakarjha554@gmail.com",
      designation: "Team Member",
      department: "Operations",
      role: "employee",
      managerEmployeeNo: null as string | null,
      dateOfJoining: new Date("2026-02-23") as Date | null,
      phone: "+91 88826 17743",
      workLocation: "New Delhi",
      dateOfBirth: new Date("2002-03-07") as Date | null,
      status: "ACTIVE",
      isActive: true,
      lastWorkingDate: null as Date | null,
      permanentAddress: {
        line1: "house no-406, block-J, Arpan Vihar, Jaitpur, badarpur",
        city: "New Delhi",
        state: "Delhi",
        country: "India",
      },
      currentAddress: {
        line1: "house no-406, block-J, Arpan Vihar, Jaitpur, badarpur",
        city: "New Delhi",
        state: "Delhi",
        country: "India",
      },
      emergencyContact: { name: "Father", phone: "8700027840" },
    },
    // 33. Komal Gautam (EMP-146)
    {
      employeeNo: "EMP-146",
      firstName: "Komal",
      lastName: "Gautam",
      email: "komalgoutam600@gmail.com",
      designation: "Team Member",
      department: "Operations",
      role: "employee",
      managerEmployeeNo: null as string | null,
      dateOfJoining: new Date("2026-03-06") as Date | null,
      phone: "+91 93544 64123",
      workLocation: "New Delhi",
      dateOfBirth: null as Date | null,
      status: "ACTIVE",
      isActive: true,
      lastWorkingDate: null as Date | null,
      permanentAddress: {
        line1: "TC CAMP 482 Raghubitr Nagar west Delhi",
        city: "New Delhi",
        state: "Delhi",
        country: "India",
      },
      currentAddress: {
        line1: "TC CAMP 482 Raghubitr Nagar west Delhi",
        city: "New Delhi",
        state: "Delhi",
        country: "India",
      },
      emergencyContact: { name: "Sister", phone: "7827815507" },
    },
    // 34. Hari Narayan Jha (EMP-147) - resigned 24 Mar 2026
    {
      employeeNo: "EMP-147",
      firstName: "Hari Narayan",
      lastName: "Jha",
      email: "harialldata@gmail.com",
      designation: "Team Member",
      department: "Operations",
      role: "employee",
      managerEmployeeNo: null as string | null,
      dateOfJoining: new Date("2026-03-09") as Date | null,
      phone: "+91 98711 77757",
      workLocation: "New Delhi",
      dateOfBirth: new Date("1986-05-16") as Date | null,
      status: "RESIGNED",
      isActive: false,
      lastWorkingDate: new Date("2026-03-24") as Date | null,
      permanentAddress: {
        line1: "A-74 West vinod nagar",
        city: "New Delhi",
        state: "Delhi",
        country: "India",
      },
      currentAddress: {
        line1: "A-74 West vinod nagar",
        city: "New Delhi",
        state: "Delhi",
        country: "India",
      },
      emergencyContact: { name: "Mother", phone: "9958844349" },
    },
  ]

  // Pass 1 - create employees without manager references
  const createdEmployees: Array<{ id: string; employeeNo: string }> = []

  for (const emp of employeesData) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { role, managerEmployeeNo, department, designation, ...empFields } = emp

    const employee = await prisma.employee.create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {
        employeeNo: emp.employeeNo,
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email,
        phone: emp.phone ?? null,
        workLocation: emp.workLocation ?? null,
        dateOfJoining: emp.dateOfJoining ?? null,
        dateOfBirth: emp.dateOfBirth ?? null,
        status: emp.status as any,
        isActive: emp.isActive,
        lastWorkingDate: emp.lastWorkingDate ?? null,
        permanentAddress: emp.permanentAddress ?? null,
        currentAddress: emp.currentAddress ?? null,
        emergencyContact: emp.emergencyContact ?? null,
        departmentId: departmentMap.get(emp.department) ?? null,
        designationId: designationMap.get(emp.designation) ?? null,
        passwordHash,
        emailVerified: emp.isActive ? new Date() : null,
        // managerId will be set in pass 2
      } as any,
    })

    createdEmployees.push({ id: employee.id, employeeNo: employee.employeeNo })
    console.log(
      `  ✓ Created employee ${employee.employeeNo} - ${empFields.firstName} ${empFields.lastName}`,
    )
  }

  // Build employeeNo → id map
  const employeeNoToId = new Map(createdEmployees.map((e) => [e.employeeNo, e.id]))

  // Pass 2 - update manager references
  for (const emp of employeesData) {
    if (!emp.managerEmployeeNo) continue
    const employeeId = employeeNoToId.get(emp.employeeNo)
    const managerId = employeeNoToId.get(emp.managerEmployeeNo)
    if (employeeId && managerId) {
      await prisma.employee.update({
        where: { id: employeeId },
        data: { managerId },
      })
    }
  }

  console.log("  ✓ Manager references updated")

  // Assign roles to employees
  for (const emp of employeesData) {
    const employeeId = employeeNoToId.get(emp.employeeNo)
    const roleId = roleMap.get(emp.role)
    if (employeeId && roleId) {
      await prisma.employeeRole.create({
        data: { employeeId, roleId },
      })
    }
  }

  console.log("  ✓ Employee roles assigned")

  // ===========================================================================
  // STEP 7 - Create email templates
  // ===========================================================================
  console.log("Step 7: Creating email templates...")

  const welcomeHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to {{company_name}}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, sans-serif; background-color: #f4f6f9; color: #333; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #2563EB 0%, #1d4ed8 100%); padding: 40px 32px; text-align: center; }
    .header h1 { color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 4px; }
    .header p { color: rgba(255,255,255,0.85); font-size: 14px; }
    .body { padding: 40px 32px; }
    .greeting { font-size: 20px; font-weight: 600; color: #111827; margin-bottom: 16px; }
    .text { font-size: 15px; line-height: 1.7; color: #4B5563; margin-bottom: 24px; }
    .details-box { background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 24px; margin-bottom: 32px; }
    .details-box h3 { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px; color: #6B7280; margin-bottom: 16px; }
    .detail-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #E5E7EB; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { font-size: 13px; color: #6B7280; }
    .detail-value { font-size: 13px; font-weight: 500; color: #111827; }
    .cta-wrapper { text-align: center; margin: 32px 0; }
    .cta-btn { display: inline-block; background: #2563EB; color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 15px; font-weight: 600; letter-spacing: 0.2px; }
    .cta-btn:hover { background: #1d4ed8; }
    .note { font-size: 13px; color: #9CA3AF; text-align: center; margin-top: 8px; }
    .footer { background: #F9FAFB; border-top: 1px solid #E5E7EB; padding: 24px 32px; text-align: center; }
    .footer p { font-size: 12px; color: #9CA3AF; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>{{company_name}}</h1>
      <p>Digitally Next Management System</p>
    </div>
    <div class="body">
      <p class="greeting">Welcome aboard, {{first_name}}!</p>
      <p class="text">
        We're thrilled to have you join the {{company_name}} family. Your account has been set up and
        you're ready to get started with the DNMS portal. Below are the details of your profile.
      </p>
      <div class="details-box">
        <h3>Your Details</h3>
        <div class="detail-row">
          <span class="detail-label">Full Name</span>
          <span class="detail-value">{{first_name}} {{last_name}}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Department</span>
          <span class="detail-value">{{department}}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Designation</span>
          <span class="detail-value">{{designation}}</span>
        </div>
      </div>
      <div class="cta-wrapper">
        <a href="{{login_url}}" class="cta-btn">Log In to DNMS Portal</a>
        <p class="note">Button not working? Copy and paste this link into your browser:<br />{{login_url}}</p>
      </div>
      <p class="text">
        If you have any questions or need assistance, please don't hesitate to reach out to the HR team.
        We're here to help you settle in smoothly.
      </p>
    </div>
    <div class="footer">
      <p>This is an automated email from {{company_name}} DNMS. Please do not reply directly to this email.</p>
      <p style="margin-top: 4px;">© {{company_name}}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`

  const passwordResetHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset Your Password</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, sans-serif; background-color: #f4f6f9; color: #333; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #2563EB 0%, #1d4ed8 100%); padding: 40px 32px; text-align: center; }
    .header h1 { color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 4px; }
    .header p { color: rgba(255,255,255,0.85); font-size: 14px; }
    .body { padding: 40px 32px; }
    .greeting { font-size: 20px; font-weight: 600; color: #111827; margin-bottom: 16px; }
    .text { font-size: 15px; line-height: 1.7; color: #4B5563; margin-bottom: 24px; }
    .warning-box { background: #FEF3C7; border: 1px solid #FCD34D; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px; }
    .warning-box p { font-size: 13px; color: #92400E; line-height: 1.6; }
    .cta-wrapper { text-align: center; margin: 32px 0; }
    .cta-btn { display: inline-block; background: #2563EB; color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 15px; font-weight: 600; letter-spacing: 0.2px; }
    .cta-btn:hover { background: #1d4ed8; }
    .note { font-size: 13px; color: #9CA3AF; text-align: center; margin-top: 8px; }
    .footer { background: #F9FAFB; border-top: 1px solid #E5E7EB; padding: 24px 32px; text-align: center; }
    .footer p { font-size: 12px; color: #9CA3AF; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>DNMS Portal</h1>
      <p>Password Reset Request</p>
    </div>
    <div class="body">
      <p class="greeting">Hi {{first_name}},</p>
      <p class="text">
        We received a request to reset the password for your DNMS account. Click the button below
        to choose a new password. This link is valid for <strong>1 hour</strong>.
      </p>
      <div class="cta-wrapper">
        <a href="{{reset_url}}" class="cta-btn">Reset My Password</a>
        <p class="note">Button not working? Copy and paste this link into your browser:<br />{{reset_url}}</p>
      </div>
      <div class="warning-box">
        <p>
          <strong>Didn't request this?</strong> If you didn't request a password reset, you can safely
          ignore this email. Your password will remain unchanged and no action is required.
        </p>
      </div>
      <p class="text">
        For security reasons, this link will expire in 1 hour. If you need a new link, please visit
        the login page and request another password reset.
      </p>
    </div>
    <div class="footer">
      <p>This is an automated email from the DNMS system. Please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>`

  await prisma.emailTemplate.create({
    data: {
      slug: "welcome-email",
      name: "Welcome Email",
      subject: "Welcome to {{company_name}}, {{first_name}}!",
      bodyHtml: welcomeHtml,
      mergeFields: [
        "first_name",
        "last_name",
        "company_name",
        "department",
        "designation",
        "login_url",
      ],
      isActive: true,
      trigger: "employee:created",
    },
  })

  await prisma.emailTemplate.create({
    data: {
      slug: "password-reset",
      name: "Password Reset",
      subject: "Reset your DNMS password",
      bodyHtml: passwordResetHtml,
      mergeFields: ["first_name", "reset_url"],
      isActive: true,
      trigger: "auth:password_reset",
    },
  })

  console.log("  ✓ Created 2 email templates")

  // ===========================================================================
  // STEP 8 - Attendance policy, holidays, device
  // ===========================================================================
  console.log("Step 8: Creating attendance policy, holidays & device...")

  await prisma.attendancePolicy.create({
    data: {
      name: "Standard Policy",
      workHoursPerDay: 8,
      workDaysPerWeek: 5,
      checkInTime: "09:00",
      checkOutTime: "18:00",
      lateGraceMins: 15,
      isDefault: true,
    },
  })

  // Digitally Next 2026 Holiday Calendar - 8 fixed + 12 floating (employees pick any 3)
  const holidays2026 = [
    // ─── 8 Fixed holidays - auto-applied to everyone ───
    { name: "Republic Day", date: new Date("2026-01-26"), isOptional: false },
    { name: "Holi", date: new Date("2026-03-04"), isOptional: false },
    { name: "Bakrid (Eid-ul-Adha)", date: new Date("2026-05-28"), isOptional: false },
    { name: "Independence Day", date: new Date("2026-08-15"), isOptional: false },
    { name: "Mahatma Gandhi Jayanti", date: new Date("2026-10-02"), isOptional: false },
    { name: "Dussehra", date: new Date("2026-10-20"), isOptional: false },
    { name: "Diwali", date: new Date("2026-11-08"), isOptional: false },
    { name: "Christmas", date: new Date("2026-12-25"), isOptional: false },

    // ─── 12 Floating holidays - each employee may pick 3 ───
    { name: "Makar Sankranti / Pongal", date: new Date("2026-01-14"), isOptional: true },
    { name: "Maha Shivratri", date: new Date("2026-02-15"), isOptional: true },
    { name: "Eid-ul-Fitr", date: new Date("2026-03-21"), isOptional: true },
    { name: "Ram Navami", date: new Date("2026-03-26"), isOptional: true },
    { name: "Good Friday", date: new Date("2026-04-03"), isOptional: true },
    { name: "Buddha Purnima", date: new Date("2026-05-01"), isOptional: true },
    { name: "Muharram", date: new Date("2026-06-26"), isOptional: true },
    { name: "Raksha Bandhan", date: new Date("2026-08-28"), isOptional: true },
    { name: "Janmashtami", date: new Date("2026-09-04"), isOptional: true },
    { name: "Ganesh Chaturthi", date: new Date("2026-09-14"), isOptional: true },
    { name: "Govardhan Puja", date: new Date("2026-11-09"), isOptional: true },
    { name: "Bhai Dooj", date: new Date("2026-11-11"), isOptional: true },
  ]

  await safeCreateMany(prisma.holiday, holidays2026)

  await prisma.hikvisionDevice.create({
    data: {
      name: "Main Entrance",
      deviceSerial: "DS-K1T671TMW-001",
      ipAddress: "192.168.1.100",
      port: 8000,
      username: "admin",
      password: "Admin@123",
      location: "Mumbai HQ - Ground Floor",
      isActive: true,
    },
  })

  console.log(
    `  ✓ Created attendance policy, ${holidays2026.length} holidays (8 fixed + 12 floating), 1 device`,
  )

  // ===========================================================================
  // STEP 9 - Leave types
  // ===========================================================================
  console.log("Step 9: Creating leave types...")

  const leaveTypesData = [
    // CL: 7 days prorata, no carry, max 2/month, requires 2-day advance notice
    {
      name: "Casual Leave",
      code: "CL",
      description:
        "Short personal leave. Max 2 days per month. Requires 2 days advance notice - late applications attract double salary deduction. Lapses Dec 31.",
      isPaid: true,
      maxDaysPerYear: 7,
      carryForward: false,
      maxCarryDays: 0,
      requiresApproval: true,
    },
    // SL: 7 days prorata, no carry, SL>2 days needs medical certificate
    {
      name: "Sick Leave",
      code: "SL",
      description:
        "Medical/health leave. SL > 2 days requires medical certificate. Can be clubbed with CL but not with EL. Lapses Dec 31.",
      isPaid: true,
      maxDaysPerYear: 7,
      carryForward: false,
      maxCarryDays: 0,
      requiresApproval: false,
    },
    // EL: 14 days, 1.16/month accrual, max 22 carry, eligibility: probation + 6 months, 60-day advance notice, min 3 max 7 at a time
    {
      name: "Earned Leave",
      code: "EL",
      description:
        "1.16 days earned per month. Requires 60 days advance notice. Min 3 days, max 7 days at a time. Max carry-forward 22 days. 7 days each in H1 (Jan–Jun) and H2 (Jul–Dec).",
      isPaid: true,
      maxDaysPerYear: 14,
      carryForward: true,
      maxCarryDays: 22,
      requiresApproval: true,
    },
    // PL: 2 days, after probation, for special events, no carry
    {
      name: "Personal Leave",
      code: "PL",
      description:
        "For special events: birthday (self/spouse/children), marriage, anniversary, bereavement. Cannot be accumulated or encashed.",
      isPaid: true,
      maxDaysPerYear: 2,
      carryForward: false,
      maxCarryDays: 0,
      requiresApproval: true,
    },
    // LWP: Leave Without Pay - extraordinary circumstances
    {
      name: "Leave Without Pay",
      code: "LWP",
      description:
        "Unpaid leave for extraordinary circumstances when all balances are exhausted. Requires 2 days advance notice. Salary deduction = monthly salary / month days × leave days.",
      isPaid: false,
      maxDaysPerYear: 0,
      carryForward: false,
      maxCarryDays: 0,
      requiresApproval: true,
    },
    // ML: 90 days, requires 2 years service
    {
      name: "Maternity Leave",
      code: "ML",
      description: "Paid maternity leave. Only available after completing 2 years of service.",
      isPaid: true,
      maxDaysPerYear: 90,
      carryForward: false,
      maxCarryDays: 0,
      requiresApproval: true,
    },
    // Short Leave: 2 hours = 0.5 day unit, max 2 per month (3rd onwards = 0.5 day LWP)
    {
      name: "Short Leave",
      code: "SHORT",
      description:
        "2-hour leave (arrive late or leave early). Each use counts as 0.5 day. Max 2 per month - 3rd onwards treated as half-day without pay.",
      isPaid: true,
      maxDaysPerYear: 12,
      carryForward: false,
      maxCarryDays: 0,
      requiresApproval: true,
    },
  ]

  await safeCreateMany(prisma.leaveType, leaveTypesData)
  const leaveTypeRecords = await prisma.leaveType.findMany()
  const leaveTypeMap = new Map(leaveTypeRecords.map((lt) => [lt.code, lt.id]))

  console.log(`  ✓ Created ${leaveTypeRecords.length} leave types`)

  // ===========================================================================
  // STEP 10 - Leave balances for all employees (current year)
  // ===========================================================================
  console.log("Step 10: Creating leave balances...")

  const currentYear = new Date().getFullYear()
  const allEmployeeIds = createdEmployees.map((e) => e.id)

  const leaveBalanceData: Array<{
    employeeId: string
    leaveTypeId: string
    year: number
    allocated: number
    used: number
    pending: number
    carried: number
  }> = []

  for (const empId of allEmployeeIds) {
    leaveBalanceData.push(
      {
        employeeId: empId,
        leaveTypeId: leaveTypeMap.get("CL")!,
        year: currentYear,
        allocated: 7,
        used: 1,
        pending: 0,
        carried: 0,
      },
      {
        employeeId: empId,
        leaveTypeId: leaveTypeMap.get("SL")!,
        year: currentYear,
        allocated: 7,
        used: 1,
        pending: 0,
        carried: 0,
      },
      {
        employeeId: empId,
        leaveTypeId: leaveTypeMap.get("EL")!,
        year: currentYear,
        allocated: 14,
        used: 3,
        pending: 0,
        carried: 2,
      },
      {
        employeeId: empId,
        leaveTypeId: leaveTypeMap.get("PL")!,
        year: currentYear,
        allocated: 2,
        used: 0,
        pending: 0,
        carried: 0,
      },
      {
        employeeId: empId,
        leaveTypeId: leaveTypeMap.get("LWP")!,
        year: currentYear,
        allocated: 0,
        used: 0,
        pending: 0,
        carried: 0,
      },
      {
        employeeId: empId,
        leaveTypeId: leaveTypeMap.get("ML")!,
        year: currentYear,
        allocated: 90,
        used: 0,
        pending: 0,
        carried: 0,
      },
    )
  }

  await safeCreateMany(prisma.leaveBalance, leaveBalanceData)
  console.log(`  ✓ Created ${leaveBalanceData.length} leave balances`)

  // ===========================================================================
  // STEP 11 - Salary structures
  // ===========================================================================
  console.log("Step 11: Creating salary structures...")

  // Salary structures derived from actual CTC data in employee records
  // Monthly breakdown: Basic=40%, HRA=40% of Basic, Conv=1600, Med=1250, Other=remainder
  const salaryData = [
    {
      employeeNo: "EMP-112",
      basicSalary: 13600,
      hra: 5440,
      conveyance: 1600,
      medicalAllowance: 1250,
      otherAllowances: 12110,
      pfEmployee: 1632,
      pfEmployer: 1632,
      esi: 0,
      tds: 0,
    }, // 34k/mo (4.08L CTC)
    {
      employeeNo: "EMP-113",
      basicSalary: 18000,
      hra: 7200,
      conveyance: 1600,
      medicalAllowance: 1250,
      otherAllowances: 16950,
      pfEmployee: 1800,
      pfEmployer: 1800,
      esi: 0,
      tds: 0,
    }, // 45k/mo (5.40L CTC)
    {
      employeeNo: "EMP-115",
      basicSalary: 17200,
      hra: 6880,
      conveyance: 1600,
      medicalAllowance: 1250,
      otherAllowances: 16070,
      pfEmployee: 1800,
      pfEmployer: 1800,
      esi: 0,
      tds: 0,
    }, // 43k/mo (5.20L CTC)
    {
      employeeNo: "EMP-118",
      basicSalary: 14000,
      hra: 5600,
      conveyance: 1600,
      medicalAllowance: 1250,
      otherAllowances: 12550,
      pfEmployee: 1680,
      pfEmployer: 1680,
      esi: 0,
      tds: 0,
    }, // 35k/mo (4.20L CTC)
    {
      employeeNo: "EMP-119",
      basicSalary: 12000,
      hra: 4800,
      conveyance: 1600,
      medicalAllowance: 1250,
      otherAllowances: 10350,
      pfEmployee: 1440,
      pfEmployer: 1440,
      esi: 0,
      tds: 0,
    }, // 30k/mo (3.60L CTC)
    {
      employeeNo: "EMP-121",
      basicSalary: 16000,
      hra: 6400,
      conveyance: 1600,
      medicalAllowance: 1250,
      otherAllowances: 14750,
      pfEmployee: 1800,
      pfEmployer: 1800,
      esi: 0,
      tds: 0,
    }, // 40k/mo (4.80L CTC)
    {
      employeeNo: "EMP-123",
      basicSalary: 24000,
      hra: 9600,
      conveyance: 1600,
      medicalAllowance: 1250,
      otherAllowances: 23550,
      pfEmployee: 1800,
      pfEmployer: 1800,
      esi: 0,
      tds: 0,
    }, // 60k/mo (7.20L CTC)
    {
      employeeNo: "EMP-124",
      basicSalary: 10000,
      hra: 4000,
      conveyance: 1600,
      medicalAllowance: 1250,
      otherAllowances: 8150,
      pfEmployee: 1200,
      pfEmployer: 1200,
      esi: 0,
      tds: 0,
    }, // 25k/mo (3.00L CTC)
    {
      employeeNo: "EMP-125",
      basicSalary: 14000,
      hra: 5600,
      conveyance: 1600,
      medicalAllowance: 1250,
      otherAllowances: 12550,
      pfEmployee: 1680,
      pfEmployer: 1680,
      esi: 0,
      tds: 0,
    }, // 35k/mo (4.20L CTC)
    {
      employeeNo: "EMP-126",
      basicSalary: 16000,
      hra: 6400,
      conveyance: 1600,
      medicalAllowance: 1250,
      otherAllowances: 14750,
      pfEmployee: 1800,
      pfEmployer: 1800,
      esi: 0,
      tds: 0,
    }, // 40k/mo (4.80L CTC)
    {
      employeeNo: "EMP-128",
      basicSalary: 14800,
      hra: 5920,
      conveyance: 1600,
      medicalAllowance: 1250,
      otherAllowances: 13430,
      pfEmployee: 1776,
      pfEmployer: 1776,
      esi: 0,
      tds: 0,
    }, // 37k/mo (4.44L CTC)
    {
      employeeNo: "EMP-129",
      basicSalary: 12800,
      hra: 5120,
      conveyance: 1600,
      medicalAllowance: 1250,
      otherAllowances: 11230,
      pfEmployee: 1536,
      pfEmployer: 1536,
      esi: 0,
      tds: 0,
    }, // 32k/mo (3.84L CTC)
    {
      employeeNo: "EMP-130",
      basicSalary: 11600,
      hra: 4640,
      conveyance: 1600,
      medicalAllowance: 1250,
      otherAllowances: 9910,
      pfEmployee: 1392,
      pfEmployer: 1392,
      esi: 0,
      tds: 0,
    }, // 29k/mo (3.48L CTC)
    {
      employeeNo: "EMP-131",
      basicSalary: 17200,
      hra: 6880,
      conveyance: 1600,
      medicalAllowance: 1250,
      otherAllowances: 16070,
      pfEmployee: 1800,
      pfEmployer: 1800,
      esi: 0,
      tds: 0,
    }, // 43k/mo (5.16L CTC)
    {
      employeeNo: "EMP-132",
      basicSalary: 8800,
      hra: 3520,
      conveyance: 1600,
      medicalAllowance: 1250,
      otherAllowances: 6830,
      pfEmployee: 1056,
      pfEmployer: 1056,
      esi: 165,
      tds: 0,
    }, // 22k/mo (2.64L CTC)
    {
      employeeNo: "EMP-133",
      basicSalary: 12000,
      hra: 4800,
      conveyance: 1600,
      medicalAllowance: 1250,
      otherAllowances: 10350,
      pfEmployee: 1440,
      pfEmployer: 1440,
      esi: 0,
      tds: 0,
    }, // 30k/mo (3.60L CTC)
    {
      employeeNo: "EMP-134",
      basicSalary: 15200,
      hra: 6080,
      conveyance: 1600,
      medicalAllowance: 1250,
      otherAllowances: 13870,
      pfEmployee: 1800,
      pfEmployer: 1800,
      esi: 0,
      tds: 0,
    }, // 38k/mo (4.56L CTC)
  ]

  for (const s of salaryData) {
    const empId = employeeNoToId.get(s.employeeNo)
    if (!empId) continue
    await prisma.salaryStructure.create({
      data: {
        employeeId: empId,
        basicSalary: s.basicSalary,
        hra: s.hra,
        conveyance: s.conveyance,
        medicalAllowance: s.medicalAllowance,
        otherAllowances: s.otherAllowances,
        pfEmployee: s.pfEmployee,
        pfEmployer: s.pfEmployer,
        esi: s.esi,
        tds: s.tds,
        effectiveFrom: new Date("2024-01-01"),
      },
    })
  }

  console.log(`  ✓ Created ${salaryData.length} salary structures`)

  // ===========================================================================
  // STEP 12 - Attendance logs (last 60 days)
  // ===========================================================================
  console.log("Step 12: Creating attendance logs...")

  function getRandomCheckIn(): Date {
    const d = new Date()
    d.setHours(8 + Math.floor(Math.random() * 2))
    d.setMinutes(Math.floor(Math.random() * 60))
    d.setSeconds(0, 0)
    return d
  }

  function getRandomCheckOut(checkIn: Date): Date {
    const d = new Date(checkIn)
    d.setHours(d.getHours() + 8 + Math.floor(Math.random() * 2))
    d.setMinutes(Math.floor(Math.random() * 60))
    return d
  }

  const attendanceLogs: Array<{
    employeeId: string
    date: Date
    checkIn: Date | null
    checkOut: Date | null
    workHours: number | null
    status: "PRESENT" | "ABSENT" | "LATE" | "WEEKEND" | "HOLIDAY"
    isManual: boolean
  }> = []

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const holidayDates = new Set(holidays2026.map((h) => h.date.toISOString().split("T")[0]))

  for (let daysAgo = 60; daysAgo >= 1; daysAgo--) {
    const date = new Date(today)
    date.setDate(today.getDate() - daysAgo)
    date.setHours(0, 0, 0, 0)

    const dayOfWeek = date.getDay()
    const dateStr = date.toISOString().split("T")[0]
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const isHoliday = holidayDates.has(dateStr)

    for (const emp of createdEmployees) {
      if (isWeekend) {
        attendanceLogs.push({
          employeeId: emp.id,
          date,
          checkIn: null,
          checkOut: null,
          workHours: null,
          status: "WEEKEND",
          isManual: false,
        })
        continue
      }
      if (isHoliday) {
        attendanceLogs.push({
          employeeId: emp.id,
          date,
          checkIn: null,
          checkOut: null,
          workHours: null,
          status: "HOLIDAY",
          isManual: false,
        })
        continue
      }

      const rand = Math.random()
      if (rand < 0.05) {
        // 5% absent
        attendanceLogs.push({
          employeeId: emp.id,
          date,
          checkIn: null,
          checkOut: null,
          workHours: null,
          status: "ABSENT",
          isManual: false,
        })
      } else {
        const checkIn = getRandomCheckIn()
        const checkOut = getRandomCheckOut(checkIn)
        const checkInDate = new Date(date)
        checkInDate.setHours(checkIn.getHours(), checkIn.getMinutes(), 0, 0)
        const checkOutDate = new Date(date)
        checkOutDate.setHours(checkOut.getHours(), checkOut.getMinutes(), 0, 0)
        const workHours =
          Math.round(((checkOutDate.getTime() - checkInDate.getTime()) / 3600000) * 100) / 100
        const isLate =
          checkIn.getHours() > 9 || (checkIn.getHours() === 9 && checkIn.getMinutes() > 15)
        attendanceLogs.push({
          employeeId: emp.id,
          date,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          workHours,
          status: isLate ? "LATE" : "PRESENT",
          isManual: false,
        })
      }
    }
  }

  await safeCreateMany(prisma.attendanceLog, attendanceLogs)
  console.log(`  ✓ Created ${attendanceLogs.length} attendance logs`)

  // ===========================================================================
  // STEP 13 - Projects & Tasks
  // ===========================================================================
  console.log("Step 13: Creating projects & tasks...")

  // Seed default project phases (PMI lifecycle)
  await safeCreateMany(prisma.projectPhase, [
    {
      name: "Initiation",
      description: "Define the project, identify stakeholders, set initial scope",
      displayOrder: 1,
    },
    {
      name: "Planning",
      description: "Detailed plan, timeline, resource allocation",
      displayOrder: 2,
    },
    { name: "Executing", description: "Active delivery of project work", displayOrder: 3 },
    {
      name: "Monitoring & Controlling",
      description: "Track progress, manage changes, quality control",
      displayOrder: 4,
    },
    {
      name: "Closure",
      description: "Final delivery, retrospective, handover, archival",
      displayOrder: 5,
    },
  ])
  const initiationPhase = await prisma.projectPhase.findFirst({
    where: { name: "Initiation", parentId: null },
  })
  const executingPhase = await prisma.projectPhase.findFirst({
    where: { name: "Executing", parentId: null },
  })

  const adminId = employeeNoToId.get("EMP-001")!
  const rupamId = employeeNoToId.get("EMP-113")! // Rupam - senior active employee
  const shaileshId = employeeNoToId.get("EMP-125")! // Shailesh Patwal
  const praneetId = employeeNoToId.get("EMP-126")! // Praneet Nitin
  const vivekId = employeeNoToId.get("EMP-124")! // Vivek

  // Additional employee IDs needed for diverse team membership
  const aditiId = employeeNoToId.get("EMP-112")! // Aditi
  const shivamId = employeeNoToId.get("EMP-119")! // Shivam
  const saurabhId = employeeNoToId.get("EMP-129")! // Saurabh Singh Rawat
  const mridulId = employeeNoToId.get("EMP-132")! // Mridul
  const jatinId = employeeNoToId.get("EMP-135")! // Jatin
  const hemantId = employeeNoToId.get("EMP-136")! // Hemant
  const ayushiId = employeeNoToId.get("EMP-137")! // Ayushi
  const teeshaId = employeeNoToId.get("EMP-143")! // Teesha
  const diwakarId = employeeNoToId.get("EMP-145")! // Diwakar
  const komalId = employeeNoToId.get("EMP-146")! // Komal

  // Helper to create a team + members + manager + tasks
  async function createTeamWithMembers(
    projectId: string,
    teamName: string,
    description: string,
    managerEmployeeId: string,
    memberEmployeeIds: string[],
    tasks: Array<{
      title: string
      description?: string
      status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE"
      priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
      assigneeId: string
      creatorId: string
      dueDate?: Date
      completedAt?: Date
      approvalStatus?: "APPROVED" | "PENDING_APPROVAL" | "REJECTED"
      isManagerCreated?: boolean
      rejectionReason?: string
    }>,
  ) {
    const team = await prisma.projectTeam.create({
      data: {
        projectId,
        name: teamName,
        description,
        managerId: managerEmployeeId,
      },
    })

    // Insert manager + members (manager included in member list)
    const memberIds = [
      managerEmployeeId,
      ...memberEmployeeIds.filter((id) => id !== managerEmployeeId),
    ]
    await safeCreateMany(
      prisma.projectTeamMember,
      memberIds.map((employeeId) => ({
        teamId: team.id,
        projectId,
        employeeId,
      })),
    )

    // Tasks
    for (const t of tasks) {
      await prisma.projectTask.create({
        data: {
          projectId,
          teamId: team.id,
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          assigneeId: t.assigneeId,
          creatorId: t.creatorId,
          dueDate: t.dueDate,
          completedAt: t.completedAt,
          approvalStatus: t.approvalStatus ?? "APPROVED",
          isManagerCreated: t.isManagerCreated ?? true,
          rejectionReason: t.rejectionReason,
        },
      })
    }

    return team
  }

  // ─── Project 1: Acme Website Redesign ───
  const project1 = await prisma.project.create({
    data: {
      name: "Acme Website Redesign",
      code: "DN00001",
      description:
        "Complete redesign and rebuild of Acme's marketing website with new branding, content, and SEO foundation.",
      status: "ACTIVE",
      priority: "HIGH",
      currentPhaseId: executingPhase?.id ?? null,
      startDate: new Date("2026-04-01"),
      endDate: new Date("2026-07-31"),
      budget: 850000,
      ownerId: rupamId,
    },
  })

  await createTeamWithMembers(
    project1.id,
    "Web Development",
    "Frontend + backend implementation, hosting, deployment",
    vivekId, // Manager
    [shaileshId, saurabhId, mridulId], // Members
    [
      {
        title: "Set up Next.js project + Vercel deployment",
        status: "DONE",
        priority: "HIGH",
        assigneeId: shaileshId,
        creatorId: vivekId,
        completedAt: new Date("2026-04-10"),
      },
      {
        title: "Build homepage hero section",
        status: "IN_PROGRESS",
        priority: "HIGH",
        assigneeId: saurabhId,
        creatorId: vivekId,
        dueDate: new Date("2026-05-25"),
      },
      {
        title: "Implement contact form with email",
        status: "TODO",
        priority: "MEDIUM",
        assigneeId: mridulId,
        creatorId: vivekId,
        dueDate: new Date("2026-06-05"),
      },
      {
        title: "Refactor navigation for mobile",
        status: "TODO",
        priority: "MEDIUM",
        assigneeId: saurabhId,
        creatorId: saurabhId,
        approvalStatus: "PENDING_APPROVAL",
        isManagerCreated: false,
      },
    ],
  )

  await createTeamWithMembers(
    project1.id,
    "Design",
    "Visual design, branding, illustrations, UI mockups",
    aditiId, // Manager
    [teeshaId, komalId], // Members
    [
      {
        title: "Finalise brand colour palette",
        status: "DONE",
        priority: "URGENT",
        assigneeId: aditiId,
        creatorId: aditiId,
        completedAt: new Date("2026-04-12"),
      },
      {
        title: "Design homepage mockups (3 variations)",
        status: "IN_REVIEW",
        priority: "HIGH",
        assigneeId: teeshaId,
        creatorId: aditiId,
        dueDate: new Date("2026-05-22"),
      },
      {
        title: "Create illustration set for features section",
        status: "TODO",
        priority: "MEDIUM",
        assigneeId: komalId,
        creatorId: aditiId,
        dueDate: new Date("2026-06-01"),
      },
      {
        title: "Explore dark-mode variants",
        status: "TODO",
        priority: "LOW",
        assigneeId: komalId,
        creatorId: komalId,
        approvalStatus: "PENDING_APPROVAL",
        isManagerCreated: false,
      },
    ],
  )

  await createTeamWithMembers(
    project1.id,
    "Content",
    "Copywriting, blog migration, SEO content",
    ayushiId, // Manager
    [praneetId, diwakarId], // Members
    [
      {
        title: "Write homepage hero copy",
        status: "DONE",
        priority: "HIGH",
        assigneeId: ayushiId,
        creatorId: ayushiId,
        completedAt: new Date("2026-04-15"),
      },
      {
        title: "Migrate 25 old blog posts",
        status: "IN_PROGRESS",
        priority: "HIGH",
        assigneeId: praneetId,
        creatorId: ayushiId,
        dueDate: new Date("2026-05-30"),
      },
      {
        title: "Draft About Us page copy",
        status: "TODO",
        priority: "MEDIUM",
        assigneeId: diwakarId,
        creatorId: ayushiId,
        dueDate: new Date("2026-06-10"),
      },
    ],
  )

  // ─── Project 2: Q2 Marketing Campaign ───
  const project2 = await prisma.project.create({
    data: {
      name: "Q2 Marketing Campaign",
      code: "DN00002",
      description:
        "Multi-channel marketing campaign for new product launch - paid ads, SEO content, social, video.",
      status: "ACTIVE",
      priority: "URGENT",
      startDate: new Date("2026-04-15"),
      endDate: new Date("2026-06-30"),
      budget: 500000,
      ownerId: rupamId,
      currentPhaseId: executingPhase?.id ?? null,
    },
  })

  await createTeamWithMembers(
    project2.id,
    "Paid Ads",
    "Google Ads, Meta Ads, LinkedIn campaigns",
    hemantId, // Manager
    [shivamId, jatinId], // Members
    [
      {
        title: "Audit existing ad accounts",
        status: "DONE",
        priority: "URGENT",
        assigneeId: hemantId,
        creatorId: hemantId,
        completedAt: new Date("2026-04-20"),
      },
      {
        title: "Set up Q2 Google Ads structure",
        status: "IN_PROGRESS",
        priority: "HIGH",
        assigneeId: shivamId,
        creatorId: hemantId,
        dueDate: new Date("2026-05-20"),
      },
      {
        title: "Create Meta Ads creatives",
        status: "TODO",
        priority: "HIGH",
        assigneeId: jatinId,
        creatorId: hemantId,
        dueDate: new Date("2026-05-25"),
      },
    ],
  )

  // Note: an employee can only be on ONE team per project, but they CAN be on different
  // teams across different projects (e.g., Shailesh on P1 Web Dev AND P2 Video Production).
  await createTeamWithMembers(
    project2.id,
    "Video Production",
    "Promo videos, social shorts, B-roll",
    shaileshId, // Manager
    [],
    [
      {
        title: "Storyboard for product launch video",
        status: "TODO",
        priority: "HIGH",
        assigneeId: shaileshId,
        creatorId: shaileshId,
        dueDate: new Date("2026-05-20"),
      },
    ],
  )

  // ─── Project 3: Internal DNMS Improvements ───
  const project3 = await prisma.project.create({
    data: {
      name: "DNMS Internal Improvements",
      code: "DN00003",
      description:
        "Q2 enhancements to the internal DNMS platform - payroll auto-gen, performance scoring, mobile responsiveness.",
      status: "PLANNING",
      priority: "MEDIUM",
      startDate: new Date("2026-06-01"),
      endDate: new Date("2026-08-31"),
      budget: 200000,
      ownerId: adminId,
      currentPhaseId: initiationPhase?.id ?? null,
    },
  })

  await createTeamWithMembers(
    project3.id,
    "Web Development",
    "Engineering work on the DNMS app",
    rupamId, // Manager
    [],
    [
      {
        title: "Build payroll auto-generation",
        status: "TODO",
        priority: "HIGH",
        assigneeId: rupamId,
        creatorId: adminId,
        dueDate: new Date("2026-07-15"),
      },
      {
        title: "Build performance scoring engine",
        status: "TODO",
        priority: "HIGH",
        assigneeId: rupamId,
        creatorId: adminId,
        dueDate: new Date("2026-07-30"),
      },
    ],
  )

  // ─── Sample Resources (file metadata only - no real files) ───
  await safeCreateMany(prisma.projectResource, [
    {
      projectId: project1.id,
      teamId: null,
      category: "BRIEFS",
      fileName: "acme-website-brief.pdf",
      fileSize: 2_400_000,
      mimeType: "application/pdf",
      objectKey: `projects/${project1.id}/BRIEFS/acme-website-brief.pdf`,
      description: "Client brief from Acme team - scope, deliverables, timelines",
      uploadedById: rupamId,
    },
    {
      projectId: project1.id,
      teamId: null,
      category: "REFERENCES",
      fileName: "competitor-analysis.xlsx",
      fileSize: 850_000,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      objectKey: `projects/${project1.id}/REFERENCES/competitor-analysis.xlsx`,
      description: "Analysis of 5 competitor websites",
      uploadedById: aditiId,
    },
  ])

  console.log("  ✓ Created 3 projects, 7 teams, sample tasks & 2 resources")

  // ===========================================================================
  // STEP 14 - Performance Review Cycle + Goals
  // ===========================================================================
  console.log("Step 14: Creating performance review cycle & goals...")

  const cycle = await prisma.reviewCycle.create({
    data: {
      name: "Annual Review 2025-2026",
      year: 2026,
      quarter: null,
      startDate: new Date("2026-03-01"),
      endDate: new Date("2026-04-30"),
      isActive: true,
    },
  })

  // Create reviews for all employees
  const allEmployees = createdEmployees
  for (const emp of allEmployees) {
    const manager = employeesData.find((e) => e.employeeNo === emp.employeeNo)
    let managerId: string | null = null
    if (manager?.managerEmployeeNo) {
      managerId = employeeNoToId.get(manager.managerEmployeeNo) ?? null
    }

    await prisma.performanceReview.create({
      data: {
        cycleId: cycle.id,
        revieweeId: emp.id,
        reviewerId: managerId,
        status: "PENDING",
      },
    })
  }

  // Add a couple of completed reviews for demo
  const review1 = await prisma.performanceReview.findFirst({
    where: { revieweeId: shaileshId, cycleId: cycle.id },
  })
  if (review1) {
    await prisma.performanceReview.update({
      where: { id: review1.id },
      data: {
        status: "COMPLETED",
        selfRating: 4,
        selfComments:
          "I successfully delivered all assigned projects on time and mentored 2 junior developers.",
        achievements: "Led migration to new CI/CD pipeline, reduced deployment time by 60%.",
        improvements: "Want to improve my presentation skills and stakeholder communication.",
        managerRating: 4.5,
        managerComments: "Exceptional performance. Consistently goes above and beyond.",
        finalRating: 4.2,
        submittedAt: new Date("2026-03-20"),
        completedAt: new Date("2026-04-05"),
      },
    })
  }

  // Goals
  await safeCreateMany(prisma.goal, [
    {
      employeeId: shaileshId,
      title: "Complete advanced content editing certification",
      description: "Finish the professional video editing course by Q3 2026",
      progress: 60,
      status: "IN_PROGRESS",
      year: 2026,
      targetDate: new Date("2026-09-30"),
    },
    {
      employeeId: shaileshId,
      title: "Mentor 2 new team members",
      progress: 100,
      status: "COMPLETED",
      year: 2026,
    },
    {
      employeeId: shaileshId,
      title: "Improve delivery turnaround time by 15%",
      progress: 20,
      status: "IN_PROGRESS",
      year: 2026,
      targetDate: new Date("2026-12-31"),
    },
    {
      employeeId: vivekId,
      title: "Build a strong content portfolio",
      description: "Create and publish 20 content pieces across channels",
      progress: 35,
      status: "IN_PROGRESS",
      year: 2026,
      targetDate: new Date("2026-06-30"),
    },
    {
      employeeId: vivekId,
      title: "Complete digital marketing certification",
      progress: 0,
      status: "NOT_STARTED",
      year: 2026,
      targetDate: new Date("2026-12-31"),
    },
    {
      employeeId: rupamId,
      title: "Streamline employee onboarding process",
      progress: 80,
      status: "IN_PROGRESS",
      year: 2026,
      targetDate: new Date("2026-04-30"),
    },
  ])

  console.log("  ✓ Created 1 review cycle, reviews for all employees, 6 goals")

  // ===========================================================================
  // STEP 15 - Job Postings & Applicants
  // ===========================================================================
  console.log("Step 15: Creating job postings & applicants...")

  const techDeptId = departmentMap.get("Technology")
  const hrDeptId = departmentMap.get("Human Resources")
  const vpeDeptId = departmentMap.get("Video Production & Editing")

  const job1 = await prisma.jobPosting.create({
    data: {
      title: "Senior Video Editor",
      description:
        "We are looking for an experienced video editor to join our growing content team. 3+ years experience with Adobe Premiere Pro, After Effects, and colour grading required.",
      departmentId: vpeDeptId,
      location: "Delhi / Remote",
      type: "FULL_TIME",
      salaryMin: 480000,
      salaryMax: 720000,
      status: "OPEN",
      closingDate: new Date("2026-05-31"),
      postedById: rupamId,
    },
  })

  const job2 = await prisma.jobPosting.create({
    data: {
      title: "HR Executive",
      description:
        "Join our team to support HR operations including recruitment, onboarding, payroll coordination, and employee relations.",
      departmentId: hrDeptId,
      location: "Delhi",
      type: "FULL_TIME",
      salaryMin: 300000,
      salaryMax: 480000,
      status: "OPEN",
      closingDate: new Date("2026-04-30"),
      postedById: rupamId,
    },
  })

  await prisma.jobPosting.create({
    data: {
      title: "Content Creator Intern",
      description:
        "6-month internship for a creative content creator. Will assist with scriptwriting, shoots, and social media content. Currently on hold pending budget.",
      departmentId: techDeptId,
      location: "Delhi",
      type: "INTERNSHIP",
      salaryMin: 10000,
      salaryMax: 15000,
      status: "ON_HOLD",
      postedById: rupamId,
    },
  })

  // Applicants for job1
  const applicant1 = await prisma.applicant.create({
    data: {
      jobPostingId: job1.id,
      firstName: "Arjun",
      lastName: "Mehta",
      email: "arjun.mehta@gmail.com",
      phone: "+91 98765 11001",
      stage: "INTERVIEW",
      source: "LinkedIn",
      notes: "Strong React background, 6 years experience",
    },
  })

  await prisma.interview.create({
    data: {
      applicantId: applicant1.id,
      type: "TECHNICAL",
      scheduledAt: new Date("2026-04-15T10:00:00"),
      interviewerId: shaileshId,
      result: "PASSED",
      feedback: "Strong portfolio. Good editing skills and creative approach.",
    },
  })

  await prisma.applicant.create({
    data: {
      jobPostingId: job1.id,
      firstName: "Sneha",
      lastName: "Patel",
      email: "sneha.patel@gmail.com",
      phone: "+91 98765 11002",
      stage: "SCREENING",
      source: "Naukri",
    },
  })

  await prisma.applicant.create({
    data: {
      jobPostingId: job1.id,
      firstName: "Vikram",
      lastName: "Singh",
      email: "vikram.singh@outlook.com",
      stage: "APPLIED",
      source: "Referral",
      notes: "Referred by internal team member",
    },
  })

  await prisma.applicant.create({
    data: {
      jobPostingId: job1.id,
      firstName: "Pooja",
      lastName: "Desai",
      email: "pooja.desai@gmail.com",
      stage: "OFFER",
      source: "LinkedIn",
      notes: "Offer letter sent on 2026-04-07",
    },
  })

  await prisma.applicant.create({
    data: {
      jobPostingId: job1.id,
      firstName: "Amit",
      lastName: "Kumar",
      email: "amit.kumar@gmail.com",
      stage: "REJECTED",
      source: "Job Portal",
      rejectionReason: "Not enough experience with cloud infrastructure",
    },
  })

  // Applicants for job2
  await prisma.applicant.create({
    data: {
      jobPostingId: job2.id,
      firstName: "Deepa",
      lastName: "Nair",
      email: "deepa.nair@gmail.com",
      phone: "+91 98765 11010",
      stage: "SCREENING",
      source: "LinkedIn",
    },
  })

  await prisma.applicant.create({
    data: {
      jobPostingId: job2.id,
      firstName: "Sanjay",
      lastName: "Rao",
      email: "sanjay.rao@gmail.com",
      stage: "APPLIED",
      source: "Shine.com",
    },
  })

  console.log("  ✓ Created 3 job postings, 7 applicants, 1 interview")

  // ===========================================================================
  // STEP 16 - Seed demo notifications
  // ===========================================================================
  console.log("Step 17: Creating demo notifications...")

  const empId = employeeNoToId.get("EMP-124")! // Vivek
  const hrId = employeeNoToId.get("EMP-113")! // Rupam

  await prisma.notification.createMany({
    data: [
      {
        employeeId: empId,
        title: "Leave Approved",
        message: "Your Casual Leave request from Mon Apr 07 has been approved.",
        type: "success",
        link: "/leave",
        isRead: false,
      },
      {
        employeeId: empId,
        title: "New Task Assigned",
        message:
          'You have been assigned "Script writing for Q2 videos" in project Q2 Content Production.',
        type: "info",
        link: "/projects",
        isRead: false,
      },
      {
        employeeId: empId,
        title: "Performance Review Started",
        message:
          'The "Annual Review 2025-2026" review cycle is now open. Please complete your self-review.',
        type: "info",
        link: "/performance/me",
        isRead: true,
      },
      {
        employeeId: empId,
        title: "Payslip Ready",
        message: "Your payslip for March 2026 is ready. Net pay: ₹21,550.",
        type: "success",
        link: "/payroll/me",
        isRead: true,
      },
      {
        employeeId: hrId,
        title: "Leave Request Pending",
        message: "Vivek has submitted a leave request for 2 days. Please review.",
        type: "info",
        link: "/leave/team",
        isRead: false,
      },
      {
        employeeId: hrId,
        title: "New Applicant",
        message: "An applicant applied for Senior Video Editor.",
        type: "info",
        link: "/recruitment",
        isRead: true,
      },
      {
        employeeId: adminId,
        title: "Payroll Run Complete",
        message: "Payroll for March 2026 has been processed for all active employees.",
        type: "success",
        link: "/payroll",
        isRead: false,
      },
    ],
  })

  console.log("  ✓ Created demo notifications")

  // ===========================================================================
  // Done
  // ===========================================================================
  console.log("─────────────────────────────────────────")
  console.log("✓ Seed completed successfully")
  console.log("─────────────────────────────────────────")
  console.log("Login account (password: Admin@123):")
  console.log("  Super Admin:  admin@hrms.dev")
  console.log("")
  console.log("35 employees seeded (34 real + 1 system admin)")
  console.log("  Active:   24 employees")
  console.log("  Resigned: 11 employees (historical records preserved)")
  console.log("─────────────────────────────────────────")
}

main()
  .catch((e) => {
    console.error("Seed failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
