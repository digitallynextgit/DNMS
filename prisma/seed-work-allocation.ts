// =============================================================================
// Work Allocation Seed - week of 3-7 August 2026 (Design)
//
// Source: workallocation.xlsx, sheets "Hemant" and "Komal", the "03 August -
// 07 August" block. The web trio (Diwakar, Mridul, Karan) was seeded earlier
// and is NOT touched here. Gavisha, Aashutosh, Teesha, Guruprasad and Dev have
// no 3-7 Aug block in the workbook, so they are deliberately not seeded.
//
// Re-runnable: it deletes only the tasks it owns (assignee in {Hemant, Komal},
// tagged week-2026-08-03) before re-inserting.
//
// Run with: npx tsx prisma/seed-work-allocation.ts
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

const WEEK_TAG = "week-2026-08-03"
const MON = "2026-08-03"
const FRI = "2026-08-07"

/** Sheet client name -> the project it belongs to. */
const PROJECTS = {
  RUDIONE: { code: "DN00005", name: "RUDIONE / LEOCYM" },
  H2S: { code: "DN00006", name: "H2S" },
  KYG: { code: "DN00007", name: "KYG" },
  TFX: { code: "DN00008", name: "TALENTIFI-X" },
  RC: { code: "DN00009", name: "REALTY CANVAS" },
  DN: { code: "DN00010", name: "DIGITALLY NEXT" },
  DNMS: { code: "DN00011", name: "DNMS" },
  HG: { code: "DN00012", name: "HAPPY GANGA" },
} as const

type ProjectKey = keyof typeof PROJECTS
type Person = "HEMANT" | "KOMAL"

interface Row {
  project: ProjectKey
  who: Person
  title: string
  description?: string
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  /** Defaults to the whole week when the sheet repeats the same plan Mon-Fri. */
  start?: string
  due?: string
}

// ── Hemant Nandal | Design Lead ─────────────────────────────────────────────
// Sheet rows 1-10. Blank Time Allocated throughout, so no estimated hours.
const HEMANT_ROWS: Row[] = [
  {
    project: "DN",
    who: "HEMANT",
    title: "Blog images and website UI",
    description: "End goal: social assets, blog images, web pages UI/UX.",
    priority: "MEDIUM",
  },
  {
    project: "RC",
    who: "HEMANT",
    title: "Blog images and website images/banners",
    description: "End goal: website images/banners, blog images.",
    priority: "MEDIUM",
  },
  {
    project: "TFX",
    who: "HEMANT",
    title: "Blog images and web pages UI",
    description: "End goal: blog images, web pages UI/UX.",
    priority: "MEDIUM",
  },

  // KYG is the stated focus of the week.
  {
    project: "KYG",
    who: "HEMANT",
    title: "KYG landing pages revamp",
    description:
      "KYG is the focus this week: landing-page revamp with a mascot added to the UI, plus training the model for the mascot. End goal: landing pages revamped with mascot; mascot model trained.",
    priority: "HIGH",
  },
  {
    project: "KYG",
    who: "HEMANT",
    title: "Mascot integration into UI",
    priority: "HIGH",
  },
  {
    project: "KYG",
    who: "HEMANT",
    title: "Mascot model training",
    description: "Planned Mon, Tue, Thu and Fri. Wednesday is given to conversational strips.",
    priority: "HIGH",
  },
  {
    project: "KYG",
    who: "HEMANT",
    title: "Conversational strips",
    priority: "MEDIUM",
    start: "2026-08-05",
    due: "2026-08-05",
  },
  { project: "KYG", who: "HEMANT", title: "Blog images", priority: "MEDIUM" },

  // Rudione / Leocym.
  {
    project: "RUDIONE",
    who: "HEMANT",
    title: "Rudione packaging finalisation",
    description:
      "Packaging finalised this week; the rest of the SKU moves to next week (10-14 Aug).",
    priority: "HIGH",
    start: MON,
    due: "2026-08-04",
  },
  {
    project: "RUDIONE",
    who: "HEMANT",
    title: "Rudione homepage UI/UX (on content approval)",
    description:
      "BLOCKED until the homepage content clears approval. Tue targets completion; revisited Fri if approval slips.",
    priority: "HIGH",
  },
  {
    project: "RUDIONE",
    who: "HEMANT",
    title: "Rudione product/category page",
    priority: "HIGH",
    start: "2026-08-05",
    due: "2026-08-05",
  },
  {
    project: "RUDIONE",
    who: "HEMANT",
    title: "Rudione product page UI/UX",
    priority: "HIGH",
    start: "2026-08-06",
    due: "2026-08-06",
  },
  {
    project: "RUDIONE",
    who: "HEMANT",
    title: "Leocym packaging finalisation (inherits Rudione)",
    description:
      "Inherits the Rudione system. Rest of the SKU moves to next week (10-14 Aug). End goal: packaging finalised alongside Rudione.",
    priority: "HIGH",
    start: MON,
    due: "2026-08-04",
  },

  // Happy Ganga.
  {
    project: "HG",
    who: "HEMANT",
    title: "Happy Ganga homepage UI/UX (completion)",
    description: "Single product page carried over from 1 Aug, completes early week.",
    priority: "HIGH",
    start: "2026-08-04",
    due: "2026-08-04",
  },
  {
    project: "HG",
    who: "HEMANT",
    title: "Happy Ganga product/category page",
    description: "End goal: single product page completed.",
    priority: "HIGH",
    start: "2026-08-06",
    due: "2026-08-06",
  },

  // Hard2Soft.
  {
    project: "H2S",
    who: "HEMANT",
    title: "Blog images and QC, website images and banners",
    priority: "MEDIUM",
  },
  { project: "H2S", who: "HEMANT", title: "15 ad creative sets", priority: "MEDIUM" },

  // Internal.
  {
    project: "DNMS",
    who: "HEMANT",
    title: "Design team reviews and feedback",
    description: "Weekly goals meet, feedback, ad-hoc requests.",
    priority: "LOW",
  },
  {
    project: "DNMS",
    who: "HEMANT",
    title: "Deliverables QC: review team deliverables and give feedback",
    description: "End goal: daily QC across the team.",
    priority: "MEDIUM",
  },
]

