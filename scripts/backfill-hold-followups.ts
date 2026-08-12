// =============================================================================
// Backfill: raise the follow-up task for work that was already ON HOLD.
//
// Holding a task now books its unfinished hours onto a follow-up dated for the
// day the work is expected to resume (see features/projects/server/
// task-hold.service.ts). Tasks put on hold BEFORE that shipped never got one, so
// their remaining hours sit on a held task nobody's board shows and the resume
// date is a field rather than a plan.
//
// This raises the missing follow-ups, using the same service the live path uses
// so a backfilled task is indistinguishable from one created today.
//
// Re-runnable: a task that already has an open follow-up is skipped, and the
// service itself reuses rather than duplicates.
//
// Run with: npx tsx scripts/backfill-hold-followups.ts [--dry]
// =============================================================================

import "dotenv/config"
import Module from "module"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

// The hold service is marked `server-only`, a guard meant for the React bundler.
// A CLI script is server-side by definition, so stub the guard rather than
// duplicate the logic here - a second copy is how a backfill drifts from the
// behaviour it is supposed to reproduce.
const resolve = (Module as unknown as { _resolveFilename: (r: string, ...a: unknown[]) => string })
  ._resolveFilename
;(Module as unknown as { _resolveFilename: unknown })._resolveFilename = function (
  this: unknown,
  request: string,
  ...args: unknown[]
) {
  if (request === "server-only") return require.resolve("./noop-server-only.cjs")
  return resolve.call(this, request, ...args)
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  idleTimeoutMillis: 0,
  keepAlive: true,
})
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

const DRY = process.argv.includes("--dry")

/** Statuses that mean an existing follow-up is still live. */
const OPEN = ["TODO", "IN_PROGRESS", "IN_REVIEW", "ON_HOLD"] as const

async function main() {
  const { upsertResumeTask, remainingHours } =
    await import("../features/projects/server/task-hold.service")

  const held = await prisma.projectTask.findMany({
    where: {
      status: "ON_HOLD",
      // No resume date means there is nowhere to put the follow-up. Those are
      // reported and skipped rather than guessed at.
      holdExpectedDate: { not: null },
    },
    include: {
      assignee: { select: { firstName: true, lastName: true } },
      project: { select: { name: true } },
      resumeTasks: { select: { id: true, status: true } },
    },
    orderBy: { holdExpectedDate: "asc" },
  })

  const undated = await prisma.projectTask.count({
    where: { status: "ON_HOLD", holdExpectedDate: null },
  })

  console.log(`${DRY ? "[DRY RUN] " : ""}on-hold tasks with a resume date: ${held.length}`)
  if (undated > 0) {
    console.log(`  (${undated} on-hold task(s) have NO resume date - skipped, nothing to date)`)
  }
  console.log("")

  let created = 0
  let skipped = 0

  for (const task of held) {
    const who = task.assignee ? task.assignee.firstName : "unassigned"
    const where = task.project?.name ?? "ADHOC"
    const on = task.holdExpectedDate!.toISOString().slice(0, 10)
    const carried = remainingHours(task.estimatedHours, task.loggedHours)
    const label = `${where} / ${who} "${task.title.slice(0, 34)}"`

    if (task.resumeTasks.some((r) => (OPEN as readonly string[]).includes(r.status))) {
      console.log(`  skip   ${label} - already has an open follow-up`)
      skipped++
      continue
    }

    if (DRY) {
      console.log(
        `  would  ${label} -> ${on}, carrying ${carried == null ? "no hours" : carried + "h"}`,
      )
      created++
      continue
    }

    await prisma.$transaction(async (tx) => {
      // Attributed to whoever raised the held task - a backfill has no actor of
      // its own, and the author is the honest answer.
      const result = await upsertResumeTask(tx, task, task.creatorId)
      if (result) {
        console.log(
          `  create ${label} -> ${result.dueDate.toISOString().slice(0, 10)}, ${
            result.estimatedHours == null ? "no hours" : result.estimatedHours + "h"
          }`,
        )
        created++
      } else {
        console.log(`  skip   ${label} - no resume date`)
        skipped++
      }
    })
  }

  console.log(`\n${DRY ? "would create" : "created"}: ${created}   skipped: ${skipped}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
