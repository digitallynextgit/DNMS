// =============================================================================
// Work Allocation seed, driven by work-allocation.xlsx
//
// One sheet per employee. Each sheet holds weekly blocks, newest first:
//
//   Name: / Role Name: / Week : / Reporting To:
//   MONDAY .. FRIDAY (spanned)
//   # | Client | KRA | (Plan, Actual, Hrs) x5 | End Goal | Wk Total | Notes
//   ...one row per client...
//   DAILY TOTAL
//
// Every (client, day) cell that carries a plan, an actual, or hours becomes one
// ProjectTask: due on that weekday, estimated at the allocated hours, and marked
// DONE when the Actual column was filled in.
//
// Re-runnable: it owns every task tagged SEED_TAG and clears them first.
//
//   npx tsx prisma/seed-work-allocation-xlsx.ts            # dry run, writes nothing
//   npx tsx prisma/seed-work-allocation-xlsx.ts --commit   # writes
// =============================================================================

import "dotenv/config"
import * as XLSX from "xlsx"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

const db = new PrismaClient({
  adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })),
})

const COMMIT = process.argv.includes("--commit")
const SEED_TAG = "work-allocation-xlsx"
const WORKBOOK = "work-allocation.xlsx"

// ── Sheet -> employee ────────────────────────────────────────────────────────
// Matched on the DB's first/last name rather than the sheet title, because the
// sheets are informal ("Mridul", "Diwakar jha") and several people share a
// first name in the directory.
const SHEET_TO_EMPLOYEE: Record<string, { first: string; last?: string }> = {
  "Karan Joshi": { first: "Karan", last: "Joshi" },
  Diwakar: { first: "Diwakar", last: "Jha" },
  Mridul: { first: "Mridul" },
  Hemant: { first: "Hemant" },
  Komal: { first: "Komal" },
  Gavisha: { first: "Gavisha" },
  Teesha: { first: "Teesha" },
  Aashutosh: { first: "Aashutosh" },
  Guruprasad: { first: "Guruprasad" },
  Dev: { first: "Dev" },
}

/** Which project code a spreadsheet "Client" belongs to. Everything else -> ADHOC. */
const CLIENT_PATTERNS: { re: RegExp; code: string }[] = [
  { re: /know\s*your\s*genes|^kyg\b/i, code: "DN00007" },
  { re: /talentifi/i, code: "DN00008" },
  { re: /hard\s*2\s*soft|^h2s\b|\(h2s\)/i, code: "DN00006" },
  { re: /realty\s*canvas/i, code: "DN00009" },
  { re: /digitally\s*next/i, code: "DN00010" },
  { re: /happy\s*ganga/i, code: "DN00012" },
  { re: /rudione|rudion\b|leocym/i, code: "DN00005" },
  { re: /\bdnms\b/i, code: "DN00011" },
]

/** Which team a person should land in when they are not yet on one, by their sheet role. */
const ROLE_TO_TEAM: { re: RegExp; team: string }[] = [
  { re: /web|develop|front|back|full/i, team: "WEB" },
  { re: /design|ui|ux|graphic|creative/i, team: "DESIGN" },
  { re: /video|motion|edit/i, team: "VIDEO" },
  { re: /seo|content|market|social|map/i, team: "MAP" },
]

const DAY_COLS = [
  { day: 0, plan: 3, actual: 4, hours: 5 },
  { day: 1, plan: 6, actual: 7, hours: 8 },
  { day: 2, plan: 9, actual: 10, hours: 11 },
  { day: 3, plan: 12, actual: 13, hours: 14 },
  { day: 4, plan: 15, actual: 16, hours: 17 },
]

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
}

/**
 * Monday of the week a label describes. The labels are hand-typed and wildly
 * inconsistent - "03 Aug 2026 - 07 Aug 2026", "20July 2026 - 24july 2026",
 * "3rd Aug - 7th Aug" - so only the FIRST date is parsed and the year defaults
 * to 2026 when omitted.
 */
function parseWeekStart(label: string): Date | null {
  if (!label) return null

  // Two orders occur in the file: "03 Aug 2026 - …" and "July 27th - 31st".
  let day: number | undefined
  let monthKey: string | undefined
  let year: number | undefined

  const dayFirst = label.match(/(\d{1,2})\s*(?:st|nd|rd|th)?\s*([A-Za-z]{3,})\.?\s*(\d{4})?/)
  const monthFirst = label.match(/([A-Za-z]{3,})\.?\s*(\d{1,2})\s*(?:st|nd|rd|th)?\s*(\d{4})?/)
  if (dayFirst) {
    day = Number(dayFirst[1])
    monthKey = dayFirst[2]
    year = dayFirst[3] ? Number(dayFirst[3]) : undefined
  } else if (monthFirst) {
    monthKey = monthFirst[1]
    day = Number(monthFirst[2])
    year = monthFirst[3] ? Number(monthFirst[3]) : undefined
  }
  if (day == null || !monthKey) return null

  const month = MONTHS[monthKey.slice(0, 3).toLowerCase()]
  if (month == null || !Number.isFinite(day)) return null
  const d = new Date(year ?? 2026, month, day)
  if (Number.isNaN(d.getTime())) return null
  return snapToMonday(d)
}

