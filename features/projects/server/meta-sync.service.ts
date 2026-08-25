import "server-only"

import { Prisma } from "@prisma/client"
import { db } from "@/server/db"
import { encrypt, tryDecrypt } from "@/lib/crypto"

// =============================================================================
// Meta Ads sync (ported from the adDashboard `meta_extractor.py` recipe).
// Pulls campaigns + daily insights from the Meta Graph API and upserts them into
// meta_campaigns / meta_campaign_metrics for one project. Credentials live on
// project_integrations, secrets ENCRYPTED.
// =============================================================================

const GRAPH = "https://graph.facebook.com/v21.0"

// How many writes ride in one batched $transaction. Big enough to collapse the
// round trips that dominated this sync, small enough that one chunk is not a
// long-held write transaction against the 10-connection pool.
const WRITE_CHUNK = 100

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

// Meta campaign status -> our status.
const STATUS_MAP: Record<string, string> = {
  ACTIVE: "active",
  PAUSED: "paused",
  DELETED: "completed",
  ARCHIVED: "completed",
}
const CONVERSION_TYPES = new Set([
  "lead",
  "purchase",
  "complete_registration",
  "offsite_conversion.fb_pixel_purchase",
])
const PURCHASE_TYPES = new Set(["purchase", "offsite_conversion.fb_pixel_purchase"])
const ATC_TYPES = new Set(["add_to_cart", "offsite_conversion.fb_pixel_add_to_cart"])

type Action = { action_type: string; value: string }

const sumActions = (actions: Action[] | undefined, types: Set<string>): number =>
  (actions ?? []).reduce((t, a) => (types.has(a.action_type) ? t + Number(a.value || 0) : t), 0)

const actionRevenue = (values: Action[] | undefined, types: Set<string>): number => {
  for (const v of values ?? []) if (types.has(v.action_type)) return Number(v.value || 0)
  return 0
}

const costPerAction = (cpa: Action[] | undefined, type: string): number => {
  for (const c of cpa ?? []) if (c.action_type === type) return Number(c.value || 0)
  return 0
}

/** GET a Graph API url, following `paging.next` until exhausted. Throws on API error. */
async function graphAll<T>(url: string): Promise<T[]> {
  const out: T[] = []
  let next: string | null = url
  let guard = 0
  while (next && guard++ < 50) {
    const res = await fetch(next)
    const body = (await res.json()) as {
      data?: T[]
      paging?: { next?: string }
      error?: { message: string }
    }
    if (body.error) throw new Error(body.error.message)
    if (body.data) out.push(...body.data)
    next = body.paging?.next ?? null
  }
  return out
}

interface MetaCreds {
  appId: string
  appSecret: string
  accessToken: string
  adAccountId: string
}

async function getCreds(projectId: string): Promise<MetaCreds | null> {
  const i = await db.projectIntegration.findUnique({ where: { projectId } })
  if (!i?.metaAccessToken || !i.metaAdAccountId) return null
  const token = tryDecrypt(i.metaAccessToken)
  if (!token) return null
  return {
    appId: i.metaAppId ?? "",
    appSecret: tryDecrypt(i.metaAppSecret) ?? "",
    accessToken: token,
    adAccountId: i.metaAdAccountId,
  }
}

/**
 * Decrypted credentials for pre-filling the Edit form. MANAGER-ONLY (the route is
 * withProjectManager) - these are the raw secrets, so they must never be exposed
 * on the member-accessible dashboard endpoint.
 */
export async function getMetaCredentials(projectId: string): Promise<{
  appId: string
  appSecret: string
  accessToken: string
  adAccountId: string
} | null> {
  const i = await db.projectIntegration.findUnique({ where: { projectId } })
  if (!i) return null
  return {
    appId: i.metaAppId ?? "",
    appSecret: tryDecrypt(i.metaAppSecret) ?? "",
    accessToken: tryDecrypt(i.metaAccessToken) ?? "",
    adAccountId: i.metaAdAccountId ?? "",
  }
}