// ── Komal Gautam | Creative Designer ────────────────────────────────────────
// Sheet rows 1-7. Same plan Mon-Fri on every client row, so one task per client.
const KOMAL_ROWS: Row[] = [
  {
    project: "DN",
    who: "KOMAL",
    title: "Social media calendar assets",
    priority: "MEDIUM",
  },
  {
    project: "RC",
    who: "KOMAL",
    title: "Social media calendar assets",
    priority: "MEDIUM",
  },
  {
    project: "TFX",
    who: "KOMAL",
    title: "Social media calendar assets",
    description: "End goal: 5-7 per week.",
    priority: "MEDIUM",
  },
  {
    project: "KYG",
    who: "KOMAL",
    title: "KYG social creatives (calendar assets)",
    description: "Socials for KYG across the week. End goal: 5-6 per week.",
    priority: "MEDIUM",
  },
  {
    project: "H2S",
    who: "KOMAL",
    title: "H2S social and paid ad creatives",
    description: "Socials / paid ads for H2S across the week. End goal: 7 per week.",
    priority: "MEDIUM",
  },
  {
    project: "RUDIONE",
    who: "KOMAL",
    title: "Brand brochure design",
    description:
      "Front-loaded to Mon-Tue given the larger brochure TAT. CONFIRM which brand's brochure this is (Rudione / Happy Ganga / Leocym) - the sheet does not say. End goal: brand brochure delivered.",
    priority: "HIGH",
    start: MON,
    due: "2026-08-05",
  },
  {
    project: "DNMS",
    who: "KOMAL",
    title: "Research and new ideation",
    priority: "LOW",
  },
]

const ROWS = [...HEMANT_ROWS, ...KOMAL_ROWS]

/** Which projects each person needs a DESIGN team on, derived from ROWS. */
function projectsFor(who: Person): ProjectKey[] {
  return [...new Set(ROWS.filter((r) => r.who === who).map((r) => r.project))]
}

