// Drains the campaign send queue on the scheduler's 30s tick (bulk sends can't run in a request).
// One send row per recipient, claimed conditionally, so a crash or overlapping tick never
// double-sends and the next tick just carries on.

import "server-only"

import { db } from "@/server/db"
import { tryDecrypt } from "@/lib/crypto"
import { sendEmailWithSmtp, type ExplicitSmtp } from "@/lib/mailer"
import { buildVars, renderMerge } from "../lib/merge"
import { absolutizeMailerImages } from "../lib/image-url"
import { makeImagesResponsive } from "../lib/email-html"
import { getConfig } from "@/server/app-config"

/** Emails per tick. Keeps well under typical SMTP per-minute limits. */
const BATCH_SIZE = 25
/** Pause between messages, so a burst doesn't trip provider rate limiting. */
const INTER_SEND_DELAY_MS = 250

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export interface RunnerSummary {
  campaigns: number
  sent: number
  failed: number
}

/** Transport for the account the campaign was queued with - a project can have several. */
async function smtpFor(mailerId: string | null): Promise<ExplicitSmtp | null> {
  if (!mailerId) return null
  const mailer = await db.projectMailer.findUnique({ where: { id: mailerId } })
  if (!mailer || !mailer.isActive) return null

  const pass = tryDecrypt(mailer.password)
  if (!pass) {
    console.error("[campaign] could not decrypt SMTP password for mailer", mailerId)
    return null
  }

  return {
    host: mailer.host,
    port: mailer.port,
    secure: mailer.secure,
    user: mailer.username,
    pass,
    from: `"${mailer.fromName}" <${mailer.fromEmail}>`,
    replyTo: mailer.replyTo ?? undefined,
  }
}

/** One batch per tick across all live campaigns, so a huge one can't starve a small one. */
export async function runCampaignQueue(): Promise<RunnerSummary> {
  const summary: RunnerSummary = { campaigns: 0, sent: 0, failed: 0 }

  // Resolved once per tick; every image is re-pointed at this host (see absolutizeMailerImages).
  const appUrl = (await getConfig("APP_URL")) ?? process.env.NEXTAUTH_URL ?? ""

  const campaigns = await db.projectCampaign.findMany({
    where: { status: { in: ["QUEUED", "SENDING"] } },
    select: { id: true, projectId: true, mailerId: true, subject: true, bodyHtml: true },
    orderBy: { createdAt: "asc" },
    take: 3,
  })
  if (campaigns.length === 0) return summary

  for (const campaign of campaigns) {
    summary.campaigns++

    const pending = await db.projectCampaignSend.findMany({
      where: { campaignId: campaign.id, status: "PENDING" },
      select: {
        id: true,
        email: true,
        name: true,
        recipientId: true,
        recipient: { select: { company: true, fields: true, isSubscribed: true } },
      },
      take: BATCH_SIZE,
    })

    if (pending.length === 0) {
      const failed = await db.projectCampaignSend.count({
        where: { campaignId: campaign.id, status: "FAILED" },
      })
      const sent = await db.projectCampaignSend.count({
        where: { campaignId: campaign.id, status: "SENT" },
      })
      await db.projectCampaign.update({
        where: { id: campaign.id },
        data: {
          // FAILED only when nothing got through; the per-recipient log shows who missed out.
          status: sent === 0 && failed > 0 ? "FAILED" : "SENT",
          sentCount: sent,
          failedCount: failed,
          completedAt: new Date(),
        },
      })
      continue
    }

    const smtp = await smtpFor(campaign.mailerId)
    if (!smtp) {
      // No usable mailer: fail the campaign (and say why) instead of leaving it QUEUED forever.
      await db.projectCampaignSend.updateMany({
        where: { campaignId: campaign.id, status: "PENDING" },
        data: {
          status: "FAILED",
          error: "The sending account is missing, switched off, or its password could not be read",
        },
      })
      await db.projectCampaign.update({
        where: { id: campaign.id },
        data: { status: "FAILED", completedAt: new Date() },
      })
      continue
    }

    await db.projectCampaign.updateMany({
      where: { id: campaign.id, status: "QUEUED" },
      data: { status: "SENDING", startedAt: new Date() },
    })

    for (const row of pending) {
      // Claim first: the PENDING condition stops two overlapping ticks sending the same email.
      const claimed = await db.projectCampaignSend.updateMany({
        where: { id: row.id, status: "PENDING" },
        // requeueStuckSends measures staleness from claimedAt.
        data: { status: "SENDING", claimedAt: new Date() },
      })
      if (claimed.count === 0) continue

      // Re-check the unsubscribe at send time - someone may opt out mid-campaign.
      if (row.recipient && !row.recipient.isSubscribed) {
        {
          await db.projectCampaignSend.update({
            where: { id: row.id },
            data: { status: "FAILED", error: "Recipient unsubscribed before sending" },
          })
          summary.failed++
          continue
        }
      }

      // Same engine as the compose preview, so what was previewed is what sends.
      const vars = buildVars({
        email: row.email,
        name: row.name,
        company: row.recipient?.company ?? null,
        fields: (row.recipient?.fields as Record<string, unknown> | null) ?? null,
      })
      const rendered = {
        subject: renderMerge(campaign.subject, vars),
        html: makeImagesResponsive(
          absolutizeMailerImages(renderMerge(campaign.bodyHtml, vars), appUrl),
        ),
      }

      try {
        await sendEmailWithSmtp(smtp, {
          to: row.email,
          subject: rendered.subject,
          html: rendered.html,
        })
        await db.projectCampaignSend.update({
          where: { id: row.id },
          data: { status: "SENT", sentAt: new Date(), error: null },
        })
        summary.sent++
      } catch (err) {
        await db.projectCampaignSend.update({
          where: { id: row.id },
          data: {
            status: "FAILED",
            error: err instanceof Error ? err.message.slice(0, 500) : "Send failed",
          },
        })
        summary.failed++
      }

      await sleep(INTER_SEND_DELAY_MS)
    }

    // Keep the counters live so the UI can show progress mid-campaign.
    const [sent, failed] = await Promise.all([
      db.projectCampaignSend.count({ where: { campaignId: campaign.id, status: "SENT" } }),
      db.projectCampaignSend.count({ where: { campaignId: campaign.id, status: "FAILED" } }),
    ])
    await db.projectCampaign.update({
      where: { id: campaign.id },
      data: { sentCount: sent, failedCount: failed },
    })
  }

  return summary
}

/**
 * Requeue rows left SENDING by a tick that died. Worst case is one duplicate email, which beats
 * a recipient never getting it.
 */
export async function requeueStuckSends(olderThanMinutes = 10): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000)
  // From claimedAt, not createdAt: all rows share a createdAt, so active sends would be requeued
  // and sent twice. A null claimedAt was never claimed, so isn't stuck.
  const { count } = await db.projectCampaignSend.updateMany({
    where: { status: "SENDING", claimedAt: { lt: cutoff } },
    data: { status: "PENDING", claimedAt: null },
  })
  return count
}
