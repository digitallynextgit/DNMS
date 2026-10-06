/**
 * One-off: replace Digitally Next's flat department list with the organogram
 * ("DIGITALLY NEXT - Organisational Structure", internal reference).
 *
 *   pnpm db:departments              # dry run - prints the plan
 *   pnpm db:departments --write      # actually do it
 *
 * DRY RUN BY DEFAULT. Nothing is written without `--write`.
 *
 * In ONE transaction, so a failure anywhere leaves the old list untouched:
 *   1. every old department is renamed out of the way - names are unique per
 *      company, and Content / SMO / SEO / Video exist on both sides;
 *   2. the organogram tree is created (department › sub › sub-sub);
 *   3. the people, job roles, job postings and clearance items on each old
 *      department move to its counterpart in RELINK - so no job role is lost
 *      to the cascade that deleting its department would trigger;
 *   4. every old department is deleted. Anyone on a department with no
 *      counterpart is left with no department, for HR to reassign.
 *
 * Refuses to run once the tree exists (SMG is there), so a re-run is a no-op.
 *
 * Use the pnpm script, not a bare `npx tsx`: @/server/db pulls in
 * `server-only`, which throws without the react-server export condition.
 */
import "dotenv/config"
import { randomUUID } from "node:crypto"
import { db } from "@/server/db"
import { runWithTenant } from "@/server/tenant-context"
import { FOUNDING_TENANT_ID, FOUNDING_TENANT_SLUG } from "@/lib/tenant-url"

const WRITE = process.argv.includes("--write")

type OrgNode = { name: string; children?: OrgNode[] }

/** The organogram, top level first. The company itself is the tenant, not a department. */
const ORG: OrgNode[] = [
  {
    name: "SMG",
    children: [
      { name: "BSG" },
      {
        name: "MSG",
        children: [
          { name: "Content" },
          { name: "SMO" },
          { name: "PR" },
          { name: "Collabs" },
          { name: "Performance Marketing" },
          { name: "SEO" },
          { name: "Alliances & Partnerships" },
          { name: "Community Building" },
        ],
      },
    ],
  },
  {
    name: "ADAC",
    children: [
      { name: "PMG", children: [{ name: "Project Controller" }] },
      { name: "AIDD" },
      { name: "AI & Data & Digital" },
      { name: "AIDD (Curriculum)" },
      { name: "AIDD (Workflow Automation)" },
    ],
  },
  { name: "AMG", children: [{ name: "Key Account Manager" }] },
  {
    name: "MAP",
    children: [
      { name: "WEM" },
      { name: "VIM", children: [{ name: "Video" }, { name: "Graphics" }] },
    ],
  },
  { name: "HR & Admin" },
  {
    name: "Finance & Billing",
    children: [{ name: "Filing and Banking" }, { name: "Legal and Documentation" }],
  },
]

/** Old department → the organogram department everything on it moves to. */
const RELINK: Record<string, string> = {
  Content: "Content",
  SMO: "SMO",
  SEO: "SEO",
  Video: "Video",
  "Digital PR": "PR",
  Design: "Graphics",
  HR: "HR & Admin",
  "Web Development": "WEM",
  // No counterpart: New Business Generation, Paid Ads.
}

/** `code` is still required and unique in the schema but no longer shown or read. */
function hiddenCode(): string {
  return randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()
}

function countNodes(nodes: OrgNode[]): number {
  return nodes.reduce((n, node) => n + 1 + countNodes(node.children ?? []), 0)
}

function printTree(nodes: OrgNode[], indent = "  ") {
  for (const node of nodes) {
    console.log(`${indent}${node.name}`)
    printTree(node.children ?? [], indent + "    ")
  }
}