async function main() {
  console.log("Seeding work allocation for 3-7 August 2026 (Design)...")

  // ── People ───────────────────────────────────────────────────────────────
  const employees = await prisma.employee.findMany({ select: { id: true, employeeNo: true } })
  const byNo = new Map(employees.map((e) => [e.employeeNo, e.id]))

  const hemantId = byNo.get("136")
  const komalId = byNo.get("146")
  if (!hemantId) throw new Error("Employee 136 (Hemant Nandal) not found")
  if (!komalId) throw new Error("Employee 146 (Komal Gautam) not found")

  const PERSON: Record<Person, string> = { HEMANT: hemantId, KOMAL: komalId }
  // Hemant is the Design Lead and the owner of both sheets, so he is the creator.
  const creatorId = hemantId

  // ── Projects: reuse if present, create if missing ────────────────────────
  const projectId = {} as Record<ProjectKey, string>
  const defaultOwnerId = byNo.get("143") ?? hemantId // Teesha Jain owns the client projects

  for (const [key, meta] of Object.entries(PROJECTS) as [
    ProjectKey,
    { code: string; name: string },
  ][]) {
    const existing = await prisma.project.findUnique({ where: { code: meta.code } })
    if (existing) {
      projectId[key] = existing.id
      continue
    }
    const created = await prisma.project.create({
      data: {
        name: meta.name,
        code: meta.code,
        status: "ACTIVE",
        priority: "MEDIUM",
        ownerId: defaultOwnerId,
        startDate: new Date(MON),
      },
    })
    projectId[key] = created.id
    console.log(`  + created project ${meta.code} ${meta.name}`)
  }

  // ── Teams: one DESIGN team per project the design pair works on ─────────
  // ProjectTeamMember is unique on (projectId, employeeId), so if someone is
  // already on another team of that project we leave them there and target it.
  const teamIdFor = {} as Record<ProjectKey, Record<Person, string>>

  for (const who of ["HEMANT", "KOMAL"] as Person[]) {
    for (const key of projectsFor(who)) {
      const pid = projectId[key]
      const employeeId = PERSON[who]

      const existingMembership = await prisma.projectTeamMember.findUnique({
        where: { projectId_employeeId: { projectId: pid, employeeId } },
        select: { teamId: true },
      })

      let teamId: string
      if (existingMembership) {
        teamId = existingMembership.teamId
      } else {
        const team =
          (await prisma.projectTeam.findUnique({
            where: { projectId_name: { projectId: pid, name: "DESIGN" } },
          })) ??
          (await prisma.projectTeam.create({
            data: {
              projectId: pid,
              name: "DESIGN",
              description: "UI/UX, banners, social creatives, blog images",
              managerId: hemantId,
            },
          }))
        await prisma.projectTeamMember.create({
          data: { teamId: team.id, projectId: pid, employeeId },
        })
        teamId = team.id
        console.log(`  + ${PROJECTS[key].code} DESIGN <- ${who}`)
      }

      teamIdFor[key] = { ...(teamIdFor[key] ?? {}), [who]: teamId } as Record<Person, string>
    }
  }

  // ── Tasks ────────────────────────────────────────────────────────────────
  const removed = await prisma.projectTask.deleteMany({
    where: { assigneeId: { in: [hemantId, komalId] }, tags: { has: WEEK_TAG } },
  })
  if (removed.count > 0) console.log(`  - cleared ${removed.count} prior ${WEEK_TAG} design tasks`)

  for (const row of ROWS) {
    await prisma.projectTask.create({
      data: {
        projectId: projectId[row.project],
        teamId: teamIdFor[row.project][row.who],
        title: row.title,
        description: row.description,
        status: "TODO",
        priority: row.priority,
        assigneeId: PERSON[row.who],
        creatorId,
        startDate: new Date(row.start ?? MON),
        dueDate: new Date(row.due ?? FRI),
        tags: [WEEK_TAG],
        approvalStatus: "APPROVED",
        isManagerCreated: true,
      },
    })
  }

  console.log(
    `  ✓ ${HEMANT_ROWS.length} tasks for Hemant Nandal, ${KOMAL_ROWS.length} for Komal Gautam`,
  )
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
