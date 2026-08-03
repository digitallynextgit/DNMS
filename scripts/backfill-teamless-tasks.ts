// =============================================================================
// Backfill: attach team-less project tasks to a team.
//
// TALENTIFI-X, REALTY CANVAS and DIGITALLY NEXT were seeded with tasks but no
// teams, so those rows carry team_id = NULL. The Teams tab groups work by team,
// so that work was invisible there. This creates the team each orphan task
// belongs to (inferred from its assignee's department) and moves the task onto
// it.
//
// Re-runnable: it only touches tasks that still have team_id = NULL.
//
// Run with: npx tsx scripts/backfill-teamless-tasks.ts [--dry]
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

const DRY = process.argv.includes("--dry")

/** Department name -> the team an orphan task should land on. */
const TEAM_FOR_DEPARTMENT: Record<string, { name: string; description: string }> = {
  "Web Development": { name: "WEB", description: "Website build, maintenance, SEO and audits" },
  Design: { name: "DESIGN", description: "UI/UX, banners, social creatives, blog images" },
  Content: { name: "CONTENT", description: "Website copy, blogs, scripts, content audits" },
  SMO: { name: "SMO", description: "Social media and community" },
  Video: { name: "VIDEO", description: "Reels, shorts and long-form video" },
}
const FALLBACK = { name: "WEB", description: "Website build, maintenance, SEO and audits" }

async function main() {
  console.log(`Backfilling team-less tasks${DRY ? " (dry run)" : ""}...`)

  const orphans = await prisma.projectTask.findMany({
    where: { teamId: null },
    select: {
      id: true,
      title: true,
      assigneeId: true,
      project: { select: { id: true, code: true, name: true } },
      assignee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          department: { select: { name: true } },
        },
      },
    },
    orderBy: [{ project: { code: "asc" } }, { createdAt: "asc" }],
  })

  if (orphans.length === 0) {
    console.log("  Nothing to do - every task already has a team.")
    return
  }
  console.log(`  Found ${orphans.length} task(s) without a team.`)

  // Unassigned tasks have no department to infer from, so they are left alone
  // rather than guessed into the wrong team.
  const unassigned = orphans.filter((t) => !t.assignee)
  const actionable = orphans.filter((t) => t.assignee)

  let movedCount = 0
  const teamCache = new Map<string, string>() // `${projectId}:${teamName}` -> teamId

  for (const task of actionable) {
    const assignee = task.assignee!
    const spec = TEAM_FOR_DEPARTMENT[assignee.department?.name ?? ""] ?? FALLBACK
    const projectId = task.project.id

    // If the assignee is already on a team in this project, that is their team -
    // ProjectTeamMember is unique on (projectId, employeeId), so it is the only
    // one they can be on.
    const membership = await prisma.projectTeamMember.findUnique({
      where: { projectId_employeeId: { projectId, employeeId: assignee.id } },
      select: { teamId: true, team: { select: { name: true } } },
    })

    let teamId: string
    let teamName: string

    if (membership) {
      teamId = membership.teamId
      teamName = membership.team.name
    } else {
      const cacheKey = `${projectId}:${spec.name}`
      const cached = teamCache.get(cacheKey)
      if (cached) {
        teamId = cached
      } else {
        const existing = await prisma.projectTeam.findUnique({
          where: { projectId_name: { projectId, name: spec.name } },
          select: { id: true },
        })
        if (existing) {
          teamId = existing.id
        } else if (DRY) {
          teamId = "(would create)"
          console.log(`  + would create team ${task.project.code} ${spec.name}`)
        } else {
          const created = await prisma.projectTeam.create({
            data: {
              projectId,
              name: spec.name,
              description: spec.description,
              managerId: null,
            },
            select: { id: true },
          })
          teamId = created.id
          console.log(`  + created team ${task.project.code} ${spec.name}`)
        }
        teamCache.set(cacheKey, teamId)
      }
      teamName = spec.name

      // Put the assignee on the team - they are doing the work, so they belong
      // on it. First person on an empty team becomes its manager, matching the
      // add-member route's rule.
      if (!DRY) {
        const memberCount = await prisma.projectTeamMember.count({ where: { teamId } })
        await prisma.projectTeamMember.create({
          data: { teamId, projectId, employeeId: assignee.id },
        })
        if (memberCount === 0) {
          await prisma.projectTeam.update({
            where: { id: teamId },
            data: { managerId: assignee.id },
          })
          console.log(`    ${assignee.firstName} ${assignee.lastName} -> manager of ${spec.name}`)
        }
      }
    }

    console.log(
      `  ${task.project.code} ${teamName.padEnd(7)} ${assignee.firstName} ${assignee.lastName} | ${task.title}`,
    )
    if (!DRY) {
      await prisma.projectTask.update({ where: { id: task.id }, data: { teamId } })
    }
    movedCount++
  }

  if (unassigned.length > 0) {
    console.log(`\n  Left alone (no assignee, so no team can be inferred): ${unassigned.length}`)
    for (const t of unassigned) console.log(`    ${t.project.code} | ${t.title}`)
  }

  console.log(`\n  ${DRY ? "Would move" : "Moved"} ${movedCount} task(s) onto a team.`)
  console.log("Done.")
}

main()
  .catch((e) => {
    console.error("Backfill failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