/**
 * Every block is a Mon-Fri week, but some labels start on the wrong day
 * ("12th July - 17th July" is a Sunday). Snapping keeps one week = one bucket
 * instead of two neighbouring tags for the same five days.
 */
function snapToMonday(d: Date): Date {
  const out = new Date(d)
  const dow = out.getDay() // 0 = Sunday
  const delta = dow === 0 ? 1 : 1 - dow
  out.setDate(out.getDate() + delta)
  out.setHours(0, 0, 0, 0)
  return out
}

/** Newest block in every sheet is the current allocation week. */
const NEWEST_WEEK = snapToMonday(new Date(2026, 7, 3))

const cell = (row: unknown[] | undefined, i: number) =>
  row && row[i] != null ? String(row[i]).replace(/\s+/g, " ").trim() : ""

function parseHours(v: string): number | null {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** First sentence/line of a cell, capped - spreadsheet cells run to paragraphs. */
function toTitle(text: string): string {
  const firstLine = text.split(/[\n\r]|(?<=[.;])\s/)[0]!.trim() || text.trim()
  return firstLine.length > 120 ? `${firstLine.slice(0, 117)}...` : firstLine
}

interface Entry {
  sheet: string
  role: string
  weekStart: Date
  client: string
  kra: string
  dayIndex: number
  plan: string
  actual: string
  hours: number | null
}

// ── Parse ───────────────────────────────────────────────────────────────────
function parseWorkbook(): { entries: Entry[]; skippedNoWeek: number } {
  const wb = XLSX.readFile(WORKBOOK)
  const entries: Entry[] = []
  let skippedNoWeek = 0

  for (const [sheetName] of Object.entries(SHEET_TO_EMPLOYEE)) {
    const ws = wb.Sheets[sheetName]
    if (!ws) continue
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: "" })

    let role = ""
    let weekStart: Date | null = null
    // Blocks run newest-first, so a sheet that never states a week (Dev) still
    // anchors at the current allocation week and steps back from there.
    let lastWeekStart: Date | null = null
    let inTable = false
    // Gavisha's sheet leaves "Week :" empty and puts the range in column A of a
    // row just above the table header, so the last few column-A strings are kept.
    let recentColA: string[] = []

    for (const row of rows) {
      const a = cell(row, 0)
      const b = cell(row, 1)
      if (a && !a.endsWith(":")) recentColA = [a, ...recentColA].slice(0, 3)

      if (a === "Name:") {
        // A new block begins. Its week is unknown until the "Week :" row, and if
        // that row is missing or unparseable the blocks run strictly one week
        // older down the sheet - so step back 7 days from the previous block.
        weekStart = null
        inTable = false
        continue
      }
      if (a === "Role Name:") {
        role = b || role
        continue
      }
      // "Week :", "Week:" and "Week Period:" all occur across the sheets.
      if (/^week\b/i.test(a) && a.endsWith(":")) {
        weekStart = parseWeekStart(b)
        continue
      }
      if (a === "#" && b === "Client") {
        // Fall back, in order: a date range printed above the header, one week
        // before the previous block, then the newest week for a sheet that has
        // never given one.
        if (!weekStart) {
          for (const candidate of recentColA) {
            const parsed = parseWeekStart(candidate)
            if (parsed) {
              weekStart = parsed
              break
            }
          }
        }
        if (!weekStart) {
          weekStart = new Date(lastWeekStart ?? NEWEST_WEEK)
          if (lastWeekStart) weekStart.setDate(weekStart.getDate() - 7)
        }
        lastWeekStart = weekStart
        recentColA = []
        inTable = true
        continue
      }
      if (a.startsWith("DAILY TOTAL")) {
        inTable = false
        continue
      }
      if (!inTable || !b) continue

      for (const c of DAY_COLS) {
        const plan = cell(row, c.plan)
        const actual = cell(row, c.actual)
        const hours = parseHours(cell(row, c.hours))
        if (!plan && !actual && hours == null) continue
        if (!weekStart) {
          skippedNoWeek++
          continue
        }
        entries.push({
          sheet: sheetName,
          role,
          weekStart,
          client: b,
          kra: cell(row, 2),
          dayIndex: c.day,
          plan,
          actual,
          hours,
        })
      }
    }
  }
  return { entries, skippedNoWeek }
}

