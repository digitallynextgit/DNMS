// =============================================================================
// Project mailer (staff side)
// =============================================================================
// SMTP settings, templates, recipients and campaigns - all scoped to ONE
// project. The projectId comes from the route guard (withProjectManager), never
// from a body, and every update/delete filters on it as well as the row id.
//
// The SMTP password is encrypted at rest and NEVER selected into a response.
// Screens show whether credentials verify, not what they are.
// =============================================================================

import "server-only"

import { db } from "@/server/db"
import { encrypt, tryDecrypt } from "@/lib/crypto"
import { recordActivity } from "@/lib/activity"
import { sendEmailWithSmtp, verifySmtp } from "@/lib/mailer"
import { ok, fail, runAction, serialize, type ActionResult } from "@/server/action-result"
import {
  mailerSettingsSchema,
  templateSchema,
  recipientSchema,
  recipientBulkSchema,
  recipientImportSchema,
  campaignSchema,
  testSendSchema,
  type MailerSettingsInput,
  type TemplateInput,
  type RecipientInput,
  type RecipientBulkInput,
  type RecipientImportInput,
  type CampaignInput,
  type TestSendInput,
} from "../schemas/project-mailer.schema"
import type { Session } from "next-auth"

/** Everything EXCEPT the password. Used for every read path. */
const MAILER_SELECT = {
  id: true,
  name: true,
  fromName: true,
  fromEmail: true,
  replyTo: true,
  host: true,
  port: true,
  secure: true,
  username: true,
  isActive: true,
  lastVerifiedAt: true,
  lastError: true,
} as const

const TEMPLATE_SELECT = {
  id: true,
  name: true,
  subject: true,
  bodyHtml: true,
  bodyMode: true,
  isActive: true,
  updatedAt: true,
} as const

const CAMPAIGN_SELECT = {
  id: true,
  name: true,
  subject: true,
  status: true,
  totalCount: true,
  sentCount: true,
  failedCount: true,
  startedAt: true,
  completedAt: true,
  createdAt: true,
  createdBy: { select: { firstName: true, lastName: true } },
  mailer: { select: { id: true, name: true, fromEmail: true } },
} as const

/** The whole Mailer tab in one round trip. */
export async function getProjectMailer(projectId: string): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const [mailers, templates, recipients, campaigns, subscribed, total, tagRows, untagged] =
      await Promise.all([
        db.projectMailer.findMany({
          where: { projectId },
          select: MAILER_SELECT,
          orderBy: { name: "asc" },
        }),
        db.projectEmailTemplate.findMany({
          where: { projectId },
          select: TEMPLATE_SELECT,
          orderBy: { name: "asc" },
        }),
        db.projectRecipient.findMany({
          where: { projectId },
          select: {
            id: true,
            email: true,
            name: true,
            company: true,
            tags: true,
            fields: true,
            isSubscribed: true,
          },
          orderBy: { createdAt: "desc" },
          take: 500,
        }),
        db.projectCampaign.findMany({
          where: { projectId },
          select: CAMPAIGN_SELECT,
          orderBy: { createdAt: "desc" },
          take: 25,
        }),
        db.projectRecipient.count({ where: { projectId, isSubscribed: true } }),
        db.projectRecipient.count({ where: { projectId } }),
        // Segment sizes come from SQL over the WHOLE list, not from the 500 rows
        // above: counting the loaded page would quietly under-report every tag on
        // any list bigger than that, and a wrong number here is one somebody
        // plans a campaign around.
        db.$queryRaw<{ tag: string; count: number }[]>`
          SELECT unnest(tags) AS tag, COUNT(*)::int AS count
          FROM project_recipients
          WHERE project_id = ${projectId}
          GROUP BY 1
          ORDER BY count DESC, tag ASC
        `,
        db.$queryRaw<{ count: number }[]>`
          SELECT COUNT(*)::int AS count
          FROM project_recipients
          WHERE project_id = ${projectId} AND cardinality(tags) = 0
        `,
      ])

    // Tag names alone, for the compose screen's segment picker.
    const allTags = tagRows.map((t) => t.tag).sort()

    return ok(
      serialize({
        data: {
          mailers,
          templates,
          recipients,
          campaigns,
          subscribedCount: subscribed,
          recipientCount: total,
          allTags,
          tagCounts: tagRows,
          untaggedCount: untagged[0]?.count ?? 0,
        },
      }),
    )
  })
}

