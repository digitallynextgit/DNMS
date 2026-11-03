import "server-only"

import type { MarketplaceChannel } from "@prisma/client"
import { db } from "@/server/db"
import { encrypt, tryDecrypt } from "@/lib/crypto"
import {
  isCountedOrder,
  isReturningCustomer,
  lineRevenue,
  normalizeShopDomain,
  orderNumbers,
  referrerHost,
  round2,
  salesChannelName,
  shopDay,
  type ShopifyOrderLine,
  type ShopifyOrderNode,
} from "../lib/shopify-orders"
import { metricDateFilter, type MetricRange } from "./metric-range"

// Shopify sync: orders (Admin GraphQL API) into shopify_orders and products into the catalog, per
// project. Stored on the project's SHOPIFY marketplace channel; the token is encrypted there.

const API_VERSION = "2026-10"

/**
 * How far back a full sync reads: 3 years. Shopify serves only the last 60 days of orders unless
 * the store's app has the read_all_orders scope (see servedHistoryDays); days already synced stay
 * in the database after that.
 */
export const SHOPIFY_HISTORY_DAYS = 1095

/** What Shopify serves without read_all_orders. */
const SHOPIFY_DEFAULT_ORDER_DAYS = 60
/** A full sync leaves stored orders this close to the window's start alone (see syncChannel). */
const DELETE_MARGIN_MS = 2 * 86_400_000

/** The scheduled sync re-reads orders changed since the last sync, with this much overlap. */
const RECENT_OVERLAP_MS = 30 * 60_000
/** The sweep skips a channel synced this recently (by hand, or by the other blue/green server). */
const SWEEP_MIN_GAP_MS = 10 * 60_000

const PAGE_SIZE = 100
// Writes per batched $transaction - fewer round trips, but short enough for a 10-connection pool.
const WRITE_CHUNK = 100
const DAY_MS = 86_400_000

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const num = (v: unknown): number => (v == null ? 0 : Number(v))

// ---------------------------------------------------------------------------
// Admin API
// ---------------------------------------------------------------------------

interface ShopifyCreds {
  shopDomain: string
  accessToken: string
}

type GraphqlError = { message: string; extensions?: { code?: string } }

/** A problem Shopify reported. Its message is safe to show; anything else stays in the server log. */
export class ShopifyError extends Error {}

const MAX_ATTEMPTS = 5

/** One Admin GraphQL call. Waits and retries when Shopify throttles; throws on anything else. */
async function shopifyGraphql<T>(
  creds: ShopifyCreds,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    let res: Response
    try {
      res = await fetch(`https://${creds.shopDomain}/admin/api/${API_VERSION}/graphql.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": creds.accessToken,
        },
        body: JSON.stringify({ query, variables }),
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
      })
    } catch {
      throw new ShopifyError(`Couldn't reach ${creds.shopDomain}`)
    }
    if (res.status === 401 || res.status === 403) {
      throw new ShopifyError("Shopify rejected the access token")
    }
    if (res.status === 404)
      throw new ShopifyError(`No Shopify store answers at ${creds.shopDomain}`)
    if ((res.status === 429 || res.status >= 500) && attempt < MAX_ATTEMPTS) {
      await sleep(2_000 * attempt)
      continue
    }
    if (!res.ok) throw new ShopifyError(`Shopify returned HTTP ${res.status}`)

    const body = (await res.json().catch(() => ({}))) as {
      data?: T
      errors?: GraphqlError[] | string
    }
    if (typeof body.errors === "string") throw new ShopifyError(body.errors)
    if (body.errors?.some((e) => e.extensions?.code === "THROTTLED") && attempt < MAX_ATTEMPTS) {
      await sleep(2_000 * attempt)
      continue
    }
    if (body.errors?.length) {
      throw new ShopifyError(body.errors.map((e) => e.message).join("; "))
    }
    if (!body.data) throw new ShopifyError("Shopify returned no data")
    return body.data
  }
}

interface Connection<N> {
  pageInfo: { hasNextPage: boolean; endCursor: string | null }
  nodes: N[]
}

/** Every page of a `$q`-filtered connection query, one page at a time. */
async function* pages<N>(
  creds: ShopifyCreds,
  query: string,
  field: "orders" | "products",
  q: string | null,
): AsyncGenerator<N[]> {
  let after: string | null = null
  for (let guard = 0; guard < 1_000; guard++) {
    const data: Record<string, Connection<N>> = await shopifyGraphql(creds, query, { q, after })
    const conn = data[field]!
    yield conn.nodes
    if (!conn.pageInfo.hasNextPage || !conn.pageInfo.endCursor) return
    after = conn.pageInfo.endCursor
  }
}