async function main() {
  await runWithTenant({ tenantId: FOUNDING_TENANT_ID, slug: FOUNDING_TENANT_SLUG }, async () => {
    const old = await db.department.findMany({
      select: {
        id: true,
        name: true,
        headId: true,
        careersTone: true,
        careersJobsLabel: true,
        _count: {
          select: { employees: true, jobRoles: true, jobPostings: true, clearanceItems: true },
        },
      },
      orderBy: { name: "asc" },
    })

    if (old.some((d) => d.name === "SMG")) {
      console.log("The organogram is already seeded (SMG exists) - nothing to do.")
      return
    }

    console.log(`${WRITE ? "Replacing" : "DRY RUN - would replace"} ${old.length} department(s):\n`)
    for (const d of old) {
      const c = d._count
      const what = `${c.employees} employee(s), ${c.jobRoles} job role(s), ${c.jobPostings} posting(s), ${c.clearanceItems} clearance item(s)`
      const to = RELINK[d.name]
      console.log(
        `  ${d.name.padEnd(26)} ${what}  →  ${to ?? "deleted, nothing moves (left unassigned)"}`,
      )
      if (!to && c.jobRoles > 0)
        console.log(`    ! its ${c.jobRoles} job role(s) would be DELETED with it (cascade)`)
    }
    console.log(`\nwith the organogram (${countNodes(ORG)} departments):`)
    printTree(ORG)

    if (!WRITE) {
      console.log("\nDRY RUN - nothing written. Re-run with --write to apply.")
      return
    }

    await db.$transaction(
      async (tx) => {
        // 1. Free every name the new tree might want.
        for (const d of old) {
          await tx.department.update({ where: { id: d.id }, data: { name: `__old__${d.id}` } })
        }

        // 2. The tree, parents before children.
        const idByName = new Map<string, string>()
        const create = async (nodes: OrgNode[], parentId: string | null) => {
          for (const node of nodes) {
            const made = await tx.department.create({
              data: { name: node.name, code: hiddenCode(), parentId },
              select: { id: true },
            })
            idByName.set(node.name, made.id)
            await create(node.children ?? [], made.id)
          }
        }
        await create(ORG, null)

        // 3. Move everything that points at an old department to its counterpart.
        for (const d of old) {
          const target = RELINK[d.name]
          if (!target) continue
          const to = idByName.get(target)
          if (!to) throw new Error(`RELINK target "${target}" is not in the organogram`)
          await tx.employee.updateMany({
            where: { departmentId: d.id },
            data: { departmentId: to },
          })
          await tx.jobRole.updateMany({ where: { departmentId: d.id }, data: { departmentId: to } })
          await tx.jobPosting.updateMany({
            where: { departmentId: d.id },
            data: { departmentId: to },
          })
          await tx.checklistTemplateItem.updateMany({
            where: { clearanceDepartmentId: d.id },
            data: { clearanceDepartmentId: to },
          })
          // Its head and careers-page settings carry over too.
          if (d.headId || d.careersTone || d.careersJobsLabel) {
            await tx.department.update({
              where: { id: to },
              data: {
                headId: d.headId,
                careersTone: d.careersTone,
                careersJobsLabel: d.careersJobsLabel,
              },
            })
          }
        }

        // 4. The old list goes.
        await tx.department.deleteMany({ where: { id: { in: old.map((d) => d.id) } } })
      },
      // A remote database and ~70 statements: well past the 5s default.
      { maxWait: 10_000, timeout: 120_000 },
    )

    const after = await db.department.findMany({
      select: {
        name: true,
        parentId: true,
        _count: { select: { employees: true, jobRoles: true } },
      },
    })
    const unassigned = await db.employee.count({ where: { departmentId: null } })
    console.log(`\nDone: ${after.length} departments.`)
    for (const d of after.filter((x) => x._count.employees > 0 || x._count.jobRoles > 0)) {
      console.log(
        `  ${d.name}: ${d._count.employees} employee(s), ${d._count.jobRoles} job role(s)`,
      )
    }
    console.log(`Employees with no department: ${unassigned}`)
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