// ─── SMTP settings ──────────────────────────────────────────────────────────

function mailerData(input: MailerSettingsInput) {
  return {
    name: input.name,
    fromName: input.fromName,
    fromEmail: input.fromEmail,
    replyTo: input.replyTo || null,
    host: input.host,
    port: input.port,
    secure: input.secure,
    username: input.username,
    isActive: input.isActive,
  }
}

/** Never log the password, changed or not. */
function auditableSettings(input: MailerSettingsInput) {
  return { ...input, password: input.password ? "***changed***" : "***unchanged***" }
}

export async function createMailer(
  projectId: string,
  body: MailerSettingsInput,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const input = mailerSettingsSchema.parse(body)
    if (!input.password) return fail("A password is required", undefined, 422)

    const clash = await db.projectMailer.findFirst({
      where: { projectId, name: input.name },
      select: { id: true },
    })
    if (clash) return fail("An account with that name already exists", undefined, 409)

    const mailer = await db.projectMailer.create({
      data: { projectId, ...mailerData(input), password: encrypt(input.password) },
      select: MAILER_SELECT,
    })

    await recordActivity(session, {
      projectId,
      action: "project_mailer:create",
      summary: `Added the sending account "${input.name}" (${input.fromEmail})`,
      module: "project",
      entityType: "ProjectMailer",
      entityId: mailer.id,
      changes: auditableSettings(input),
    })
    return ok(serialize({ data: mailer }))
  })
}

export async function updateMailer(
  projectId: string,
  mailerId: string,
  body: MailerSettingsInput,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const input = mailerSettingsSchema.parse(body)

    const existing = await db.projectMailer.findFirst({
      where: { id: mailerId, projectId },
      select: { id: true },
    })
    if (!existing) return fail("Account not found", undefined, 404)

    const clash = await db.projectMailer.findFirst({
      where: { projectId, name: input.name, id: { not: mailerId } },
      select: { id: true },
    })
    if (clash) return fail("Another account already uses that name", undefined, 409)

    const mailer = await db.projectMailer.update({
      where: { id: mailerId },
      data: {
        ...mailerData(input),
        // A blank password means "keep the stored one" - it is never sent to the
        // browser, so blank cannot mean "clear it" without wiping working
        // credentials every time somebody edits the sender name.
        ...(input.password ? { password: encrypt(input.password) } : {}),
      },
      select: MAILER_SELECT,
    })

    await recordActivity(session, {
      projectId,
      action: "project_mailer:update",
      summary: `Updated the sending account "${input.name}"`,
      module: "project",
      entityType: "ProjectMailer",
      entityId: mailerId,
      changes: auditableSettings(input),
    })
    return ok(serialize({ data: mailer }))
  })
}

export async function deleteMailer(
  projectId: string,
  mailerId: string,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const existing = await db.projectMailer.findFirst({
      where: { id: mailerId, projectId },
      select: { id: true },
    })
    if (!existing) return fail("Account not found", undefined, 404)

    // Refuse while it is mid-send: the runner needs these credentials to finish,
    // and the campaign would fail every remaining recipient.
    const inFlight = await db.projectCampaign.count({
      where: { mailerId, status: { in: ["QUEUED", "SENDING"] } },
    })
    if (inFlight > 0) {
      return fail("A campaign is still sending from this account", undefined, 409)
    }

    // Campaign history keeps its mailerId FK as SET NULL, so past sends still
    // exist - they just no longer name a live account.
    await db.projectMailer.delete({ where: { id: mailerId } })
    await recordActivity(session, {
      projectId,
      action: "project_mailer:delete",
      summary: "Removed a sending account",
      module: "project",
      entityType: "ProjectMailer",
      entityId: mailerId,
    })
    return ok(serialize({ data: { id: mailerId } }))
  })
}

