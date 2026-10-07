// =============================================================================
// HR processes: onboarding checklists, 15-day joinee scorecards, resignations
// and exit clearance, document requests, and the stock register.
//
// Checklists are built by the app's own instantiateChecklist() - it is
// script-safe (no session, no notifications) and snapshots the tenant's
// template exactly as a real joiner/leaver gets it. The joinee scorecard is
// mirrored from startScorecardFor(), whose module imports the session guards
// and so cannot be loaded from a script.
//
// ── POOJA'S RESIGNATION IS APPROVED, NOT PENDING ─────────────────────────────
// The Exit Clearance page lists only APPROVED resignations of people still
// serving notice, and the exit checklist (the clearances Meera and Karthik sign
// from "Waiting on you") is created at approval. So Pooja is mid-notice: her
// resignation was accepted, her last day is a few weeks out, clearances are
// open. A separate PENDING resignation (Arjun) keeps the Resignations queue -
// HR's and Rohan's - from being empty. Flip POOJA_STATUS to PENDING to change
// that story (her exit checklist is then not created).
// =============================================================================

import { db } from "@/server/db"
import { instantiateChecklist } from "@/features/hr-checklists/server/instantiate"
import { SCORECARD_DAYS } from "@/features/joinee-scorecard/lib/scorecard"
import {
  addDays,
  at,
  dayKey,
  idOf,
  isWeekend,
  make,
  makeMany,
  shiftWorkingDays,
  type DemoContext,
} from "./context"

const POOJA_STATUS: "APPROVED" | "PENDING" = "APPROVED"

/** First `n` working days from `start` inclusive (fixed holidays skipped). */
function firstWorkingDays(ctx: DemoContext, start: Date, n: number): Date[] {
  const out: Date[] = []
  for (let d = start; out.length < n; d = addDays(d, 1)) {
    if (isWeekend(d) || ctx.holidayKeys.has(dayKey(d))) continue
    out.push(d)
  }
  return out
}

async function markItems(
  ctx: DemoContext,
  instanceId: string,
  pick: (item: {
    text: string
    sectionTitle: string
    assigneeRole: string
    dueDate: Date | null
    displayOrder: number
  }) => boolean,
  doneBy: (item: {
    assigneeRole: string
    assigneeId: string | null
    displayOrder: number
  }) => string,
  doneAt: (item: { dueDate: Date | null }) => Date,
  note?: (item: { text: string }) => string | null,
): Promise<number> {
  const items = await db.checklistInstanceItem.findMany({
    where: { instanceId },
    select: {
      id: true,
      text: true,
      sectionTitle: true,
      assigneeRole: true,
      assigneeId: true,
      dueDate: true,
      displayOrder: true,
    },
  })
  let n = 0
  for (const item of items) {
    if (!pick(item)) continue
    await db.checklistInstanceItem.update({
      where: { id: item.id },
      data: {
        isDone: true,
        doneAt: doneAt(item),
        doneById: doneBy(item),
        note: note?.(item) ?? null,
      },
    })
    n++
  }
  return n
}