// ── Seed ────────────────────────────────────────────────────────────────────
async function main() {
  const { entries, skippedNoWeek } = parseWorkbook()
  console.log(`Parsed ${entries.length} day-entries (${skippedNoWeek} skipped: no usable week)\n`)

  // Employees
  const employees = await db.employee.findMany({
    where: { isActive: true },
    select: { id: true, firstName: true, lastName: true },
  })
  const sheetEmployee = new Map<string, { id: string; name: string }>()
  for (const [sheet, want] of Object.entries(SHEET_TO_EMPLOYEE)) {
    const hit = employees.find(
      (e) =>
        e.firstName.toLowerCase() === want.first.toLowerCase() &&
        (!want.last || e.lastName.toLowerCase() === want.last.toLowerCase()),
    )
    if (hit) sheetEmployee.set(sheet, { id: hit.id, name: `${hit.firstName} ${hit.lastName}` })
    else console.log(`!! no employee matches sheet "${sheet}" (${want.first} ${want.last ?? ""})`)
  }

  // Projects, plus the ADHOC bucket for work that belongs to no client.
  const projects = await db.project.findMany({
    select: { id: true, code: true, name: true, ownerId: true },
  })
  const byCode = new Map(projects.map((p) => [p.code, p]))

  // Adhoc is no longer a project. Work whose "Client" matches nothing is
  // imported with NO project - that is what "belongs to no client" now means.
  // This used to create an "ADHOC" Project, and that row then behaved like a
  // client account everywhere it was listed. Null here, nothing to create.
  const resolveProject = (client: string) => {
    for (const p of CLIENT_PATTERNS) if (p.re.test(client)) return byCode.get(p.code) ?? null
    return null
  }

  // Teams, and the memberships we may have to create.
  const teams = await db.projectTeam.findMany({
    select: {
      id: true,
      name: true,
      projectId: true,
      managerId: true,
      members: { select: { employeeId: true } },
    },
  })

  const planned: {
    employeeId: string
    employeeName: string
    /** Null = adhoc: work the sheet's "Client" column matched no project for. */
    projectId: string | null
    projectCode: string
    teamId: string | null
    teamName: string
    title: string
    description: string | null
    dueDate: Date
    hours: number | null
    done: boolean
    weekTag: string
  }[] = []

  const newMemberships = new Map<
    string,
    { employeeId: string; projectId: string; teamName: string }
  >()
  const unmatchedClients = new Map<string, number>()
  const skipped: string[] = []

  for (const e of entries) {
    const emp = sheetEmployee.get(e.sheet)
    if (!emp) continue
    // No matching client means adhoc: meetings, interviews, internal QC. That is
    // now the ABSENCE of a project rather than a stand-in ADHOC project, so the
    // row is imported with no project and no team instead of being skipped.
    const project = resolveProject(e.client)
    if (!project) {
      unmatchedClients.set(e.client, (unmatchedClients.get(e.client) ?? 0) + 1)
    }

    // Which team? Their existing one in this project, else the one their role
    // implies, else the project's first team. Adhoc work has no team at all.
    const projectTeams = project ? teams.filter((t) => t.projectId === project.id) : []
    let team = projectTeams.find((t) => t.members.some((m) => m.employeeId === emp.id))
    let teamName = team?.name ?? ""
    if (project && !team) {
      // The team their ROLE implies, created in this project if it is missing.
      // Falling back to whatever team happens to exist put content and design
      // people on WEB boards, which is worse than a new correctly-named team.
      const wanted = ROLE_TO_TEAM.find((r) => r.re.test(e.role))?.team ?? "WEB"
      team = projectTeams.find((t) => t.name.toUpperCase() === wanted)
      teamName = wanted
      const key = `${emp.id}:${project.id}`
      if (!newMemberships.has(key)) {
        newMemberships.set(key, {
          employeeId: emp.id,
          projectId: project.id,
          teamName: wanted,
        })
      }
    }

    const due = new Date(e.weekStart)
    due.setDate(due.getDate() + e.dayIndex)

    const source = e.plan || e.actual
    const bits: string[] = []
    if (e.plan && e.actual) bits.push(`Plan: ${e.plan}`, `Actual: ${e.actual}`)
    else if (e.actual && !e.plan) bits.push(`Actual: ${e.actual}`)
    if (e.kra) bits.push(`KRA: ${e.kra}`)

    planned.push({
      employeeId: emp.id,
      employeeName: emp.name,
      projectId: project?.id ?? null,
      projectCode: project?.code ?? "ADHOC",
      teamId: team?.id ?? null,
      teamName,
      title: toTitle(source) || `${e.client} work`,
      description: bits.length > 0 ? bits.join("\n\n") : null,
      dueDate: due,
      hours: e.hours,
      // The Actual column being filled in is the sheet's way of saying "done".
      done: !!e.actual,
      weekTag: `week-${e.weekStart.toISOString().slice(0, 10)}`,
    })
  }

  // ── Report ────────────────────────────────────────────────────────────────
  console.log(`\nPlanned tasks: ${planned.length}`)
  const perPerson = new Map<string, number>()
  for (const p of planned) perPerson.set(p.employeeName, (perPerson.get(p.employeeName) ?? 0) + 1)
  console.log("\nPer person:")
  for (const [n, c] of [...perPerson].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(c).padStart(4)}  ${n}`)
  }

  const perProject = new Map<string, number>()
  for (const p of planned) perProject.set(p.projectCode, (perProject.get(p.projectCode) ?? 0) + 1)
  console.log("\nPer project:")
  for (const [code, c] of [...perProject].sort((a, b) => b[1] - a[1])) {
    const name = code === "ADHOC" ? "no client" : (byCode.get(code)?.name ?? code)
    console.log(`  ${String(c).padStart(4)}  ${code} ${name}`)
  }

  const weeks = new Set(planned.map((p) => p.weekTag))
  console.log(`\nWeeks covered: ${weeks.size}`)
  console.log([...weeks].sort().join(", "))

  console.log(`\nDone (Actual filled in): ${planned.filter((p) => p.done).length}`)
  console.log(`Without a team: ${planned.filter((p) => !p.teamId).length}`)

  if (unmatchedClients.size > 0) {
    console.log("\nImported as adhoc, no project (client matched nothing):")
    for (const [c, n] of [...unmatchedClients].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(n).padStart(4)}  ${c}`)
    }
  }
  if (newMemberships.size > 0) {
    console.log(`\nTeam memberships to create: ${newMemberships.size}`)
    for (const m of newMemberships.values()) {
      const emp = [...sheetEmployee.values()].find((e) => e.id === m.employeeId)
      const proj = projects.find((p) => p.id === m.projectId)
      console.log(`  ${emp?.name} -> ${proj?.code} / ${m.teamName}`)
    }
  }
  if (skipped.length > 0)
    console.log(`\nSkipped ${skipped.length}:\n  ${skipped.slice(0, 20).join("\n  ")}`)

  if (!COMMIT) {
    console.log("\nDRY RUN - nothing written. Re-run with --commit to apply.")
    return
  }

  // ── Write ─────────────────────────────────────────────────────────────────
  const removed = await db.projectTask.deleteMany({ where: { tags: { has: SEED_TAG } } })
  console.log(`\nCleared ${removed.count} task(s) from a previous run of this seed.`)

  for (const m of newMemberships.values()) {
    let team = teams.find((t) => t.projectId === m.projectId && t.name === m.teamName)
    if (!team) {
      const fresh = await db.projectTeam.create({
        // No manager: making the first seeded member the manager would silently
        // grant them staffing rights on a client project. Assign leads by hand.
        data: { projectId: m.projectId, name: m.teamName, managerId: null },
        select: {
          id: true,
          name: true,
          projectId: true,
          managerId: true,
          members: { select: { employeeId: true } },
        },
      })
      teams.push(fresh)
      team = fresh
      console.log(`  created team ${m.teamName} on project ${m.projectId}`)
    }
    await db.projectTeamMember.upsert({
      where: { projectId_employeeId: { projectId: m.projectId, employeeId: m.employeeId } },
      create: { teamId: team.id, projectId: m.projectId, employeeId: m.employeeId },
      update: {},
    })
  }
  console.log(`Ensured ${newMemberships.size} team membership(s).`)

  let created = 0
  for (const p of planned) {
    // Resolve now, not at planning time: teams created in the step above did not
    // exist when the plan was built, so p.teamId is null for those.
    const teamId =
      p.teamId ??
      teams.find((t) => t.projectId === p.projectId && t.name === p.teamName)?.id ??
      null

    const task = await db.projectTask.create({
      data: {
        projectId: p.projectId,
        teamId,
        title: p.title,
        description: p.description,
        status: p.done ? "DONE" : "TODO",
        priority: "MEDIUM",
        assigneeId: p.employeeId,
        creatorId: p.employeeId,
        dueDate: p.dueDate,
        estimatedHours: p.hours,
        loggedHours: p.done && p.hours ? p.hours : 0,
        completedAt: p.done ? p.dueDate : null,
        tags: [SEED_TAG, p.weekTag],
        approvalStatus: "APPROVED",
        isManagerCreated: true,
      },
      select: { id: true, status: true, createdAt: true },
    })
    // Every task needs its first status period or every duration downstream is wrong.
    await db.taskStatusPeriod.create({
      data: {
        taskId: task.id,
        status: task.status,
        actorId: p.employeeId,
        startedAt: task.createdAt,
      },
    })
    created++
    if (created % 200 === 0) console.log(`  ...${created}/${planned.length}`)
  }
  console.log(`\nCreated ${created} tasks.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
