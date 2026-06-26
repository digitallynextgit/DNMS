// =============================================================================
// Careers seed - loads prisma/careers.seed.json into the Career* tables.
// Idempotent: re-running upserts by slug (within each parent) and replaces a
// role's openings. Everything is seeded as PUBLISHED (it's the live data).
// Run with:  npx tsx prisma/seed-careers.ts
// =============================================================================

import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { readFileSync } from "fs"
import { join } from "path"

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, idleTimeoutMillis: 0 })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

interface SeedOpening {
  label: string
  order: number
}
interface SeedRole {
  title: string
  slug: string
  meta: string | null
  summary: string | null
  order: number
  intro: string | null
  jobEssence: string | null
  keyRequirements: string[]
  openings: SeedOpening[]
}
interface SeedSubDepartment {
  title: string
  slug: string
  jobsLabel: string
  tone: string
  order: number
  roles: SeedRole[]
}
interface SeedGroup {
  mode: "FULL_TIME" | "INTERNSHIP"
  code: string
  title: string
  slug: string
  jobsLabel: string
  tone: string
  order: number
  subDepartments: SeedSubDepartment[]
}

async function main() {
  const raw = readFileSync(join(process.cwd(), "prisma", "careers.seed.json"), "utf8")
  const { groups } = JSON.parse(raw) as { groups: SeedGroup[] }

  let g = 0
  let s = 0
  let r = 0
  let o = 0

  for (const group of groups) {
    const dbGroup = await prisma.careerGroup.upsert({
      where: { mode_slug: { mode: group.mode, slug: group.slug } },
      update: {
        code: group.code,
        title: group.title,
        jobsLabel: group.jobsLabel,
        tone: group.tone,
        order: group.order,
        status: "PUBLISHED",
      },
      create: {
        mode: group.mode,
        code: group.code,
        title: group.title,
        slug: group.slug,
        jobsLabel: group.jobsLabel,
        tone: group.tone,
        order: group.order,
        status: "PUBLISHED",
      },
    })
    g++

    for (const sub of group.subDepartments) {
      const dbSub = await prisma.careerSubDepartment.upsert({
        where: { groupId_slug: { groupId: dbGroup.id, slug: sub.slug } },
        update: {
          title: sub.title,
          jobsLabel: sub.jobsLabel,
          tone: sub.tone,
          order: sub.order,
          status: "PUBLISHED",
        },
        create: {
          groupId: dbGroup.id,
          title: sub.title,
          slug: sub.slug,
          jobsLabel: sub.jobsLabel,
          tone: sub.tone,
          order: sub.order,
          status: "PUBLISHED",
        },
      })
      s++

      for (const role of sub.roles) {
        const dbRole = await prisma.careerRole.upsert({
          where: { subDepartmentId_slug: { subDepartmentId: dbSub.id, slug: role.slug } },
          update: {
            title: role.title,
            meta: role.meta,
            summary: role.summary,
            intro: role.intro,
            jobEssence: role.jobEssence,
            keyRequirements: role.keyRequirements ?? [],
            order: role.order,
            status: "PUBLISHED",
          },
          create: {
            subDepartmentId: dbSub.id,
            title: role.title,
            slug: role.slug,
            meta: role.meta,
            summary: role.summary,
            intro: role.intro,
            jobEssence: role.jobEssence,
            keyRequirements: role.keyRequirements ?? [],
            order: role.order,
            status: "PUBLISHED",
          },
        })
        r++

        // Openings have no natural unique key, so replace them wholesale.
        await prisma.careerOpening.deleteMany({ where: { roleId: dbRole.id } })
        for (const op of role.openings ?? []) {
          await prisma.careerOpening.create({
            data: { roleId: dbRole.id, label: op.label, order: op.order, status: "PUBLISHED" },
          })
          o++
        }
      }
    }
  }

  console.log(`Seeded careers: ${g} groups, ${s} sub-departments, ${r} roles, ${o} openings`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
