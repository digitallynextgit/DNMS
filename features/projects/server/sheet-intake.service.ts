import "server-only"

import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { Prisma } from "@prisma/client"
import type { Session } from "next-auth"
import { z } from "zod"
import { db } from "@/server/db"
import { decrypt, encrypt } from "@/lib/crypto"
import { createNotifications } from "@/lib/notifications"
import { runUnscoped, runWithTenant } from "@/server/tenant-context"
import { canManageProject } from "./project-access"
import { appendRowByColumnName, createSheet, createWorkbook } from "./sheets.service"

// The tab API: an outside system (a website form) POSTs rows to a calendar tab with its secret.
// The intake is keyed by calendar and tab NAME, so the link outlives the month: each row goes to
// the edition of its own month (IST), which is started - columns copied - if it doesn't exist yet.

const SECRET_PREFIX = "dnms_"
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

const hashSecret = (secret: string) => createHash("sha256").update(secret).digest("hex")
const newSecret = () => `${SECRET_PREFIX}${randomBytes(24).toString("base64url")}`

export function intakeUrl(intakeId: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "")
  return `${base}/api/public/calendar-rows/${intakeId}`
}

export interface SheetIntakeInfo {
  id: string
  url: string
  secret: string
  workbookName: string
  tabName: string
  rowsReceived: number
  lastUsedAt: string | null
}

function toInfo(row: {
  id: string
  secretEnc: string
  workbookName: string
  tabName: string
  rowsReceived: number
  lastUsedAt: Date | null
}): SheetIntakeInfo {
  return {
    id: row.id,
    url: intakeUrl(row.id),
    secret: decrypt(row.secretEnc),
    workbookName: row.workbookName,
    tabName: row.tabName,
    rowsReceived: row.rowsReceived,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
  }
}

async function tabOf(projectId: string, sheetId: string) {
  return db.projectSheet.findFirst({
    where: { id: sheetId, projectId },
    select: {
      name: true,
      workbook: { select: { name: true, assignedToId: true, secondaryAssignedToId: true } },
    },
  })
}

/** The API secret is a key to the tab: the project's managers and the calendar's owners only. */
export async function canManageSheetIntake(
  session: Session,
  projectId: string,
  sheetId: string,
): Promise<boolean> {
  if (await canManageProject(session, projectId)) return true
  const tab = await tabOf(projectId, sheetId)
  const me = session.user.id
  return !!tab && (tab.workbook.assignedToId === me || tab.workbook.secondaryAssignedToId === me)
}

/** The tab's API, or null if it has none yet. */
export async function getSheetIntake(
  projectId: string,
  sheetId: string,
): Promise<SheetIntakeInfo | null> {
  const tab = await tabOf(projectId, sheetId)
  if (!tab) return null
  const row = await db.projectSheetIntake.findUnique({
    where: {
      projectId_workbookName_tabName: {
        projectId,
        workbookName: tab.workbook.name,
        tabName: tab.name,
      },
    },
  })
  return row ? toInfo(row) : null
}

/** Create the tab's API, or give it a new secret (the old one stops working at once). */
export async function issueSheetIntake(
  projectId: string,
  sheetId: string,
  actorId: string,
): Promise<SheetIntakeInfo> {
  const tab = await tabOf(projectId, sheetId)
  if (!tab) throw new Error("Tab not found")
  const secret = newSecret()
  const data = { secretHash: hashSecret(secret), secretEnc: encrypt(secret) }
  const row = await db.projectSheetIntake.upsert({
    where: {
      projectId_workbookName_tabName: {
        projectId,
        workbookName: tab.workbook.name,
        tabName: tab.name,
      },
    },
    update: data,
    create: {
      projectId,
      workbookName: tab.workbook.name,
      tabName: tab.name,
      createdById: actorId,
      ...data,
    },
  })
  return toInfo(row)
}

// ---- Receiving a row (public, authenticated by the secret) ----

const valueSchema = z.union([z.string().max(10_000), z.number(), z.boolean(), z.null()])

const bodySchema = z.object({
  fields: z
    .record(z.string().trim().min(1).max(100), valueSchema)
    .refine((f) => Object.keys(f).length > 0, "Send at least one field")
    .refine((f) => Object.keys(f).length <= 100, "Send at most 100 fields"),
  submittedAt: z.string().trim().max(64).optional(),
  submissionId: z.string().trim().min(1).max(200).optional(),
})