/** Verify the stored credentials and send a real test email. */
export async function sendTestEmail(
  projectId: string,
  mailerId: string,
  body: TestSendInput,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const input = testSendSchema.parse(body)
    const mailer = await db.projectMailer.findFirst({ where: { id: mailerId, projectId } })
    if (!mailer) return fail("Account not found", undefined, 404)

    const pass = tryDecrypt(mailer.password)
    if (!pass) return fail("Stored password could not be read - re-enter it", undefined, 500)

    const smtp = {
      host: mailer.host,
      port: mailer.port,
      secure: mailer.secure,
      user: mailer.username,
      pass,
      from: `"${mailer.fromName}" <${mailer.fromEmail}>`,
      replyTo: mailer.replyTo ?? undefined,
    }

    try {
      await verifySmtp(smtp)
      await sendEmailWithSmtp(smtp, {
        to: input.to,
        subject: "DNMS test email",
        html: `<p>This is a test from the project mailer.</p><p>If you received it, the SMTP settings work and campaigns will send from <strong>${mailer.fromEmail}</strong>.</p>`,
        text: "This is a test from the project mailer. The SMTP settings work.",
      })
      await db.projectMailer.update({
        where: { id: mailerId },
        data: { lastVerifiedAt: new Date(), lastError: null },
      })
      return ok(serialize({ data: { ok: true } }))
    } catch (err) {
      const message = err instanceof Error ? err.message.slice(0, 500) : "Could not send"
      // Recorded so the screen can show that these credentials are known-broken
      // rather than merely untested.
      await db.projectMailer.update({
        where: { id: mailerId },
        data: { lastError: message, lastVerifiedAt: null },
      })
      return fail(message, undefined, 400)
    }
  })
}

// ─── Templates ──────────────────────────────────────────────────────────────

export async function createTemplate(
  projectId: string,
  body: TemplateInput,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const input = templateSchema.parse(body)
    const clash = await db.projectEmailTemplate.findFirst({
      where: { projectId, name: input.name },
      select: { id: true },
    })
    if (clash) return fail("A template with that name already exists", undefined, 409)

    const template = await db.projectEmailTemplate.create({
      data: { projectId, ...input, createdById: session.user.id },
      select: TEMPLATE_SELECT,
    })
    await recordActivity(session, {
      projectId,
      action: "project_template:create",
      summary: `Created the template "${input.name}"`,
      module: "project",
      entityType: "ProjectEmailTemplate",
      entityId: template.id,
    })
    return ok(serialize({ data: template }))
  })
}

export async function updateTemplate(
  projectId: string,
  templateId: string,
  body: TemplateInput,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const input = templateSchema.parse(body)
    const existing = await db.projectEmailTemplate.findFirst({
      where: { id: templateId, projectId },
      select: { id: true },
    })
    if (!existing) return fail("Template not found", undefined, 404)

    const template = await db.projectEmailTemplate.update({
      where: { id: templateId },
      data: input,
      select: TEMPLATE_SELECT,
    })
    await recordActivity(session, {
      projectId,
      action: "project_template:update",
      summary: `Edited the template "${input.name}"`,
      module: "project",
      entityType: "ProjectEmailTemplate",
      entityId: templateId,
    })
    return ok(serialize({ data: template }))
  })
}

export async function deleteTemplate(
  projectId: string,
  templateId: string,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const existing = await db.projectEmailTemplate.findFirst({
      where: { id: templateId, projectId },
      select: { id: true },
    })
    if (!existing) return fail("Template not found", undefined, 404)

    await db.projectEmailTemplate.delete({ where: { id: templateId } })
    await recordActivity(session, {
      projectId,
      action: "project_template:delete",
      summary: "Deleted a template",
      module: "project",
      entityType: "ProjectEmailTemplate",
      entityId: templateId,
    })
    return ok(serialize({ data: { id: templateId } }))
  })
}

// ─── Recipients ─────────────────────────────────────────────────────────────

export async function addRecipient(
  projectId: string,
  body: RecipientInput,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const input = recipientSchema.parse(body)
    const existing = await db.projectRecipient.findFirst({
      where: { projectId, email: input.email },
      select: { id: true },
    })
    if (existing) return fail("That address is already on the list", undefined, 409)

    const recipient = await db.projectRecipient.create({
      data: {
        projectId,
        email: input.email,
        name: input.name || null,
        company: input.company || null,
        tags: input.tags,
        fields: Object.keys(input.fields).length ? input.fields : undefined,
      },
    })
    return ok(serialize({ data: recipient }))
  })
}

