// =============================================================================
// Project Seed Script - standalone, safe to re-run
// Run with: npx tsx prisma/seed-projects.ts
// =============================================================================

import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  idleTimeoutMillis: 0,
  keepAlive: true,
})
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function safeCreateMany(model: any, rows: Record<string, unknown>[]) {
  for (const row of rows) {
    await model.create({ data: row })
  }
}

async function main() {
  console.log("Seeding project data...")

  // ── Clear existing project data ──────────────────────────────────────────
  await prisma.projectResource.deleteMany()
  await prisma.projectTask.deleteMany()
  await prisma.projectTeamMember.deleteMany()
  await prisma.projectTeam.deleteMany()
  await prisma.projectMember.deleteMany()
  await prisma.project.deleteMany()
  console.log("  ✓ Cleared existing project data")

  // ── Load employee IDs by employeeNo ─────────────────────────────────────
  const employees = await prisma.employee.findMany({
    select: { id: true, employeeNo: true },
  })
  const byNo = new Map(employees.map((e) => [e.employeeNo, e.id]))

  const adminId = byNo.get("EMP-001")!
  const rupamId = byNo.get("EMP-113")!
  const shaileshId = byNo.get("EMP-125")!
  const praneetId = byNo.get("EMP-126")!
  const vivekId = byNo.get("EMP-124")!
  const aditiId = byNo.get("EMP-112")!
  const shivamId = byNo.get("EMP-119")!
  const saurabhId = byNo.get("EMP-129")!
  const mridulId = byNo.get("EMP-132")!
  const jatinId = byNo.get("EMP-135")!
  const hemantId = byNo.get("EMP-136")!
  const ayushiId = byNo.get("EMP-137")!
  const teeshaId = byNo.get("EMP-143")!
  const diwakarId = byNo.get("EMP-145")!
  const komalId = byNo.get("EMP-146")!

  type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE"
  type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  type ApprovalStatus = "APPROVED" | "PENDING_APPROVAL" | "REJECTED"

  interface TaskInput {
    title: string
    description?: string
    status: TaskStatus
    priority: TaskPriority
    assigneeId: string
    creatorId: string
    dueDate?: Date
    completedAt?: Date
    approvalStatus?: ApprovalStatus
    isManagerCreated?: boolean
    rejectionReason?: string
  }

  async function createTeamWithMembers(
    projectId: string,
    teamName: string,
    description: string,
    managerEmployeeId: string,
    memberEmployeeIds: string[],
    tasks: TaskInput[],
  ) {
    const team = await prisma.projectTeam.create({
      data: { projectId, name: teamName, description, managerId: managerEmployeeId },
    })

    const memberIds = [
      managerEmployeeId,
      ...memberEmployeeIds.filter((id) => id !== managerEmployeeId),
    ]
    await safeCreateMany(
      prisma.projectTeamMember,
      memberIds.map((employeeId) => ({ teamId: team.id, projectId, employeeId })),
    )

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

  // ── Project 1: Acme Website Redesign ────────────────────────────────────
  const project1 = await prisma.project.create({
    data: {
      name: "Acme Website Redesign",
      code: "DN00001",
      description:
        "Complete redesign and rebuild of Acme's marketing website with new branding, content, and SEO foundation.",
      status: "ACTIVE",
      priority: "HIGH",
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
    vivekId,
    [shaileshId, saurabhId, mridulId],
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
    aditiId,
    [teeshaId, komalId],
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
    ayushiId,
    [praneetId, diwakarId],
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

  // ── Project 2: Q2 Marketing Campaign ────────────────────────────────────
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
    },
  })

  await createTeamWithMembers(
    project2.id,
    "Paid Ads",
    "Google Ads, Meta Ads, LinkedIn campaigns",
    hemantId,
    [shivamId, jatinId],
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

  await createTeamWithMembers(
    project2.id,
    "Video Production",
    "Promo videos, social shorts, B-roll",
    shaileshId,
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

  // ── Project 3: DNMS Internal Improvements ───────────────────────────────
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
    },
  })

  await createTeamWithMembers(
    project3.id,
    "Web Development",
    "Engineering work on the DNMS app",
    rupamId,
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

  // ── Sample Resources ─────────────────────────────────────────────────────
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
  console.log("Done.")
}

main()
  .catch((e) => {
    console.error("Seed failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