const SHOP_QUERY = `{
  shop { name ianaTimezone currencyCode }
  currentAppInstallation { accessScopes { handle } }
}`

const LINE_FIELDS = `quantity sku title variantTitle
  originalUnitPriceSet { shopMoney { amount } }
  variant { legacyResourceId }
  product { legacyResourceId }`

// Timestamps in $q must be quoted: an unquoted "+05:30" is read as a space.
const ORDERS_QUERY = `query Orders($q: String, $after: String) {
  orders(first: ${PAGE_SIZE}, after: $after, query: $q, sortKey: CREATED_AT) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id legacyResourceId createdAt test cancelledAt
      displayFinancialStatus displayFulfillmentStatus sourceName app { name }
      totalDiscountsSet { shopMoney { amount } }
      totalTaxSet { shopMoney { amount } }
      totalShippingPriceSet { shopMoney { amount } }
      shippingAddress { province }
      customerJourneySummary { customerOrderIndex lastVisit { referrerUrl } }
      refunds(first: 10) { refundLineItems(first: 20) { nodes { subtotalSet { shopMoney { amount } } } } }
      lineItems(first: 50) {
        pageInfo { hasNextPage endCursor }
        nodes { ${LINE_FIELDS} }
      }
    }
  }
}`

/** The rest of an order with more lines than ORDERS_QUERY carries. */
const ORDER_LINES_QUERY = `query OrderLines($id: ID!, $after: String) {
  order(id: $id) {
    lineItems(first: 100, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes { ${LINE_FIELDS} }
    }
  }
}`

const PRODUCTS_QUERY = `query Products($q: String, $after: String) {
  products(first: ${PAGE_SIZE}, after: $after, query: $q) {
    pageInfo { hasNextPage endCursor }
    nodes {
      legacyResourceId title status vendor productType tags onlineStoreUrl totalInventory
      description(truncateAt: 2000)
      featuredMedia { preview { image { url } } }
      variants(first: 1) { nodes { sku price compareAtPrice } }
    }
  }
}`

interface ShopInfo {
  name: string
  timeZone: string
  currency: string
  scopes: string[]
}

async function fetchShop(creds: ShopifyCreds): Promise<ShopInfo> {
  const data = await shopifyGraphql<{
    shop: { name: string; ianaTimezone: string; currencyCode: string }
    currentAppInstallation: { accessScopes: { handle: string }[] } | null
  }>(creds, SHOP_QUERY)
  return {
    name: data.shop.name,
    timeZone: data.shop.ianaTimezone,
    currency: data.shop.currencyCode,
    scopes: data.currentAppInstallation?.accessScopes.map((s) => s.handle) ?? [],
  }
}

interface ProductNode {
  legacyResourceId: string
  title: string
  status: string
  vendor: string | null
  productType: string | null
  tags: string[]
  onlineStoreUrl: string | null
  totalInventory: number | null
  description: string | null
  featuredMedia: { preview: { image: { url: string } | null } | null } | null
  variants: { nodes: { sku: string | null; price: string; compareAtPrice: string | null }[] }
}

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

type ChannelRow = Pick<
  MarketplaceChannel,
  "id" | "projectId" | "externalId" | "credentials" | "lastSyncedAt"
>

function credsOf(channel: Pick<ChannelRow, "externalId" | "credentials">): ShopifyCreds | null {
  const raw = tryDecrypt(channel.credentials)
  if (!raw || !channel.externalId) return null
  try {
    const { accessToken } = JSON.parse(raw) as { accessToken?: string }
    return accessToken ? { shopDomain: channel.externalId, accessToken } : null
  } catch {
    return null
  }
}

/** The project's Shopify store. One per project for now; the model allows more. */
function findChannel(projectId: string) {
  return db.marketplaceChannel.findFirst({
    where: { projectId, provider: "SHOPIFY" },
    orderBy: { createdAt: "asc" },
  })
}

/** Decrypted token for the Edit form. Manager-only route - never expose on the member dashboard. */
export async function getShopifyCredentials(
  projectId: string,
): Promise<{ storeDomain: string; accessToken: string } | null> {
  const channel = await findChannel(projectId)
  if (!channel) return null
  return {
    storeDomain: channel.externalId ?? "",
    accessToken: credsOf(channel)?.accessToken ?? "",
  }
}