/** Paste-import. Accepts "email", "Name <email>" or "Name,email" per line. */
export async function addRecipientsBulk(
  projectId: string,
  body: RecipientBulkInput,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const input = recipientBulkSchema.parse(body)

    const parsed: { email: string; name: string | null }[] = []
    for (const line of input.raw.split(/[\r\n]+/)) {
      const trimmed = line.trim()
      if (!trimmed) continue

      // "Name <email>"
      const angle = trimmed.match(/^(.*?)\s*<([^>]+)>$/)
      // "Name,email" / "Name;email" / "Name\temail"
      const delimited = trimmed.match(/^(.*?)[,;\t]\s*([^\s,;]+@[^\s,;]+)$/)

      const email = (angle?.[2] ?? delimited?.[2] ?? trimmed).trim().toLowerCase()
      const name = (angle?.[1] ?? delimited?.[1] ?? "").trim() || null
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue
      parsed.push({ email, name })
    }

    if (parsed.length === 0) return fail("No valid email addresses found", undefined, 422)

    // Dedupe within the paste itself before touching the database.
    const unique = [...new Map(parsed.map((p) => [p.email, p])).values()]

    const result = await db.projectRecipient.createMany({
      data: unique.map((p) => ({
        projectId,
        email: p.email,
        name: p.name,
        tags: input.tags,
      })),
      // Re-pasting a list must not explode on the ones already there.
      skipDuplicates: true,
    })

    return ok(
      serialize({
        data: { parsed: unique.length, added: result.count, skipped: unique.length - result.count },
      }),
    )
  })
}

/**
 * Import recipients from a spreadsheet the browser has already parsed and mapped.
 *
 * Three outcomes per row, all reported back rather than silently applied:
 *   • a new address is created with the chosen tags,
 *   • an address already on the list gains the tags (see `tagExisting`),
 *   • an unusable row is skipped and counted.
 *
 * Unmapped columns land in `fields`, so a "City" column in the sheet becomes
 * {{City}} in a template without anyone configuring anything.
 */
export async function importRecipients(
  projectId: string,
  body: RecipientImportInput,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const input = recipientImportSchema.parse(body)

    // Validate per row. One bad cell in a 400-row sheet must not reject the
    // other 399 - the count comes back so the number is visible, not hidden.
    const valid = new Map<
      string,
      { email: string; name: string | null; fields: Record<string, string>; company: string | null }
    >()
    let invalid = 0
    for (const row of input.rows) {
      const email = row.email.trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        invalid++
        continue
      }
      // First occurrence wins, so a duplicate later in the sheet cannot blank a
      // name that the earlier row supplied.
      if (valid.has(email)) continue
      const fields = Object.fromEntries(
        Object.entries(row.fields ?? {}).filter(([k, v]) => k.trim() !== "" && v.trim() !== ""),
      )
      valid.set(email, {
        email,
        name: row.name?.trim() || null,
        company: row.company?.trim() || null,
        fields,
      })
    }

    if (valid.size === 0) {
      return fail(
        invalid > 0
          ? `None of the ${invalid} rows had a usable email address - check which column was mapped to Email`
          : "The sheet had no rows to import",
        undefined,
        422,
      )
    }

    const emails = [...valid.keys()]
    const existing = await db.projectRecipient.findMany({
      where: { projectId, email: { in: emails } },
      select: { email: true },
    })
    const already = new Set(existing.map((e) => e.email))

    const fresh = [...valid.values()].filter((r) => !already.has(r.email))
    const created = fresh.length
      ? await db.projectRecipient.createMany({
          data: fresh.map((r) => ({
            projectId,
            email: r.email,
            name: r.name,
            company: r.company,
            tags: input.tags,
            fields: Object.keys(r.fields).length ? r.fields : undefined,
          })),
          // Belt and braces: another import running concurrently could have
          // inserted one of these between the SELECT above and this INSERT.
          skipDuplicates: true,
        })
      : { count: 0 }

    // Tag the ones already on the list in ONE statement. Prisma cannot append to
    // a scalar array across many rows, and a loop of 3,000 updates would hold the
    // request open for minutes - so this drops to SQL and unions the arrays.
    let tagged = 0
    if (input.tagExisting && input.tags.length > 0 && already.size > 0) {
      tagged = await db.$executeRaw`
        UPDATE project_recipients
        SET tags = ARRAY(SELECT DISTINCT unnest(tags || ${input.tags}::text[])),
            updated_at = now()
        WHERE project_id = ${projectId}
          AND email = ANY(${[...already]}::text[])
      `
    }

    return ok(
      serialize({
        data: {
          parsed: input.rows.length,
          added: created.count,
          tagged,
          existing: already.size,
          invalid,
        },
      }),
    )
  })
}