/** Save (encrypt) the Meta credentials, verify them against the API, set status. */
export async function saveMetaIntegration(
  projectId: string,
  input: { appId: string; appSecret: string; accessToken: string; adAccountId: string },
): Promise<{ ok: boolean; error?: string }> {
  const existing = await db.projectIntegration.findUnique({ where: { projectId } })
  const adAccountId = input.adAccountId.replace(/^act_/, "").trim()

  // Blank secret on an EDIT means "keep the existing one" - the token/secret are
  // never sent back to the client, so a blank field is the user leaving them as-is.
  const accessToken = input.accessToken.trim()
    ? input.accessToken.trim()
    : existing
      ? tryDecrypt(existing.metaAccessToken)
      : null
  if (!accessToken) return { ok: false, error: "Access token is required" }

  // Verify before storing: one cheap campaigns call.
  const test = await fetch(
    `${GRAPH}/act_${adAccountId}/campaigns?fields=id&limit=1&access_token=${encodeURIComponent(accessToken)}`,
  )
  const testBody = (await test.json()) as { error?: { message: string } }
  const connected = !testBody.error
  const err = connected ? null : (testBody.error?.message ?? "Verification failed")

  // App secret: new value encrypts + replaces; blank keeps the stored one.
  const appSecret = input.appSecret.trim() ? encrypt(input.appSecret.trim()) : undefined

  await db.projectIntegration.upsert({
    where: { projectId },
    create: {
      projectId,
      provider: "META",
      metaAppId: input.appId.trim() || null,
      metaAppSecret: appSecret ?? null,
      metaAccessToken: encrypt(accessToken),
      metaAdAccountId: adAccountId,
      status: connected ? "connected" : "pending",
      lastSyncError: err,
    },
    update: {
      metaAppId: input.appId.trim() || null,
      metaAppSecret: appSecret, // undefined = leave existing untouched
      metaAccessToken: encrypt(accessToken),
      metaAdAccountId: adAccountId,
      status: connected ? "connected" : "pending",
      lastSyncError: err,
    },
  })
  return connected ? { ok: true } : { ok: false, error: err ?? undefined }
}

export interface MetaDashboard {
  connected: boolean
  status: string
  adAccountId: string | null
  appId: string | null
  lastSyncedAt: string | null
  lastSyncError: string | null
  totals: {
    spend: number
    impressions: number
    clicks: number
    ctr: number
    purchases: number
    purchaseValue: number
    roas: number
    reach: number
  }
  daily: { date: string; spend: number; purchases: number; purchaseValue: number }[]
  topCampaigns: {
    name: string
    status: string
    spend: number
    impressions: number
    clicks: number
    purchases: number
    purchaseValue: number
    roas: number
  }[]
}

const num = (v: unknown): number => (v == null ? 0 : Number(v))

/**
 * Which slice of the synced metrics the dashboard should aggregate.
 * `from`/`to` are inclusive "yyyy-MM-dd" days and win over `days` when present;
 * an empty object (or nothing) means every day ever synced.
 */
export interface MetaDashboardRange {
  /** Rolling window ending today, e.g. 30 for the last 30 days. */
  days?: number
  from?: string
  to?: string
}

/**
 * "yyyy-MM-dd" -> that day at UTC midnight, which is exactly how a `@db.Date`
 * column stores it. Anything unparseable returns null so a junk query string
 * widens the range rather than producing an Invalid Date that matches nothing.
 */
function parseDay(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * The Prisma date filter for a range, or null for "no filter at all".
 * Both bounds are inclusive: `date` is a DATE column stored at UTC midnight, so
 * `lte` the last day includes that whole day rather than cutting it off.
 */
function metricDateFilter(range?: MetaDashboardRange): { gte?: Date; lte?: Date } | null {
  if (!range) return null

  const from = parseDay(range.from)
  const to = parseDay(range.to)
  if (from || to) {
    // A backwards range (someone picked the end first) is read as the span
    // between the two dates rather than returning nothing.
    if (from && to && from > to) return { gte: to, lte: from }
    return { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) }
  }

  if (range.days && range.days > 0) {
    return {
      gte: new Date(new Date(Date.now() - range.days * 86_400_000).toISOString().slice(0, 10)),
    }
  }
  return null
}

/** Integration status + the aggregated Meta data the dashboard renders. `range`
 *  limits the metrics window (undefined = all synced data). */
