/**
 * Retire the stand-in "ADHOC" project.
 *
 *   pnpm tsx prisma/migrate-adhoc-project.ts            # dry run, changes nothing
 *   pnpm tsx prisma/migrate-adhoc-project.ts --commit   # applies
 *
 * ADHOC was never a client. It was a bucket the allocation-sheet import needed
 * somewhere to put meetings, interviews and internal QC, and as a Project row it
 * turned up in the portfolio, the progress reports and every project picker as
 * an account nobody could name. Adhoc is now the ABSENCE of a project
 * (project_tasks.project_id IS NULL), so the bucket can go.
 *
 * Order matters, and the reason is destructive:
 *
 *   ProjectTask.project  onDelete: Cascade
 *   ProjectTask.team     onDelete: Cascade
 *
 * Deleting the project would therefore delete every task under it - and deleting
 * its teams would delete them too, even after the project link was cleared. So
 * both links are cut FIRST, and the project is only removed once nothing points
 * at it. Anything else silently destroys real work and its logged hours.
 *
 * Run AFTER the 20260807000000_adhoc_tasks_without_project migration, which is
 * what makes project_id nullable in the first place.
 */
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
const db = new PrismaClient({ adapter: new PrismaPg(pool) })
const COMMIT = process.argv.includes("--commit")

async function main() {
  // Matched on name/slug rather than a hard-coded code: the seed allocates the
  // next free DNxxxxx, so the code differs per environment.
  const adhoc = await db.project.findFirst({
    where: {
      OR: [{ name: { equals: "ADHOC", mode: "insensitive" } }, { slug: "adhoc" }],
    },
    select: { id: true, name: true, code: true, slug: true },
  })

  if (!adhoc) {
    console.log("No ADHOC project found - nothing to do.")
    return
  }
  console.log(`Found ${adhoc.name} (${adhoc.code}, slug=${adhoc.slug})`)

  // Every team on the project is about to be cascaded away. ProjectTask.team is
  // ALSO Cascade, so any task pointing at one of them dies with it - even a task
  // that lives on a different project entirely. Counting by projectId alone
  // would miss exactly that task and report a safe-looking zero.
  const teamIds = (
    await db.projectTeam.findMany({ where: { projectId: adhoc.id }, select: { id: true } })
  ).map((t) => t.id)

  const [taskCount, viaTeamCount, requirementCount, memberCount] = await Promise.all([
    db.projectTask.count({ where: { projectId: adhoc.id } }),
    teamIds.length > 0
      ? db.projectTask.count({ where: { teamId: { in: teamIds }, projectId: { not: adhoc.id } } })
      : Promise.resolve(0),
    db.projectRequirement.count({ where: { projectId: adhoc.id } }),
    db.projectMember.count({ where: { projectId: adhoc.id } }),
  ])

  console.log(`  tasks        ${taskCount}  -> become adhoc (project + team cleared)`)
  console.log(`  teams        ${teamIds.length}  -> deleted with the project`)
  console.log(`  requirements ${requirementCount}  -> deleted with the project`)
  console.log(`  members      ${memberCount}  -> deleted with the project`)
  if (viaTeamCount > 0) {
    console.log(
      `  WARNING: ${viaTeamCount} task(s) on OTHER projects point at these teams and would` +
        ` be cascade-deleted. Their teamId is cleared first so they survive.`,
    )
  }

  // A requirement blocking a task would be deleted with the project while the
  // task survives. The FK is SetNull, so the task simply stops being blocked -
  // but say so rather than let it surprise someone.
  const blocked = await db.projectTask.count({
    where: { projectId: adhoc.id, requirementId: { not: null } },
  })
  if (blocked > 0) {
    console.log(`  note: ${blocked} adhoc task(s) will lose their blocking requirement`)
  }

  if (!COMMIT) {
    console.log("\nDry run. Re-run with --commit to apply.")
    return
  }

  await db.$transaction(async (tx) => {
    // 1. Cut BOTH links before anything is deleted. Clearing only projectId
    //    would leave teamId pointing at a team that is about to be cascaded
    //    away, taking the task with it.
    const detached = await tx.projectTask.updateMany({
      where: { projectId: adhoc.id },
      data: { projectId: null, teamId: null },
    })
    console.log(`Detached ${detached.count} task(s).`)

    // Same cut for any task that merely POINTS at one of these teams. It keeps
    // its own project; it just stops referencing a team that is about to vanish.
    if (teamIds.length > 0) {
      const unlinked = await tx.projectTask.updateMany({
        where: { teamId: { in: teamIds } },
        data: { teamId: null },
      })
      if (unlinked.count > 0) console.log(`Unlinked ${unlinked.count} task(s) from adhoc teams.`)
    }

    // 2. Refuse to continue if anything still points at the project. Cheap
    //    insurance against a task created between the count and the update.
    const left = await tx.projectTask.count({ where: { projectId: adhoc.id } })
    if (left > 0) {
      throw new Error(`${left} task(s) still on the project - aborting rather than cascading them`)
    }

    await tx.project.delete({ where: { id: adhoc.id } })
    console.log(`Deleted project ${adhoc.code}.`)
  })

  console.log("Done.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await db.$disconnect()
    await pool.end()
  })