export type IntakeResult =
  | { status: 201 | 200; data: Record<string, unknown> }
  | { status: 401 | 404 | 410 | 422; code: string; message: string; details?: unknown }

/** "2026-10-16", "14:05", "2026-10" - the IST calendar day, time and month of an instant. */
function istParts(at: Date) {
  const iso = new Date(at.getTime() + IST_OFFSET_MS).toISOString()
  return { date: iso.slice(0, 10), time: iso.slice(11, 16), month: iso.slice(0, 7) }
}

const ym = (d: Date | null) => (d ? d.toISOString().slice(0, 7) : null)

/** The calendar edition for `month`, started from the nearest edition when it doesn't exist. */
async function editionFor(projectId: string, name: string, month: string) {
  const select = {
    id: true,
    name: true,
    periodMonth: true,
    assignedToId: true,
    secondaryAssignedToId: true,
  } as const
  const editions = await db.projectWorkbook.findMany({
    where: { projectId, name },
    select,
    orderBy: { periodMonth: "asc" },
  })
  if (editions.length === 0) return null
  // An undated calendar has one edition for good.
  const undated = editions.find((e) => !e.periodMonth)
  if (undated && editions.length === 1) return undated
  const hit = editions.find((e) => ym(e.periodMonth) === month)
  if (hit) return hit

  const dated = editions.filter((e) => e.periodMonth)
  const source =
    [...dated].reverse().find((e) => ym(e.periodMonth)! < month) ??
    dated.find((e) => ym(e.periodMonth)! > month) ??
    editions[0]!
  try {
    // Columns, layout, owners and team plan carry over; rows never do.
    const created = await createWorkbook(projectId, null, {
      name,
      periodMonth: month,
      copyFrom: { workbookId: source.id },
    })
    return db.projectWorkbook.findUniqueOrThrow({ where: { id: created.id }, select })
  } catch (e) {
    // Another row started the same month a moment ago.
    const again = await db.projectWorkbook.findFirst({
      where: { projectId, name, periodMonth: new Date(`${month}-01T00:00:00.000Z`) },
      select,
    })
    if (again) return again
    throw e
  }
}

/** The row's one-line gist for the notification: name, organisation, email or phone first. */
function gist(fields: [string, unknown][]): string {
  const pick = (...keys: string[]) =>
    fields.find(([k, v]) => keys.includes(k.trim().toLowerCase()) && v != null && v !== "")?.[1]
  const parts = [pick("name"), pick("organisation", "organization", "company"), pick("email")]
    .filter((v) => v != null)
    .map(String)
  if (parts.length === 0) {
    const first = fields.find(([, v]) => v != null && v !== "")
    if (first) parts.push(String(first[1]))
  }
  const text = parts.join(" · ")
  return text.length > 140 ? `${text.slice(0, 139)}…` : text
}

function presentedSecret(headers: Headers): string | null {
  const auth = headers.get("authorization") ?? ""
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim() || null
  return headers.get("x-api-key")?.trim() || null
}