export async function setRecipientSubscription(
  projectId: string,
  recipientId: string,
  isSubscribed: boolean,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const existing = await db.projectRecipient.findFirst({
      where: { id: recipientId, projectId },
      select: { id: true },
    })
    if (!existing) return fail("Recipient not found", undefined, 404)

    const recipient = await db.projectRecipient.update({
      where: { id: recipientId },
      data: { isSubscribed, unsubscribedAt: isSubscribed ? null : new Date() },
    })
    return ok(serialize({ data: recipient }))
  })
}

export async function deleteRecipient(
  projectId: string,
  recipientId: string,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const existing = await db.projectRecipient.findFirst({
      where: { id: recipientId, projectId },
      select: { id: true },
    })
    if (!existing) return fail("Recipient not found", undefined, 404)

    await db.projectRecipient.delete({ where: { id: recipientId } })
    return ok(serialize({ data: { id: recipientId } }))
  })
}

// ─── Campaigns ──────────────────────────────────────────────────────────────

/**
 * Queue a campaign: snapshot the audience into one send row per recipient and
 * hand it to the scheduler. Returns immediately - the request never sends mail.
 */
export async function queueCampaign(
  projectId: string,
  body: CampaignInput,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const input = campaignSchema.parse(body)

    // The chosen account must belong to THIS project - otherwise a campaign
    // could be sent through another client's SMTP credentials.
    const mailer = await db.projectMailer.findFirst({
      where: { id: input.mailerId, projectId },
      select: { id: true, isActive: true, name: true },
    })
    if (!mailer) return fail("That sending account doesn't exist on this project", undefined, 404)
    if (!mailer.isActive) return fail(`"${mailer.name}" is switched off`, undefined, 400)

    const audience = await db.projectRecipient.findMany({
      where: {
        projectId,
        isSubscribed: true,
        ...(input.tags.length ? { tags: { hasSome: input.tags } } : {}),
      },
      select: { id: true, email: true, name: true },
    })
    if (audience.length === 0) {
      return fail("No subscribed recipients match that selection", undefined, 422)
    }

    const campaign = await db.projectCampaign.create({
      data: {
        projectId,
        // Snapshotted, so the runner sends from what was chosen rather than
        // re-deciding later.
        mailerId: mailer.id,
        templateId: input.templateId || null,
        name: input.name,
        subject: input.subject,
        bodyHtml: input.bodyHtml,
        bodyMode: input.bodyMode,
        // QUEUED, not SENDING: the scheduler owns the transition, so a campaign
        // can't be left mid-send by the request that created it.
        status: "QUEUED",
        totalCount: audience.length,
        createdById: session.user.id,
        sends: {
          createMany: {
            data: audience.map((r) => ({ recipientId: r.id, email: r.email, name: r.name })),
          },
        },
      },
      select: CAMPAIGN_SELECT,
    })

    await recordActivity(session, {
      projectId,
      action: "campaign:queue",
      summary: `Sent the campaign "${input.name}" to ${audience.length} recipient${audience.length === 1 ? "" : "s"}`,
      module: "project",
      entityType: "ProjectCampaign",
      entityId: campaign.id,
      changes: { name: input.name, recipients: audience.length, tags: input.tags },
    })

    return ok(serialize({ data: campaign }))
  })
}

/** Stop a campaign that hasn't finished. Already-sent emails cannot be recalled. */
export async function cancelCampaign(
  projectId: string,
  campaignId: string,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const campaign = await db.projectCampaign.findFirst({
      where: { id: campaignId, projectId },
      select: { id: true, status: true },
    })
    if (!campaign) return fail("Campaign not found", undefined, 404)
    if (campaign.status === "SENT" || campaign.status === "CANCELLED") {
      return fail("That campaign has already finished", undefined, 400)
    }

    // Drop the outstanding queue, keep the log of what already went out.
    await db.projectCampaignSend.deleteMany({
      where: { campaignId, status: "PENDING" },
    })
    await db.projectCampaign.update({
      where: { id: campaignId },
      data: { status: "CANCELLED", completedAt: new Date() },
    })

    await recordActivity(session, {
      projectId,
      action: "campaign:cancel",
      summary: "Cancelled a campaign that was still sending",
      module: "project",
      entityType: "ProjectCampaign",
      entityId: campaignId,
    })
    return ok(serialize({ data: { id: campaignId } }))
  })
}