/** Save (encrypt) the store + token, verify them against Shopify, set status. */
export async function saveShopifyIntegration(
  projectId: string,
  input: { storeDomain: string; accessToken: string },
): Promise<{ ok: boolean; error?: string; historyDays?: number }> {
  const shopDomain = normalizeShopDomain(input.storeDomain)
  if (!shopDomain) {
    return {
      ok: false,
      error: "Enter the store's .myshopify.com address (Shopify admin -> Settings -> Domains).",
    }
  }

  const existing = await findChannel(projectId)
  // Blank token on an edit = keep the stored one (secrets are never sent back to the client).
  const accessToken =
    input.accessToken.trim() || (existing ? credsOf(existing)?.accessToken : null) || null
  if (!accessToken) return { ok: false, error: "Access token is required" }

  let shop: ShopInfo | null = null
  let err: string | null = null
  try {
    shop = await fetchShop({ shopDomain, accessToken })
    if (shop.scopes.length > 0 && !shop.scopes.includes("read_orders")) {
      err = "This token can't read orders. Give the Shopify app the read_orders scope."
    }
  } catch (e) {
    err = e instanceof Error ? e.message : "Verification failed"
  }

  const data = {
    name: shop?.name ?? shopDomain,
    externalId: shopDomain,
    credentials: encrypt(JSON.stringify({ accessToken })),
    status: err ? "pending" : "connected",
    lastSyncError: err,
  }

  if (existing) {
    // Another store's numbers must not mix with this one's.
    if (existing.externalId && existing.externalId !== shopDomain) {
      await db.shopifyOrder.deleteMany({ where: { channelId: existing.id } })
      await db.product.deleteMany({ where: { channelId: existing.id } })
      await db.marketplaceChannel.update({
        where: { id: existing.id },
        data: { ...data, lastSyncedAt: null },
      })
    } else {
      await db.marketplaceChannel.update({ where: { id: existing.id }, data })
    }
  } else {
    await db.marketplaceChannel.create({ data: { projectId, provider: "SHOPIFY", ...data } })
  }
  return err
    ? { ok: false, error: err }
    : { ok: true, historyDays: servedHistoryDays(shop!.scopes) }
}

