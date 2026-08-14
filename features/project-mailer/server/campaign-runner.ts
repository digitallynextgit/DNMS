// =============================================================================
// Campaign runner
// =============================================================================
// Drains the send queue. Called by the in-process scheduler every 30 seconds -
// bulk sending cannot happen inside the HTTP request that starts it: a
// 2,000-recipient blast would time out halfway with no record of which half went.
//
// Everything about the design is aimed at "survives being interrupted":
//   • One ProjectCampaignSend row per recipient, written up front.
//   • Rows are claimed with a conditional update, so two overlapping ticks can
//     never send the same email twice.
//   • A crash mid-campaign leaves the remaining rows PENDING; the next tick just
//     carries on.
// =============================================================================

import "server-only"

import { db } from "@/server/db"
import { tryDecrypt } from "@/lib/crypto"
import { sendEmailWithSmtp, type ExplicitSmtp } from "@/lib/mailer"
import { buildVars, renderMerge } from "../lib/merge"
import { absolutizeMailerImages } from "../lib/image-url"
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

/**
 * Build the transport for the account the campaign was queued against.
 *
 * Deliberately by mailerId, not by project: a project can hold several sending
 * accounts, and a campaign must go out from the one that was chosen - not
 * whichever happens to be first.
 */
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

/**
 * Process one batch across whichever campaigns are in flight.
 *
 * Deliberately batch-per-tick rather than "finish this campaign": a huge
 * campaign must not starve a small one queued behind it, and a tick that runs
 * for minutes would overlap the next.
 */
export async function runCampaignQueue(): Promise<RunnerSummary> {
  const summary: RunnerSummary = { campaigns: 0, sent: 0, failed: 0 }

  // Resolved once per tick, not per email. Every campaign image is re-pointed at
  // this host on the way out, so a body composed against localhost - or against a
  // previous domain - still arrives with an image the recipient can actually load.
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

    // Nothing left: close it out and move on.
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
          // FAILED only when NOTHING got through - a partial send is still a
          // send, and the per-recipient log says exactly who missed out.
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
      // No usable mailer: fail the whole campaign rather than silently leaving
      // it QUEUED forever, and say why on every outstanding row.
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
      // Claim it first. `status: "PENDING"` in the WHERE is what makes two
      // overlapping ticks unable to send the same email twice - the second
      // update matches zero rows.
      const claimed = await db.projectCampaignSend.updateMany({
        where: { id: row.id, status: "PENDING" },
        data: { status: "SENDING" },
      })
      if (claimed.count === 0) continue

      // Re-check the unsubscribe at SEND time, not just when the list was built:
      // somebody who opts out mid-campaign must not get the rest of it.
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

      // Same engine the compose preview uses, so what was previewed is what
      // sends - including unknown variables collapsing to empty rather than
      // shipping literal {{braces}} to a subscriber.
      const vars = buildVars({
        email: row.email,
        name: row.name,
        company: row.recipient?.company ?? null,
        fields: (row.recipient?.fields as Record<string, unknown> | null) ?? null,
      })
      const rendered = {
        subject: renderMerge(campaign.subject, vars),
        html: absolutizeMailerImages(renderMerge(campaign.bodyHtml, vars), appUrl),
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
 * Rows left in SENDING belong to a tick that died mid-flight (deploy, crash).
 * Put them back so the queue picks them up rather than stranding them.
 *
 * Safe because a claimed row is only marked SENT/FAILED after the send returns:
 * the worst case is one duplicate email, which is far better than a recipient
 * silently never receiving the campaign at all.
 */
export async function requeueStuckSends(olderThanMinutes = 10): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000)
  const { count } = await db.projectCampaignSend.updateMany({
    where: { status: "SENDING", createdAt: { lt: cutoff } },
    data: { status: "PENDING" },
  })
  return count
}