function secretMatches(provided: string, expectedHash: string): boolean {
  const a = Buffer.from(hashSecret(provided), "hex")
  const b = Buffer.from(expectedHash, "hex")
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function receiveSheetIntakeRow(
  intakeId: string,
  headers: Headers,
  body: unknown,
): Promise<IntakeResult> {
  const secret = presentedSecret(headers)
  if (!secret) {
    return {
      status: 401,
      code: "UNAUTHORIZED",
      message: "Send the secret as Authorization: Bearer <secret>",
    }
  }
  // The secret both authenticates the sender and says which company this is.
  const intake = await runUnscoped("tab API: the secret identifies the company", () =>
    db.projectSheetIntake.findUnique({ where: { id: intakeId } }),
  )
  if (!intake || !secretMatches(secret, intake.secretHash)) {
    return { status: 401, code: "UNAUTHORIZED", message: "Unknown link or wrong secret" }
  }
  const tenant = await db.tenant.findUnique({
    where: { id: intake.tenantId },
    select: { id: true, slug: true },
  })
  if (!tenant) return { status: 410, code: "GONE", message: "This workspace no longer exists" }

  return runWithTenant({ tenantId: tenant.id, slug: tenant.slug }, async () => {
    // Fields may come wrapped in "fields" or as the body itself.
    const raw = (body && typeof body === "object" ? body : {}) as Record<string, unknown>
    const shaped =
      raw.fields !== undefined
        ? raw
        : {
            fields: Object.fromEntries(
              Object.entries(raw).filter(([k]) => k !== "submittedAt" && k !== "submissionId"),
            ),
            submittedAt: raw.submittedAt,
            submissionId: raw.submissionId,
          }
    const parsed = bodySchema.safeParse(shaped)
    if (!parsed.success) {
      return {
        status: 422,
        code: "VALIDATION_ERROR",
        message: "Invalid row",
        details: parsed.error.flatten(),
      }
    }
    const { fields, submittedAt, submissionId } = parsed.data

    const at = submittedAt ? new Date(submittedAt) : new Date()
    if (
      Number.isNaN(at.getTime()) ||
      at.getUTCFullYear() < 2000 ||
      at.getTime() > Date.now() + 24 * 60 * 60 * 1000
    ) {
      return {
        status: 422,
        code: "VALIDATION_ERROR",
        message: "submittedAt must be an ISO date-time, e.g. 2026-10-16T14:05:00+05:30",
      }
    }
    const { date, time, month } = istParts(at)

    // Date and Time first, so on a fresh tab they become its first two columns.
    const given = Object.entries(fields)
    const keys = new Set(given.map(([k]) => k.trim().toLowerCase()))
    const values: [string, unknown][] = [
      ...(keys.has("date") ? [] : [["Date", date] as [string, unknown]]),
      ...(keys.has("time") ? [] : [["Time", time] as [string, unknown]]),
      ...given,
    ]

    // A retry with the same submissionId is answered, not added again.
    let claimId: string | null = null
    if (submissionId) {
      try {
        claimId = (
          await db.projectSheetIntakeSubmission.create({
            data: { intakeId: intake.id, externalId: submissionId },
            select: { id: true },
          })
        ).id
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          const prev = await db.projectSheetIntakeSubmission.findUnique({
            where: { intakeId_externalId: { intakeId: intake.id, externalId: submissionId } },
            select: { month: true },
          })
          return {
            status: 200,
            data: { duplicate: true, submissionId, month: prev?.month ?? null },
          }
        }
        throw e
      }
    }

    try {
      const edition = await editionFor(intake.projectId, intake.workbookName, month)
      if (!edition) {
        return {
          status: 410,
          code: "GONE",
          message: `The calendar "${intake.workbookName}" no longer exists`,
        }
      }
      const tab =
        (await db.projectSheet.findFirst({
          where: { workbookId: edition.id, name: intake.tabName },
          select: { id: true },
        })) ??
        (await createSheet(intake.projectId, null, {
          workbookId: edition.id,
          name: intake.tabName,
        }))
      const row = await appendRowByColumnName(tab.id, values, "Received via the tab API")

      if (claimId)
        await db.projectSheetIntakeSubmission.update({
          where: { id: claimId },
          data: { sheetId: tab.id, rowId: row.rowId, month },
        })
      await db.projectSheetIntake.update({
        where: { id: intake.id },
        data: { rowsReceived: { increment: 1 }, lastUsedAt: new Date() },
      })

      // The calendar's owner (and their secondary) hear about it; nobody when it has none.
      const owners = [...new Set([edition.assignedToId, edition.secondaryAssignedToId])].filter(
        (id): id is string => !!id,
      )
      if (owners.length > 0) {
        const project = await db.project.findUnique({
          where: { id: intake.projectId },
          select: { slug: true },
        })
        await createNotifications(
          owners.map((employeeId) => ({
            employeeId,
            title: `New row in ${intake.tabName}`,
            message: `${edition.name} · ${date} ${time}${gist(given) ? ` · ${gist(given)}` : ""}`,
            type: "info" as const,
            link: `/projects/${project?.slug ?? intake.projectId}?tab=calendar&calendar=${edition.id}`,
          })),
          { force: true },
        )
      }

      return {
        status: 201,
        data: {
          calendar: edition.name,
          month,
          tab: intake.tabName,
          row: row.position + 1,
          ...(submissionId ? { submissionId } : {}),
        },
      }
    } catch (e) {
      // Free the submissionId so the sender's retry can land.
      if (claimId)
        await db.projectSheetIntakeSubmission.delete({ where: { id: claimId } }).catch(() => {})
      throw e
    }
  })
}