export async function seedHrProcesses(ctx: DemoContext): Promise<void> {
  const M = "Onboarding & exit"
  const neha = idOf(ctx, "neha")
  const kavya = idOf(ctx, "kavya")
  const rohan = idOf(ctx, "rohan")

  // ── onboarding: Rahul (joined days ago) - about half done ──────────────────
  const rahulId = idOf(ctx, "rahul")
  const onboarding = await instantiateChecklist({
    employeeId: rahulId,
    kind: "ONBOARDING",
    actorId: neha,
  })
  if (!onboarding) throw new Error("No onboarding template - provisioning should have seeded one")
  const rahulJoined = (await db.employee.findUnique({
    where: { id: rahulId },
    select: { dateOfJoining: true },
  }))!.dateOfJoining!
  const total = await db.checklistInstanceItem.count({ where: { instanceId: onboarding.id } })
  let ticked = 0
  const half = Math.floor(total / 2)
  const doneRahul = await markItems(
    ctx,
    onboarding.id,
    // HR's items due by today, bar one left overdue. Every MANAGER item stays
    // open, so they sit on Rohan's "Waiting on you" (e.g. "Role-specific
    // process training").
    (i) =>
      i.assigneeRole === "HR" &&
      (i.dueDate === null ? i.displayOrder < 3 : i.dueDate <= ctx.today) &&
      i.displayOrder !== 6 &&
      ticked++ < half,
    (i) => (i.assigneeRole === "MANAGER" ? rohan : i.displayOrder % 2 === 0 ? kavya : neha),
    (i) => at(i.dueDate && i.dueDate < ctx.today ? i.dueDate : rahulJoined, "15:30"),
  )
  await db.checklistInstance.update({
    where: { id: onboarding.id },
    data: { createdAt: at(addDays(rahulJoined, -4), "12:00") },
  })
  ctx.summary.add(M, `Rahul's onboarding checklist (${doneRahul}/${total} done)`, 1)

  // ── onboarding: Ishaan - completed months ago (history on the COMPLETED tab)
  const ishaanId = idOf(ctx, "ishaan")
  const ishaanJoined = (await db.employee.findUnique({
    where: { id: ishaanId },
    select: { dateOfJoining: true },
  }))!.dateOfJoining!
  const ishaanCl = await instantiateChecklist({
    employeeId: ishaanId,
    kind: "ONBOARDING",
    actorId: neha,
  })
  if (ishaanCl) {
    await markItems(
      ctx,
      ishaanCl.id,
      () => true,
      (i) => (i.assigneeRole === "MANAGER" ? idOf(ctx, "aarav") : neha),
      (i) => at(i.dueDate ?? ishaanJoined, "16:00"),
    )
    await db.checklistInstance.update({
      where: { id: ishaanCl.id },
      data: {
        status: "COMPLETED",
        completedAt: at(addDays(ishaanJoined, 31), "17:00"),
        completedById: neha,
        createdAt: at(addDays(ishaanJoined, -4), "12:00"),
      },
    })
    ctx.summary.add(M, "completed onboarding checklist (Ishaan)", 1)
  }

  // ── joinee scorecards ──────────────────────────────────────────────────────
  const r = ctx.rand
  const scorecard = async (employeeId: string, joined: Date, opts: { complete: boolean }) => {
    const card = await make(ctx, "joineeScorecard", {
      employeeId,
      hrSpocId: kavya,
      createdById: neha,
      managerObservations: opts.complete
        ? "Picked up our CRM and proposal templates quickly. Confident on client calls by the second week."
        : null,
      hrObservations: opts.complete
        ? "Punctual, mixes well with the team, completed every induction session."
        : null,
      recommendation: opts.complete ? "CONTINUE" : null,
      createdAt: at(joined, "10:00"),
    })
    const dates = firstWorkingDays(ctx, joined, SCORECARD_DAYS)
    const score = () => r.int(3, 5)
    await makeMany(
      ctx,
      "joineeScorecardDay",
      dates.map((date, i) => {
        const past = date < ctx.today
        const isToday = date.getTime() === ctx.today.getTime()
        const mgr = opts.complete || past || isToday
        const hr = opts.complete || past
        return {
          scorecardId: card,
          dayNumber: i + 1,
          date,
          mgrJobRole: mgr ? score() : null,
          mgrCommunication: mgr ? score() : null,
          mgrLearning: mgr ? score() : null,
          hrDiscipline: hr ? score() : null,
          hrCulture: hr ? score() : null,
          hrLearning: hr ? score() : null,
        }
      }),
    )
  }
  await scorecard(rahulId, rahulJoined, { complete: false })
  await scorecard(ishaanId, ishaanJoined, { complete: true })
  ctx.summary.add(M, "joinee scorecards (Rahul in progress, Ishaan complete)", 2)

  // ── exit clearance: route Finance + IT/Admin sign-offs to their heads ───────
  // The default template seeds these DEPARTMENT_HEAD items with no department;
  // pointing them at Finance (head: Meera) and Technology (head: Karthik) is
  // what puts the exit on their "Waiting on you" page.
  const exitTemplate = await db.checklistTemplate.findFirst({
    where: { kind: "EXIT" },
    select: { id: true },
  })
  if (exitTemplate) {
    const items = await db.checklistTemplateItem.findMany({
      where: { section: { templateId: exitTemplate.id }, assigneeRole: "DEPARTMENT_HEAD" },
      select: { id: true, text: true },
    })
    for (const item of items) {
      const dept =
        item.text === "Finance" ? "Finance" : item.text === "IT / Admin" ? "Technology" : null
      if (dept) {
        await db.checklistTemplateItem.update({
          where: { id: item.id },
          data: { clearanceDepartmentId: ctx.dept[dept] },
        })
      }
    }
  }

  // ── resignations ───────────────────────────────────────────────────────────
  const R = "Resignations"
  const poojaId = idOf(ctx, "pooja")
  const applied = shiftWorkingDays(ctx, ctx.today, -12)
  const lastDay = shiftWorkingDays(ctx, ctx.today, 15)
  const reviewed = shiftWorkingDays(ctx, applied, 2)
  const resignationId = await make(ctx, "resignation", {
    employeeId: poojaId,
    reason:
      "I have accepted an offer to lead content for a D2C brand in Pune, closer to my family. Thank you for four great years - I will make sure the Sunmeadow and UrbanNest handovers are complete.",
    requestedLastWorkingDate: lastDay,
    status: POOJA_STATUS,
    reviewerId: POOJA_STATUS === "APPROVED" ? neha : null,
    reviewNote:
      POOJA_STATUS === "APPROVED"
        ? "Accepted. Last working day as requested; please complete the handover with Ananya."
        : null,
    reviewedAt: POOJA_STATUS === "APPROVED" ? at(reviewed, "16:20") : null,
    createdAt: at(applied, "10:05"),
  })
  ctx.summary.add(R, `Pooja's resignation (${POOJA_STATUS}, last day ${dayKey(lastDay)})`, 1)

  if (POOJA_STATUS === "APPROVED") {
    await db.employee.update({
      where: { id: poojaId },
      data: { resignationDate: reviewed, lastWorkingDate: lastDay },
    })
    const exit = await instantiateChecklist({
      employeeId: poojaId,
      kind: "EXIT",
      resignationId,
      anchorDate: lastDay,
      actorId: neha,
    })
    if (exit) {
      await db.checklistInstance.update({
        where: { id: exit.id },
        data: { createdAt: at(reviewed, "16:25") },
      })
      const done = await markItems(
        ctx,
        exit.id,
        (i) => i.sectionTitle.startsWith("Step 1") || i.text === "Prepare handover document",
        (i) => (i.assigneeRole === "EMPLOYEE" ? poojaId : neha),
        () => at(shiftWorkingDays(ctx, reviewed, 1), "12:15"),
        (i) =>
          i.text === "Prepare handover document"
            ? "Handover doc shared on the Sunmeadow and UrbanNest project files."
            : null,
      )
      const open = await db.checklistInstanceItem.findMany({
        where: {
          instanceId: exit.id,
          isDone: false,
          itemKind: "CLEARANCE",
          assigneeId: { not: null },
        },
        select: { assignee: { select: { firstName: true } } },
      })
      ctx.summary.add(M, `Pooja's exit checklist (${done} items done)`, 1)
      ctx.summary.add(
        M,
        `  open clearances: ${open.map((o) => o.assignee?.firstName).join(", ")}`,
        open.length,
      )
    }
  }

  // The leaver (dataset DEMO_FORMER_PEOPLE): accepted resignation, exit done.
  const { DEMO_FORMER_PEOPLE } = await import("@/features/help/demo/dataset")
  for (const f of DEMO_FORMER_PEOPLE) {
    const id = idOf(ctx, f.key)
    const left = new Date(`${ctx.ref[`left:${f.key}`]}T00:00:00Z`)
    const appliedOn = shiftWorkingDays(ctx, left, -22)
    const resId = await make(ctx, "resignation", {
      employeeId: id,
      reason: f.exitReason,
      requestedLastWorkingDate: left,
      status: "APPROVED",
      reviewerId: neha,
      reviewNote: "Accepted. Thank you for everything - all the best!",
      reviewedAt: at(shiftWorkingDays(ctx, appliedOn, 1), "15:00"),
      createdAt: at(appliedOn, "11:20"),
    })
    const exit = await instantiateChecklist({
      employeeId: id,
      kind: "EXIT",
      resignationId: resId,
      anchorDate: left,
      actorId: neha,
    })
    if (exit) {
      await markItems(
        ctx,
        exit.id,
        () => true,
        (i) => i.assigneeId ?? neha,
        (i) => at(i.dueDate && i.dueDate <= left ? i.dueDate : left, "16:00"),
      )
      await db.checklistInstance.update({
        where: { id: exit.id },
        data: {
          status: "COMPLETED",
          completedAt: at(left, "18:00"),
          completedById: neha,
          createdAt: at(appliedOn, "15:05"),
        },
      })
    }
    ctx.summary.add(
      R,
      `${f.firstName}'s resignation (APPROVED, left ${dayKey(left)}; exit COMPLETED)`,
      1,
    )
  }

  await make(ctx, "resignation", {
    employeeId: idOf(ctx, "arjun"),
    reason:
      "My family is relocating to Bengaluru next month, so I will not be able to continue in the Gurugram office. Happy to serve the full notice period.",
    requestedLastWorkingDate: shiftWorkingDays(ctx, ctx.today, 30),
    status: "PENDING",
    createdAt: at(shiftWorkingDays(ctx, ctx.today, -1), "18:40"),
  })
  ctx.summary.add(R, "Arjun's resignation (PENDING - for the review queue)", 1)

  // ── document requests (no file needed until the employee uploads) ──────────
  const D = "Documents"
  const docRequests = [
    {
      who: "rahul",
      title: "PAN Card",
      category: "IDENTITY",
      note: "Needed for payroll and TDS.",
      due: 3,
    },
    {
      who: "rahul",
      title: "Graduation Degree Certificate",
      category: "ACADEMIC",
      note: "Scanned copy of the final degree.",
      due: 5,
    },
    {
      who: "rahul",
      title: "Relieving Letter - Previous Employer",
      category: "EMPLOYMENT",
      note: null,
      due: 7,
    },
    {
      who: "priya",
      title: "Updated Address Proof",
      category: "IDENTITY",
      note: "You changed your address last month - please upload a rent agreement or utility bill.",
      due: 10,
    },
    {
      who: "ishaan",
      title: "Signed Confidentiality Agreement",
      category: "EMPLOYMENT",
      note: null,
      due: -20,
      status: "CANCELLED",
    },
  ]
  await makeMany(
    ctx,
    "documentRequest",
    docRequests.map((d) => ({
      employeeId: idOf(ctx, d.who),
      requestedById: d.who === "rahul" ? kavya : neha,
      title: d.title,
      category: d.category,
      note: d.note,
      dueDate: addDays(ctx.today, d.due),
      status: d.status ?? "PENDING",
      createdAt: at(addDays(ctx.today, Math.min(-1, d.due - 7)), "11:45"),
    })),
  )
  ctx.summary.add(D, "document requests (HR asking for uploads)", docRequests.length)

  // ── stock register ─────────────────────────────────────────────────────────
  const S = "Stock register"
  const stock: [string, number, number, string | null][] = [
    ["Diary", 180, 40, "A5, company logo on the cover"],
    ["Notepad", 60, 60, null],
    ["Pen", 15, 200, "Blue ball pen"],
    ["Water Bottle", 350, 30, "Steel, 750 ml"],
    ["Coffee Mug", 220, 30, null],
    ["T-shirt", 450, 40, "Company T-shirt, sizes S-XXL"],
    ["ID Card Holder & Lanyard", 40, 50, null],
    ["Laptop Bag", 1200, 15, "For new joiners on laptop allocation"],
  ]
  const itemId: Record<string, string> = {}
  for (const [i, [name, price, qty, notes]] of stock.entries()) {
    itemId[name] = await make(ctx, "stockItem", {
      name,
      position: i,
      pricePerPiece: price,
      purchasedQty: qty,
      notes,
      createdAt: at(addDays(ctx.today, -200), "11:00"),
    })
  }
  const issues: Record<string, unknown>[] = []
  const issue = (
    who: string | null,
    holderName: string,
    item: string,
    quantity: number,
    on: Date,
    notes?: string,
  ) =>
    issues.push({
      itemId: itemId[item],
      holderName,
      employeeId: who ? idOf(ctx, who) : null,
      quantity,
      issuedOn: on,
      notes: notes ?? null,
    })
  const { DEMO_PEOPLE } = await import("@/features/help/demo/dataset")
  // Company Day kit for everyone who was here two months ago.
  const companyDay = shiftWorkingDays(ctx, ctx.today, -40)
  for (const p of DEMO_PEOPLE) {
    if (p.joinedDaysAgo < 60) continue
    const name = `${p.firstName} ${p.lastName}`
    issue(p.key, name, "T-shirt", 1, companyDay, "Company Day")
    issue(p.key, name, "Coffee Mug", 1, companyDay, "Company Day")
  }
  // Welcome kits for this year's joiners.
  for (const key of ["ishaan", "rahul"] as const) {
    const p = DEMO_PEOPLE.find((x) => x.key === key)!
    const emp = (await db.employee.findUnique({
      where: { id: idOf(ctx, key) },
      select: { dateOfJoining: true },
    }))!
    const name = `${p.firstName} ${p.lastName}`
    for (const [item, q] of [
      ["Diary", 1],
      ["Pen", 2],
      ["Water Bottle", 1],
      ["ID Card Holder & Lanyard", 1],
      ["Laptop Bag", 1],
    ] as const) {
      issue(key, name, item, q, emp.dateOfJoining!, "Welcome kit")
    }
  }
  // Day-to-day stationery, and two holders who are not employees.
  issue("priya", "Priya Sharma", "Notepad", 2, shiftWorkingDays(ctx, ctx.today, -9))
  issue("ananya", "Ananya Gupta", "Pen", 5, shiftWorkingDays(ctx, ctx.today, -9))
  issue("vikram", "Vikram Singh", "Notepad", 1, shiftWorkingDays(ctx, ctx.today, -4))
  issue("sneha", "Sneha Reddy", "Diary", 1, shiftWorkingDays(ctx, ctx.today, -2))
  issue(
    null,
    "Aditi (summer intern)",
    "Diary",
    1,
    shiftWorkingDays(ctx, ctx.today, -70),
    "Intern kit",
  )
  issue(
    null,
    "Aditi (summer intern)",
    "Pen",
    2,
    shiftWorkingDays(ctx, ctx.today, -70),
    "Intern kit",
  )
  issue(null, "Front desk", "Pen", 20, shiftWorkingDays(ctx, ctx.today, -15))
  await makeMany(ctx, "stockIssue", issues)
  ctx.summary.add(S, "stock items", stock.length)
  ctx.summary.add(S, "issue rows", issues.length)
}