/** Removes the store, its synced orders and the products it brought in. */
export async function disconnectShopify(projectId: string): Promise<void> {
  const channel = await findChannel(projectId)
  if (!channel) return
  await db.product.deleteMany({ where: { channelId: channel.id } })
  // Orders and their lines go with the channel (cascade).
  await db.marketplaceChannel.delete({ where: { id: channel.id } })
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

export interface ShopifySyncResult {
  orders: number
  products: number
  /** True when the whole history window was read, not just recent changes. */
  full: boolean
  /** Days of orders this token can read: 60, or SHOPIFY_HISTORY_DAYS with read_all_orders. */
  historyDays: number
}

/** "Sync now": re-reads the whole window, so it also picks up anything a scheduled run missed. */
export async function syncShopifyProject(projectId: string): Promise<ShopifySyncResult> {
  const channel = await findChannel(projectId)
  if (!channel) throw new Error("Shopify is not connected for this project")
  return syncChannel(channel, true)
}

/** The 15-minute job: every connected store, orders changed since its last sync. */
export async function runShopifySweep(): Promise<{
  synced: number
  failed: number
  skipped: number
  orders: number
}> {
  const channels = await db.marketplaceChannel.findMany({
    where: { provider: "SHOPIFY", status: "connected" },
  })
  const result = { synced: 0, failed: 0, skipped: 0, orders: 0 }
  for (const channel of channels) {
    if (channel.lastSyncedAt && Date.now() - channel.lastSyncedAt.getTime() < SWEEP_MIN_GAP_MS) {
      result.skipped++
      continue
    }
    try {
      const r = await syncChannel(channel, false)
      result.synced++
      result.orders += r.orders
    } catch (e) {
      // Recorded on the channel by syncChannel; one store failing must not stop the others.
      result.failed++
      console.error(`[SHOPIFY_SWEEP] ${channel.externalId}:`, e)
    }
  }
  return result
}

/**
 * Days of orders Shopify actually hands this token: older ones need the read_all_orders scope.
 * Matters beyond the query - the full sync deletes stored orders it didn't see inside this window,
 * so raising SHOPIFY_HISTORY_DAYS without the scope must not wipe history already synced.
 */
export function servedHistoryDays(scopes: string[]): number {
  return scopes.includes("read_all_orders")
    ? SHOPIFY_HISTORY_DAYS
    : Math.min(SHOPIFY_HISTORY_DAYS, SHOPIFY_DEFAULT_ORDER_DAYS)
}

async function syncChannel(channel: ChannelRow, full: boolean): Promise<ShopifySyncResult> {
  const creds = credsOf(channel)
  if (!creds) throw new Error("Shopify is not connected for this project")

  const startedAt = new Date()
  // The first sync reads the whole window; after that only what changed (a refund, a fulfilment).
  const readAll = full || !channel.lastSyncedAt

  try {
    const shop = await fetchShop(creds)
    const historyStart = new Date(startedAt.getTime() - servedHistoryDays(shop.scopes) * DAY_MS)
    const since = readAll
      ? historyStart
      : new Date(channel.lastSyncedAt!.getTime() - RECENT_OVERLAP_MS)

    let orders = 0
    const orderFilter = `${readAll ? "created_at" : "updated_at"}:>='${since.toISOString()}'`
    for await (const nodes of pages<ShopifyOrderNode>(creds, ORDERS_QUERY, "orders", orderFilter)) {
      await completeLineItems(creds, nodes)
      orders += await writeOrders(channel, nodes, shop)
    }
    if (readAll) {
      // Orders deleted in Shopify: inside the window, but not re-written by this run. The margin
      // keeps orders at the window's edge, which Shopify may already have stopped returning.
      await db.shopifyOrder.deleteMany({
        where: {
          channelId: channel.id,
          placedAt: { gte: new Date(historyStart.getTime() + DELETE_MARGIN_MS) },
          updatedAt: { lt: startedAt },
        },
      })
    }

    let products = 0
    const productFilter = readAll ? null : `updated_at:>='${since.toISOString()}'`
    for await (const nodes of pages<ProductNode>(
      creds,
      PRODUCTS_QUERY,
      "products",
      productFilter,
    )) {
      products += await writeProducts(channel, nodes, shop)
    }

    await db.marketplaceChannel.update({
      where: { id: channel.id },
      data: { status: "connected", lastSyncedAt: startedAt, lastSyncError: null },
    })
    return { orders, products, full: readAll, historyDays: servedHistoryDays(shop.scopes) }
  } catch (e) {
    // Everyone on the project sees lastSyncError: Shopify's own words are fine, a database
    // error (table names, file paths) is not.
    const msg =
      e instanceof ShopifyError
        ? e.message
        : "The sync failed while saving. The details are in the server log."
    if (!(e instanceof ShopifyError)) console.error(`[SHOPIFY_SYNC] ${channel.externalId}:`, e)
    await db.marketplaceChannel
      .update({ where: { id: channel.id }, data: { lastSyncError: msg } })
      .catch(() => {})
    throw new Error(msg)
  }
}

/** Fetches the lines past the first page for any order that has more. */
async function completeLineItems(creds: ShopifyCreds, orders: ShopifyOrderNode[]): Promise<void> {
  for (const o of orders) {
    let page = o.lineItems.pageInfo
    for (let guard = 0; o.id && page?.hasNextPage && page.endCursor && guard < 100; guard++) {
      const data: {
        order: { lineItems: Connection<ShopifyOrderLine> } | null
      } = await shopifyGraphql(creds, ORDER_LINES_QUERY, { id: o.id, after: page.endCursor })
      if (!data.order) break
      o.lineItems.nodes.push(...data.order.lineItems.nodes)
      page = data.order.lineItems.pageInfo
    }
  }
}

async function writeOrders(
  channel: ChannelRow,
  nodes: ShopifyOrderNode[],
  shop: ShopInfo,
): Promise<number> {
  const real = nodes.filter((o) => !o.test)
  for (const slice of chunk(real, WRITE_CHUNK)) {
    const rows = await db.$transaction(
      slice.map((o) => {
        const data = {
          placedAt: new Date(o.createdAt),
          date: new Date(`${shopDay(o.createdAt, shop.timeZone)}T00:00:00.000Z`),
          financialStatus: o.displayFinancialStatus ?? "UNKNOWN",
          fulfillmentStatus: o.displayFulfillmentStatus,
          cancelled: !!o.cancelledAt,
          counted: isCountedOrder(o),
          salesChannel: salesChannelName(o),
          referrer: referrerHost(o.customerJourneySummary?.lastVisit?.referrerUrl),
          state: o.shippingAddress?.province || null,
          returningCustomer: isReturningCustomer(o),
          ...orderNumbers(o),
          currency: shop.currency,
        }
        return db.shopifyOrder.upsert({
          where: { channelId_orderId: { channelId: channel.id, orderId: o.legacyResourceId } },
          create: {
            projectId: channel.projectId,
            channelId: channel.id,
            orderId: o.legacyResourceId,
            ...data,
          },
          update: data,
          select: { id: true },
        })
      }),
    )
    // Lines are replaced wholesale: an edited order can gain or lose items.
    // $transaction preserves input order, so row i belongs to slice[i].
    const lineWrites = slice.flatMap((o, i) =>
      o.lineItems.nodes.map((li) =>
        db.shopifyOrderLine.create({
          data: {
            orderId: rows[i]!.id,
            variantId: li.variant?.legacyResourceId ?? null,
            productId: li.product?.legacyResourceId ?? null,
            title: li.title,
            variantTitle: li.variantTitle || null,
            sku: li.sku || null,
            quantity: li.quantity,
            revenue: lineRevenue(li),
          },
        }),
      ),
    )
    // Locked per store: two syncs at once (Sync now during the 15-minute run, or both blue/green
    // servers) would each delete then insert, leaving every line twice. The lock is released when
    // the transaction ends, so the second waits, then deletes the first's lines and writes its own.
    await db.$transaction([
      db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`shopify-lines:${channel.id}`}))`,
      db.shopifyOrderLine.deleteMany({ where: { orderId: { in: rows.map((r) => r.id) } } }),
      ...lineWrites,
    ])
  }
  return real.length
}

async function writeProducts(
  channel: ChannelRow,
  nodes: ProductNode[],
  shop: ShopInfo,
): Promise<number> {
  for (const slice of chunk(nodes, WRITE_CHUNK)) {
    await db.$transaction(
      slice.map((p) => {
        const v = p.variants.nodes[0]
        const data = {
          title: p.title,
          sku: v?.sku || null,
          description: p.description || null,
          imageUrl: p.featuredMedia?.preview?.image?.url ?? null,
          vendor: p.vendor || null,
          category: p.productType || null,
          price: v ? Number(v.price) : null,
          compareAtPrice: v?.compareAtPrice ? Number(v.compareAtPrice) : null,
          currency: shop.currency,
          inventoryQty: p.totalInventory,
          status: p.status.toLowerCase(),
          tags: p.tags,
          url: p.onlineStoreUrl,
          lastSyncedAt: new Date(),
        }
        return db.product.upsert({
          where: {
            channelId_externalId: { channelId: channel.id, externalId: p.legacyResourceId },
          },
          create: {
            projectId: channel.projectId,
            channelId: channel.id,
            externalId: p.legacyResourceId,
            ...data,
          },
          update: data,
          select: { id: true },
        })
      }),
    )
  }
  return nodes.length
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface ShopifyTotals {
  totalSales: number
  netSales: number
  grossSales: number
  discounts: number
  returns: number
  shipping: number
  taxes: number
  orders: number
  unitsSold: number
  /** (gross - discounts) / orders, as Shopify reports it. */
  aov: number
  fulfilledOrders: number
  newCustomerOrders: number
  returningCustomerOrders: number
}

export interface ShopifyBreakdownRow {
  key: string
  orders: number
  sales: number
}

export interface ShopifyDashboard {
  connected: boolean
  status: string
  storeDomain: string | null
  shopName: string | null
  lastSyncedAt: string | null
  lastSyncError: string | null
  /** How many days back Shopify lets a sync read. */
  historyDays: number
  totals: ShopifyTotals
  /** The same totals for the equally long span just before; null for "all time". */
  previous: Pick<ShopifyTotals, "totalSales" | "orders" | "aov" | "unitsSold"> | null
  daily: { date: string; totalSales: number; orders: number }[]
  byChannel: ShopifyBreakdownRow[]
  byReferrer: ShopifyBreakdownRow[]
  byState: ShopifyBreakdownRow[]
  topProducts: {
    key: string
    title: string
    variantTitle: string | null
    sku: string | null
    orders: number
    units: number
    revenue: number
    /** % of all product revenue in the range. */
    share: number
  }[]
  /** Meta Ads spend over the same days (null when Meta isn't connected), for blended ROAS. */
  metaSpend: number | null
}

const EMPTY_TOTALS: ShopifyTotals = {
  totalSales: 0,
  netSales: 0,
  grossSales: 0,
  discounts: 0,
  returns: 0,
  shipping: 0,
  taxes: 0,
  orders: 0,
  unitsSold: 0,
  aov: 0,
  fulfilledOrders: 0,
  newCustomerOrders: 0,
  returningCustomerOrders: 0,
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10)

/** Every day from `from` to `to`, zeros where nothing sold, so the chart doesn't skip gaps. */
function fillDays(
  byDay: Map<string, { totalSales: number; orders: number }>,
  from: Date | undefined,
  to: Date,
): ShopifyDashboard["daily"] {
  const first = from ?? [...byDay.keys()].sort().map((k) => new Date(`${k}T00:00:00.000Z`))[0]
  if (!first) return []
  const out: ShopifyDashboard["daily"] = []
  for (let t = first.getTime(), guard = 0; t <= to.getTime() && guard < 4_000; t += DAY_MS) {
    guard++
    const date = dayKey(new Date(t))
    const d = byDay.get(date)
    out.push({ date, totalSales: round2(d?.totalSales ?? 0), orders: d?.orders ?? 0 })
  }
  return out
}

function breakdown<T>(
  rows: T[],
  keyOf: (r: T) => string,
  salesOf: (r: T) => number,
): ShopifyBreakdownRow[] {
  const map = new Map<string, ShopifyBreakdownRow>()
  for (const r of rows) {
    const key = keyOf(r)
    const b = map.get(key) ?? { key, orders: 0, sales: 0 }
    b.orders++
    b.sales += salesOf(r)
    map.set(key, b)
  }
  return [...map.values()]
    .map((b) => ({ ...b, sales: round2(b.sales) }))
    .sort((a, b) => b.sales - a.sales)
}

export async function getShopifyDashboard(
  projectId: string,
  range?: MetricRange,
): Promise<ShopifyDashboard> {
  const channel = await findChannel(projectId)
  const empty: ShopifyDashboard = {
    connected: !!channel && channel.status === "connected",
    status: channel?.status ?? "not_connected",
    storeDomain: channel?.externalId ?? null,
    shopName: channel?.name ?? null,
    lastSyncedAt: channel?.lastSyncedAt?.toISOString() ?? null,
    lastSyncError: channel?.lastSyncError ?? null,
    historyDays: SHOPIFY_HISTORY_DAYS,
    totals: EMPTY_TOTALS,
    previous: null,
    daily: [],
    byChannel: [],
    byReferrer: [],
    byState: [],
    topProducts: [],
    metaSpend: null,
  }
  if (!channel) return empty

  const dateFilter = metricDateFilter(range)
  const dateWhere = dateFilter ? { date: dateFilter } : {}

  const [orders, lines, meta, firstOrder] = await Promise.all([
    db.shopifyOrder.findMany({
      where: { channelId: channel.id, counted: true, ...dateWhere },
      select: {
        date: true,
        fulfillmentStatus: true,
        salesChannel: true,
        referrer: true,
        state: true,
        returningCustomer: true,
        grossSales: true,
        discounts: true,
        returns: true,
        netSales: true,
        shipping: true,
        taxes: true,
        totalSales: true,
        unitsSold: true,
      },
    }),
    db.shopifyOrderLine.findMany({
      where: { order: { channelId: channel.id, counted: true, ...dateWhere } },
      select: {
        orderId: true,
        variantId: true,
        productId: true,
        title: true,
        variantTitle: true,
        sku: true,
        quantity: true,
        revenue: true,
      },
    }),
    db.projectIntegration.findUnique({ where: { projectId }, select: { status: true } }),
    db.shopifyOrder.findFirst({
      where: { channelId: channel.id },
      orderBy: { date: "asc" },
      select: { date: true },
    }),
  ])

  const t = { ...EMPTY_TOTALS }
  const byDay = new Map<string, { totalSales: number; orders: number }>()
  for (const o of orders) {
    const total = num(o.totalSales)
    t.totalSales += total
    t.netSales += num(o.netSales)
    t.grossSales += num(o.grossSales)
    t.discounts += num(o.discounts)
    t.returns += num(o.returns)
    t.shipping += num(o.shipping)
    t.taxes += num(o.taxes)
    t.unitsSold += o.unitsSold
    t.orders++
    if (o.fulfillmentStatus === "FULFILLED") t.fulfilledOrders++
    if (o.returningCustomer === true) t.returningCustomerOrders++
    if (o.returningCustomer === false) t.newCustomerOrders++
    const key = dayKey(o.date)
    const d = byDay.get(key) ?? { totalSales: 0, orders: 0 }
    d.totalSales += total
    d.orders++
    byDay.set(key, d)
  }
  t.aov = t.orders > 0 ? (t.grossSales - t.discounts) / t.orders : 0
  for (const k of Object.keys(t) as (keyof ShopifyTotals)[]) t[k] = round2(t[k])

  // Products: one row per variant, its order count being the orders it appeared in.
  const products = new Map<
    string,
    ShopifyDashboard["topProducts"][number] & { orderIds: Set<string> }
  >()
  let productRevenue = 0
  for (const li of lines) {
    const key = li.variantId ?? li.productId ?? li.title
    const p = products.get(key) ?? {
      key,
      title: li.title,
      variantTitle: li.variantTitle,
      sku: li.sku,
      orders: 0,
      units: 0,
      revenue: 0,
      share: 0,
      orderIds: new Set<string>(),
    }
    p.orderIds.add(li.orderId)
    p.units += li.quantity
    p.revenue += num(li.revenue)
    productRevenue += num(li.revenue)
    products.set(key, p)
  }
  const topProducts = [...products.values()]
    .map(({ orderIds, ...p }) => ({
      ...p,
      orders: orderIds.size,
      revenue: round2(p.revenue),
      share: productRevenue > 0 ? round2((p.revenue / productRevenue) * 100) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)

  const today = new Date(`${dayKey(new Date())}T00:00:00.000Z`)
  // Orders are dated by the shop's clock, which in India runs ahead of UTC: until 05:30 UTC the
  // shop's "today" is UTC's tomorrow, and the chart must still reach it.
  const lastSold = [...byDay.keys()].sort().at(-1)
  const chartEnd =
    lastSold && lastSold > dayKey(today) ? new Date(`${lastSold}T00:00:00.000Z`) : today
  const previous = dateFilter?.gte
    ? await previousTotals(channel.id, dateFilter.gte, dateFilter.lte ?? today)
    : null

  let metaSpend: number | null = null
  if (meta) {
    const spend = await db.metaCampaignMetric.aggregate({
      where: { campaign: { projectId }, ...dateWhere },
      _sum: { spend: true },
    })
    metaSpend = round2(num(spend._sum.spend))
  }

  return {
    ...empty,
    totals: t,
    previous,
    // From no earlier than the first synced order to no later than today: days outside say
    // nothing (a 1900-2100 range would otherwise be thousands of empty days).
    daily: fillDays(
      byDay,
      dateFilter?.gte && firstOrder && dateFilter.gte < firstOrder.date
        ? firstOrder.date
        : dateFilter?.gte,
      dateFilter?.lte && dateFilter.lte < chartEnd ? dateFilter.lte : chartEnd,
    ),
    byChannel: breakdown(
      orders,
      (o) => o.salesChannel,
      (o) => num(o.totalSales),
    ),
    byReferrer: breakdown(
      orders,
      (o) => o.referrer,
      (o) => num(o.totalSales),
    ),
    byState: breakdown(
      orders,
      (o) => o.state ?? "Unknown",
      (o) => num(o.totalSales),
    ),
    topProducts,
    metaSpend,
  }
}

/** Totals for the span of the same length that ends the day before `from`. */
async function previousTotals(
  channelId: string,
  from: Date,
  to: Date,
): Promise<ShopifyDashboard["previous"]> {
  const span = to.getTime() - from.getTime() + DAY_MS
  const agg = await db.shopifyOrder.aggregate({
    where: {
      channelId,
      counted: true,
      date: { gte: new Date(from.getTime() - span), lte: new Date(from.getTime() - DAY_MS) },
    },
    _sum: { totalSales: true, grossSales: true, discounts: true, unitsSold: true },
    _count: { _all: true },
  })
  const orders = agg._count._all
  return {
    totalSales: round2(num(agg._sum.totalSales)),
    orders,
    aov: orders > 0 ? round2((num(agg._sum.grossSales) - num(agg._sum.discounts)) / orders) : 0,
    unitsSold: num(agg._sum.unitsSold),
  }
}