export async function getMetaDashboard(
  projectId: string,
  range?: MetaDashboardRange,
): Promise<MetaDashboard> {
  const integration = await db.projectIntegration.findUnique({ where: { projectId } })
  const empty: MetaDashboard = {
    connected: !!integration && integration.status === "connected",
    status: integration?.status ?? "not_connected",
    adAccountId: integration?.metaAdAccountId ?? null,
    appId: integration?.metaAppId ?? null,
    lastSyncedAt: integration?.lastSyncedAt?.toISOString() ?? null,
    lastSyncError: integration?.lastSyncError ?? null,
    totals: {
      spend: 0,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      purchases: 0,
      purchaseValue: 0,
      roas: 0,
      reach: 0,
    },
    daily: [],
    topCampaigns: [],
  }
  if (!integration) return empty

  const dateFilter = metricDateFilter(range)
  const campaigns = await db.metaCampaign.findMany({
    where: { projectId },
    include: { metrics: dateFilter ? { where: { date: dateFilter } } : true },
  })

  const byDay = new Map<string, { spend: number; purchases: number; purchaseValue: number }>()
  let spend = 0,
    impressions = 0,
    clicks = 0,
    purchases = 0,
    purchaseValue = 0,
    reach = 0

  const topCampaigns = campaigns
    .map((c) => {
      let cSpend = 0,
        cImp = 0,
        cClk = 0,
        cPur = 0,
        cPurVal = 0
      for (const m of c.metrics) {
        const s = num(m.spend)
        cSpend += s
        cImp += num(m.impressions)
        cClk += num(m.clicks)
        cPur += m.purchases
        cPurVal += num(m.purchaseValue)
        const key = m.date.toISOString().slice(0, 10)
        const d = byDay.get(key) ?? { spend: 0, purchases: 0, purchaseValue: 0 }
        d.spend += s
        d.purchases += m.purchases
        d.purchaseValue += num(m.purchaseValue)
        byDay.set(key, d)
        reach += num(m.reach)
      }
      spend += cSpend
      impressions += cImp
      clicks += cClk
      purchases += cPur
      purchaseValue += cPurVal
      return {
        name: c.name,
        status: c.status,
        spend: cSpend,
        impressions: cImp,
        clicks: cClk,
        purchases: cPur,
        purchaseValue: cPurVal,
        roas: cSpend > 0 ? cPurVal / cSpend : 0,
      }
    })
    // Drop campaigns with no activity in the window (totals above already counted
    // everything; this just keeps the campaign LIST to what actually ran).
    .filter((c) => c.spend > 0 || c.impressions > 0)
    .sort((a, b) => b.spend - a.spend)

  return {
    ...empty,
    totals: {
      spend,
      impressions,
      clicks,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      purchases,
      purchaseValue,
      roas: spend > 0 ? purchaseValue / spend : 0,
      reach,
    },
    daily: [...byDay.entries()]
      .map(([date, d]) => ({ date, ...d }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    topCampaigns,
  }
}

export async function disconnectMetaIntegration(projectId: string): Promise<void> {
  // Drop the connection + its synced data.
  await db.metaCampaign.deleteMany({ where: { projectId } })
  await db.projectIntegration.delete({ where: { projectId } }).catch(() => {})
}

/**
 * Pull campaigns + daily insights and upsert them. Returns the record count.
 */
export async function syncMetaProject(
  projectId: string,
  lookbackDays = 30,
): Promise<{ records: number; campaigns: number }> {
  const creds = await getCreds(projectId)
  if (!creds) throw new Error("Meta is not connected for this project")

  const acct = `act_${creds.adAccountId}`
  const token = encodeURIComponent(creds.accessToken)

  try {
    // 1. Campaigns -> upsert, build metaCampaignId -> our uuid map.
    const campaigns = await graphAll<{ id: string; name: string; status: string }>(
      `${GRAPH}/${acct}/campaigns?fields=id,name,status&limit=200&access_token=${token}`,
    )
    // Batched, not one await per campaign. The array form of $transaction ships
    // a whole chunk to the engine in a single round trip; the previous shape was
    // one full network round trip per campaign, serialized.
    const idMap = new Map<string, string>()
    for (const slice of chunk(campaigns, WRITE_CHUNK)) {
      const rows = await db.$transaction(
        slice.map((c) =>
          db.metaCampaign.upsert({
            where: { projectId_campaignId: { projectId, campaignId: c.id } },
            create: {
              projectId,
              campaignId: c.id,
              name: c.name,
              status: STATUS_MAP[c.status] ?? "active",
            },
            update: { name: c.name, status: STATUS_MAP[c.status] ?? "active" },
            select: { id: true },
          }),
        ),
      )
      // $transaction preserves input order, so row i belongs to slice[i].
      slice.forEach((c, i) => idMap.set(c.id, rows[i]!.id))
    }

    // 2. Account-level daily insights (one call for every campaign, per day).
    const fields = [
      "campaign_id",
      "spend",
      "impressions",
      "clicks",
      "ctr",
      "cpc",
      "cpm",
      "reach",
      "actions",
      "cost_per_action_type",
      "action_values",
    ].join(",")
    const insights = await graphAll<Record<string, unknown>>(
      `${GRAPH}/${acct}/insights?level=campaign&fields=${fields}&time_increment=1&date_preset=last_${lookbackDays}d&limit=500&access_token=${token}`,
    )

    // Same batching as the campaign loop above. This is the loop the sync
    // actually lives in: campaigns x days, so 100 campaigns over a 30-day
    // lookback was 3,000 sequential round trips.
    const metricWrites: Prisma.PrismaPromise<unknown>[] = []
    for (const day of insights) {
      const metaCampaignId = day.campaign_id as string
      const campaignId = idMap.get(metaCampaignId)
      if (!campaignId) continue // campaign not in our list (deleted mid-window)

      const spend = Number(day.spend || 0)
      const actions = day.actions as Action[] | undefined
      const cpaArr = day.cost_per_action_type as Action[] | undefined
      const values = day.action_values as Action[] | undefined
      const purchaseValue = actionRevenue(values, PURCHASE_TYPES)

      let costPerConversion = 0
      for (const t of ["purchase", "lead", "complete_registration"]) {
        costPerConversion = costPerAction(cpaArr, t)
        if (costPerConversion > 0) break
      }

      metricWrites.push(
        db.metaCampaignMetric.upsert({
          where: { campaignId_date: { campaignId, date: new Date(day.date_start as string) } },
          create: {
            campaignId,
            date: new Date(day.date_start as string),
            spend,
            impressions: BigInt(Math.round(Number(day.impressions || 0))),
            clicks: BigInt(Math.round(Number(day.clicks || 0))),
            ctr: Number(day.ctr || 0),
            cpc: Number(day.cpc || 0),
            cpm: Number(day.cpm || 0),
            reach: BigInt(Math.round(Number(day.reach || 0))),
            conversions: sumActions(actions, CONVERSION_TYPES),
            costPerConversion,
            purchases: sumActions(actions, PURCHASE_TYPES),
            purchaseValue,
            roas: spend > 0 ? purchaseValue / spend : 0,
            addToCart: sumActions(actions, ATC_TYPES),
            landingPageViews: sumActions(actions, new Set(["landing_page_view"])),
            currency: "INR",
          },
          update: {
            spend,
            impressions: BigInt(Math.round(Number(day.impressions || 0))),
            clicks: BigInt(Math.round(Number(day.clicks || 0))),
            ctr: Number(day.ctr || 0),
            cpc: Number(day.cpc || 0),
            cpm: Number(day.cpm || 0),
            reach: BigInt(Math.round(Number(day.reach || 0))),
            conversions: sumActions(actions, CONVERSION_TYPES),
            costPerConversion,
            purchases: sumActions(actions, PURCHASE_TYPES),
            purchaseValue,
            roas: spend > 0 ? purchaseValue / spend : 0,
            addToCart: sumActions(actions, ATC_TYPES),
            landingPageViews: sumActions(actions, new Set(["landing_page_view"])),
          },
        }),
      )
    }

    let records = 0
    for (const slice of chunk(metricWrites, WRITE_CHUNK)) {
      await db.$transaction(slice)
      records += slice.length
    }

    await db.projectIntegration.update({
      where: { projectId },
      data: { status: "connected", lastSyncedAt: new Date(), lastSyncError: null },
    })
    return { records, campaigns: campaigns.length }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await db.projectIntegration
      .update({ where: { projectId }, data: { lastSyncError: msg } })
      .catch(() => {})
    throw new Error(msg)
  }
}