/**
 * Delete a finished campaign and its per-recipient log.
 *
 * Separate from cancelCampaign on purpose. Cancelling STOPS something and keeps
 * the record of what already went out; this destroys the record itself, which is
 * only ever right for clutter - a test send, a mistake - never for tidying up
 * real history. So the two are different verbs rather than one that quietly does
 * whichever the status implies.
 *
 * Refuses while in flight: deleting the rows the runner is mid-way through
 * claiming would strand a half-sent campaign with no log of who received it.
 * Cancel first, then delete.
 */
export async function deleteCampaign(
  projectId: string,
  campaignId: string,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const campaign = await db.projectCampaign.findFirst({
      where: { id: campaignId, projectId },
      select: { id: true, name: true, status: true, sentCount: true },
    })
    if (!campaign) return fail("Campaign not found", undefined, 404)
    if (campaign.status === "QUEUED" || campaign.status === "SENDING") {
      return fail("Cancel this campaign before deleting it - it is still sending", undefined, 409)
    }

    // The send rows go with it (FK is ON DELETE CASCADE), which is the point:
    // a campaign row without its per-recipient log is a worse record than none.
    await db.projectCampaign.delete({ where: { id: campaignId } })

    await recordActivity(session, {
      projectId,
      action: "campaign:delete",
      summary: `Deleted the campaign "${campaign.name}" and its record of ${campaign.sentCount} send(s)`,
      module: "project",
      entityType: "ProjectCampaign",
      entityId: campaignId,
      changes: { name: campaign.name, status: campaign.status, sentCount: campaign.sentCount },
    })
    return ok(serialize({ data: { id: campaignId, deleted: true } }))
  })
}

/** Per-recipient outcome for one campaign. */
export async function getCampaignSends(
  projectId: string,
  campaignId: string,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const campaign = await db.projectCampaign.findFirst({
      where: { id: campaignId, projectId },
      select: { id: true },
    })
    if (!campaign) return fail("Campaign not found", undefined, 404)

    const sends = await db.projectCampaignSend.findMany({
      where: { campaignId },
      select: { id: true, email: true, name: true, status: true, error: true, sentAt: true },
      orderBy: [{ status: "asc" }, { email: "asc" }],
      take: 1000,
    })
    return ok(serialize({ data: sends }))
  })
}

// ─── Images ─────────────────────────────────────────────────────────────────

/**
 * Delete an uploaded image and reclaim its B2 object.
 *
 * REFUSES when the image is still referenced by a campaign that has gone out (or
 * is going out). Those emails are already in inboxes pointing at this exact URL -
 * deleting the object would turn them into broken boxes for every recipient, and
 * there is no way to fix it after the fact. Templates and drafts are fair game:
 * nothing has been delivered from them yet.
 */
export async function deleteMailerImage(
  projectId: string,
  assetId: string,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const asset = await db.projectMailerAsset.findFirst({
      where: { id: assetId, projectId },
      select: { id: true, objectKey: true, fileName: true },
    })
    // Already gone: report success so a double-click, or removing an image that
    // was never uploaded through us, isn't surfaced as an error.
    if (!asset) return ok(serialize({ data: { id: assetId, deleted: false } }))

    const sentReference = await db.projectCampaign.findFirst({
      where: {
        projectId,
        status: { in: ["QUEUED", "SENDING", "SENT"] },
        bodyHtml: { contains: assetId },
      },
      select: { name: true },
    })
    if (sentReference) {
      return fail(
        `Removed from the editor, but the file was kept: the campaign "${sentReference.name}" has already been sent using it, and deleting it would break the image in every recipient's inbox.`,
        undefined,
        409,
      )
    }

    const { deleteFile } = await import("@/lib/storage")
    await deleteFile(asset.objectKey).catch((e) =>
      console.error("[mailer-image] B2 delete failed:", asset.objectKey, e),
    )
    await db.projectMailerAsset.delete({ where: { id: assetId } })

    await recordActivity(session, {
      projectId,
      action: "mailer_image:delete",
      summary: `Removed the image "${asset.fileName}"`,
      module: "project",
      entityType: "ProjectMailerAsset",
      entityId: assetId,
      changes: { fileName: asset.fileName },
    })

    return ok(serialize({ data: { id: assetId, deleted: true } }))
  })
}
