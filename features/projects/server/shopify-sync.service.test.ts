import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

// "Encryption" that is easy to see through in assertions.
vi.mock("@/lib/crypto", () => ({
  encrypt: (s: string) => `enc:${s}`,
  tryDecrypt: (s: string | null | undefined) => (s?.startsWith("enc:") ? s.slice(4) : null),
}))

// --- In-memory stand-in for the Prisma calls the service makes ---------------------------------

type Channel = {
  id: string
  projectId: string
  provider: string
  name: string
  externalId: string | null
  credentials: string | null
  status: string
  lastSyncedAt: Date | null
  lastSyncError: string | null
}

const state = {
  channel: null as Channel | null,
  orders: new Map<string, { id: string; data: Record<string, unknown> }>(),
  lines: [] as { orderId: string; quantity: number; revenue: number; sku: string | null }[],
  /** Every call, in order, as "model.op". */
  calls: [] as string[],
  orderDeletes: [] as unknown[],
  failOrderWrite: false,
}

const call = <T>(name: string, value: T) => {
  state.calls.push(name)
  return Promise.resolve(value)
}

/** Like a PrismaPromise: nothing runs until it is awaited, so $transaction controls the order. */
function lazy<T>(run: () => Promise<T>): Promise<T> {
  let started: Promise<T> | null = null
  const start = () => (started ??= run())
  return {
    then: (ok, fail) => start().then(ok, fail),
    catch: (fail) => start().catch(fail),
    finally: (done) => start().finally(done),
    [Symbol.toStringTag]: "Promise",
  } as Promise<T>
}

/** Wraps a fake so each call returns a lazy promise. */
function deferred<A extends unknown[], T>(fn: (...args: A) => Promise<T>) {
  return (...args: A) => lazy(() => fn(...args))
}

vi.mock("@/server/db", () => ({
  db: {
    // In array order, one after another - what Prisma does inside a transaction.
    $transaction: async (ops: PromiseLike<unknown>[]) => {
      const out: unknown[] = []
      for (const op of ops) out.push(await op)
      return out
    },
    $executeRaw: (strings: TemplateStringsArray, ...values: unknown[]) =>
      lazy(() => call(`lock:${strings.join("?")}:${values.join(",")}`, 1)),
    marketplaceChannel: {
      findFirst: deferred(() => call("channel.findFirst", state.channel)),
      findMany: deferred(() => call("channel.findMany", state.channel ? [state.channel] : [])),
      create: deferred(({ data }: { data: Partial<Channel> }) => {
        state.channel = { id: "ch1", lastSyncedAt: null, lastSyncError: null, ...data } as Channel
        return call("channel.create", state.channel)
      }),
      update: deferred(({ data }: { data: Partial<Channel> }) => {
        const set = Object.entries(data).filter(([, v]) => v !== undefined)
        Object.assign(state.channel!, Object.fromEntries(set))
        return call("channel.update", state.channel)
      }),
      delete: deferred(() => {
        state.channel = null
        return call("channel.delete", null)
      }),
    },
    shopifyOrder: {
      upsert: deferred(
        ({
          where,
          create,
        }: {
          where: { channelId_orderId: { orderId: string } }
          create: Record<string, unknown>
        }) => {
          if (state.failOrderWrite) {
            return Promise.reject(
              new Error(
                'Invalid `db.shopifyOrder.upsert()` invocation in C:\\secret\\path: table "public.shopify_orders" does not exist',
              ),
            )
          }
          const key = where.channelId_orderId.orderId
          const row = state.orders.get(key) ?? { id: `row-${key}`, data: create }
          row.data = create
          state.orders.set(key, row)
          return call("order.upsert", { id: row.id })
        },
      ),
      deleteMany: deferred((args: unknown) => {
        state.orderDeletes.push(args)
        return call("order.deleteMany", { count: 0 })
      }),
    },
    shopifyOrderLine: {
      create: deferred(({ data }: { data: (typeof state.lines)[number] }) => {
        state.lines.push(data)
        return call("line.create", data)
      }),
      deleteMany: deferred(({ where }: { where: { orderId: { in: string[] } } }) => {
        state.lines = state.lines.filter((l) => !where.orderId.in.includes(l.orderId))
        return call("line.deleteMany", { count: 0 })
      }),
    },
    product: {
      upsert: deferred(() => call("product.upsert", { id: "p" })),
      deleteMany: deferred(() => call("product.deleteMany", { count: 0 })),
    },
  },
}))

import {
  disconnectShopify,
  saveShopifyIntegration,
  servedHistoryDays,
  syncShopifyProject,
  SHOPIFY_HISTORY_DAYS,
} from "./shopify-sync.service"

// --- A fake Shopify ----------------------------------------------------------------------------

const money = (amount: number) => ({ shopMoney: { amount: String(amount) } })
const line = (sku: string, price: number, quantity = 1) => ({
  quantity,
  sku,
  title: `Product ${sku}`,
  variantTitle: null,
  originalUnitPriceSet: money(price),
  variant: { legacyResourceId: `v-${sku}` },
  product: { legacyResourceId: `p-${sku}` },
})

function order(id: string, over: Record<string, unknown> = {}) {
  return {
    id: `gid://shopify/Order/${id}`,
    legacyResourceId: id,
    createdAt: "2026-10-30T06:00:00Z",
    test: false,
    cancelledAt: null,
    displayFinancialStatus: "PAID",
    displayFulfillmentStatus: "FULFILLED",
    sourceName: "web",
    app: { name: "Online Store" },
    totalDiscountsSet: money(0),
    totalTaxSet: money(0),
    totalShippingPriceSet: money(0),
    shippingAddress: { province: "Delhi" },
    customerJourneySummary: { customerOrderIndex: 1, lastVisit: null },
    refunds: [],
    lineItems: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [line("A", 100)] },
    ...over,
  }
}

const SHOP = {
  shop: { name: "Test Store", ianaTimezone: "Asia/Kolkata", currencyCode: "INR" },
  currentAppInstallation: {
    accessScopes: [{ handle: "read_orders" }, { handle: "read_products" }],
  },
}

type Reply = { status?: number; body?: unknown }
let shopify: (query: string, variables: Record<string, unknown>) => Reply
const requests: {
  url: string
  token: string | null
  query: string
  variables: Record<string, unknown>
}[] = []

function emptyProducts(): Reply {
  return {
    body: { data: { products: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] } } },
  }
}

beforeEach(() => {
  state.channel = null
  state.orders.clear()
  state.lines = []
  state.calls = []
  state.orderDeletes = []
  state.failOrderWrite = false
  requests.length = 0
  shopify = (query) => {
    if (query.includes("shop {")) return { body: { data: SHOP } }
    if (query.includes("products(")) return emptyProducts()
    return {
      body: { data: { orders: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] } } },
    }
  }
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const { query, variables } = JSON.parse(String(init.body)) as {
        query: string
        variables: Record<string, unknown>
      }
      const headers = init.headers as Record<string, string>
      requests.push({ url, token: headers["X-Shopify-Access-Token"] ?? null, query, variables })
      const r = shopify(query, variables)
      return new Response(JSON.stringify(r.body ?? {}), { status: r.status ?? 200 })
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function connected(over: Partial<Channel> = {}) {
  state.channel = {
    id: "ch1",
    projectId: "proj1",
    provider: "SHOPIFY",
    name: "Test Store",
    externalId: "test-store.myshopify.com",
    credentials: "enc:" + JSON.stringify({ accessToken: "shpat_old" }),
    status: "connected",
    lastSyncedAt: null,
    lastSyncError: null,
    ...over,
  }
}

// --- Tests -------------------------------------------------------------------------------------

describe("saveShopifyIntegration", () => {
  it("only ever calls a .myshopify.com host (no requests to an address someone typed)", async () => {
    for (const bad of [
      "h2s.co.in",
      "evil.com/x.myshopify.com",
      "a.myshopify.com.evil.com",
      "a.myshopify.com@evil.com",
      "localhost:8080",
      "169.254.169.254",
      "http://a.myshopify.com:8080",
    ]) {
      const r = await saveShopifyIntegration("proj1", { storeDomain: bad, accessToken: "t" })
      expect(r.ok, bad).toBe(false)
    }
    // The port form is the one that normalizes - and only to the bare store host.
    const hosts = requests.map((r) => new URL(r.url).host)
    expect(hosts.every((h) => /^[a-z0-9-]+\.myshopify\.com$/.test(h))).toBe(true)
  })

  it("needs a token on first connect", async () => {
    const r = await saveShopifyIntegration("proj1", { storeDomain: "test-store", accessToken: " " })
    expect(r).toEqual({ ok: false, error: "Access token is required" })
    expect(requests).toHaveLength(0)
  })

  it("verifies the token with Shopify, then stores it encrypted", async () => {
    const r = await saveShopifyIntegration("proj1", {
      storeDomain: "https://Test-Store.myshopify.com/admin",
      accessToken: " shpat_new ",
    })
    expect(r).toEqual({ ok: true })
    expect(requests[0]!.url).toBe("https://test-store.myshopify.com/admin/api/2026-10/graphql.json")
    expect(requests[0]!.token).toBe("shpat_new")
    expect(state.channel).toMatchObject({
      provider: "SHOPIFY",
      name: "Test Store",
      externalId: "test-store.myshopify.com",
      credentials: 'enc:{"accessToken":"shpat_new"}',
      status: "connected",
      lastSyncError: null,
    })
  })

  it("saves a rejected token as pending, with Shopify's reason", async () => {
    shopify = () => ({ status: 401, body: { errors: "[API] Invalid API key or access token" } })
    const r = await saveShopifyIntegration("proj1", {
      storeDomain: "test-store",
      accessToken: "bad",
    })
    expect(r).toEqual({ ok: false, error: "Shopify rejected the access token" })
    expect(state.channel?.status).toBe("pending")
  })

  it("refuses a token that can't read orders", async () => {
    shopify = () => ({
      body: {
        data: { ...SHOP, currentAppInstallation: { accessScopes: [{ handle: "read_products" }] } },
      },
    })
    const r = await saveShopifyIntegration("proj1", { storeDomain: "test-store", accessToken: "t" })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/read_orders/)
    expect(state.channel?.status).toBe("pending")
  })

  it("keeps the stored token when an edit leaves it blank", async () => {
    connected()
    const r = await saveShopifyIntegration("proj1", {
      storeDomain: "test-store.myshopify.com",
      accessToken: "",
    })
    expect(r.ok).toBe(true)
    expect(requests[0]!.token).toBe("shpat_old")
    expect(state.calls).not.toContain("order.deleteMany")
  })

  it("wipes the old store's orders and products when switched to another store", async () => {
    connected({ lastSyncedAt: new Date() })
    await saveShopifyIntegration("proj1", { storeDomain: "other-store", accessToken: "t2" })
    expect(state.calls).toContain("order.deleteMany")
    expect(state.calls).toContain("product.deleteMany")
    expect(state.channel?.externalId).toBe("other-store.myshopify.com")
    expect(state.channel?.lastSyncedAt).toBeNull()
  })
})

describe("syncShopifyProject", () => {
  it("refuses when nothing is connected", async () => {
    await expect(syncShopifyProject("proj1")).rejects.toThrow(/not connected/)
  })

  it("reads every page, skips test orders and dates orders by the shop's clock", async () => {
    connected()
    shopify = (query, variables) => {
      if (query.includes("shop {")) return { body: { data: SHOP } }
      if (query.includes("products(")) return emptyProducts()
      const first = !variables.after
      return {
        body: {
          data: {
            orders: {
              pageInfo: { hasNextPage: first, endCursor: first ? "c1" : null },
              nodes: first
                ? [order("1", { createdAt: "2026-10-30T20:00:00Z" }), order("2", { test: true })]
                : [order("3")],
            },
          },
        },
      }
    }
    const r = await syncShopifyProject("proj1")
    expect(r).toMatchObject({ orders: 2, full: true })
    expect([...state.orders.keys()].sort()).toEqual(["1", "3"])
    // 20:00 UTC on the 30th is the 31st in India.
    expect((state.orders.get("1")!.data.date as Date).toISOString()).toBe(
      "2026-10-31T00:00:00.000Z",
    )
    // Timestamps in Shopify's search syntax must be quoted.
    const q = requests.find((x) => x.query.includes("orders("))!.variables.q as string
    expect(q).toMatch(/^created_at:>='\d{4}-\d{2}-\d{2}T[\d:.]+Z'$/)
    expect(state.channel).toMatchObject({ status: "connected", lastSyncError: null })
    expect(state.channel?.lastSyncedAt).toBeInstanceOf(Date)
  })

  it("fetches the rest of an order with more lines than the first page", async () => {
    connected()
    const longOrder = order("9", {
      lineItems: {
        pageInfo: { hasNextPage: true, endCursor: "l1" },
        nodes: [line("A", 100)],
      },
    })
    shopify = (query) => {
      if (query.includes("shop {")) return { body: { data: SHOP } }
      if (query.includes("products(")) return emptyProducts()
      if (query.includes("OrderLines")) {
        return {
          body: {
            data: {
              order: {
                lineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [line("B", 50, 2)],
                },
              },
            },
          },
        }
      }
      return {
        body: {
          data: {
            orders: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [longOrder] },
          },
        },
      }
    }
    await syncShopifyProject("proj1")
    expect(state.lines.map((l) => l.sku).sort()).toEqual(["A", "B"])
    expect(state.orders.get("9")!.data).toMatchObject({ grossSales: 200, unitsSold: 3 })
  })

  it("takes the per-store lock before rewriting an order's lines", async () => {
    connected()
    shopify = (query) => {
      if (query.includes("shop {")) return { body: { data: SHOP } }
      if (query.includes("products(")) return emptyProducts()
      return {
        body: {
          data: {
            orders: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [order("1")] },
          },
        },
      }
    }
    await syncShopifyProject("proj1")
    const lock = state.calls.findIndex(
      (c) => c.startsWith("lock:") && c.includes("pg_advisory_xact_lock"),
    )
    expect(lock).toBeGreaterThan(-1)
    expect(state.calls[lock]).toContain("shopify-lines:ch1")
    expect(lock).toBeLessThan(state.calls.indexOf("line.deleteMany"))
  })

  it("re-syncing replaces an order's lines instead of adding to them", async () => {
    connected()
    shopify = (query) => {
      if (query.includes("shop {")) return { body: { data: SHOP } }
      if (query.includes("products(")) return emptyProducts()
      return {
        body: {
          data: {
            orders: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [order("1")] },
          },
        },
      }
    }
    await syncShopifyProject("proj1")
    await syncShopifyProject("proj1")
    expect(state.lines).toHaveLength(1)
  })

  it("only deletes missing orders inside what Shopify serves, minus a safety margin", async () => {
    connected()
    const before = Date.now()
    await syncShopifyProject("proj1")
    const where = (state.orderDeletes[0] as { where: { placedAt: { gte: Date } } }).where
    const servedStart = before - Math.min(SHOPIFY_HISTORY_DAYS, 60) * 86_400_000
    // Two days inside the window's start, never earlier.
    expect(where.placedAt.gte.getTime()).toBeGreaterThanOrEqual(
      servedStart + 2 * 86_400_000 - 5_000,
    )
  })

  it("reads only recent changes after the first sync", async () => {
    const last = new Date(Date.now() - 2 * 3_600_000)
    connected({ lastSyncedAt: last })
    const { runShopifySweep } = await import("./shopify-sync.service")
    const r = await runShopifySweep()
    expect(r).toMatchObject({ synced: 1, failed: 0 })
    const q = requests.find((x) => x.query.includes("orders("))!.variables.q as string
    // 30 minutes of overlap before the last sync.
    expect(q).toBe(`updated_at:>='${new Date(last.getTime() - 30 * 60_000).toISOString()}'`)
    // An incremental run never deletes: it hasn't seen the whole window.
    expect(state.orderDeletes).toHaveLength(0)
  })

  it("skips a store synced in the last 10 minutes", async () => {
    connected({ lastSyncedAt: new Date(Date.now() - 60_000) })
    const { runShopifySweep } = await import("./shopify-sync.service")
    expect(await runShopifySweep()).toMatchObject({ synced: 0, skipped: 1 })
    expect(requests).toHaveLength(0)
  })

  it("waits and retries when Shopify throttles", async () => {
    connected()
    vi.stubGlobal("setTimeout", ((fn: () => void) => {
      fn()
      return 0
    }) as unknown as typeof setTimeout)
    let throttled = 0
    shopify = (query) => {
      if (query.includes("shop {") && throttled < 2) {
        throttled++
        return throttled === 1
          ? { status: 429 }
          : { body: { errors: [{ message: "Throttled", extensions: { code: "THROTTLED" } }] } }
      }
      if (query.includes("shop {")) return { body: { data: SHOP } }
      if (query.includes("products(")) return emptyProducts()
      return {
        body: {
          data: { orders: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] } },
        },
      }
    }
    await expect(syncShopifyProject("proj1")).resolves.toMatchObject({ orders: 0 })
    expect(throttled).toBe(2)
  })

  it("records Shopify's reason when the token stops working", async () => {
    connected()
    shopify = () => ({ status: 401 })
    await expect(syncShopifyProject("proj1")).rejects.toThrow("Shopify rejected the access token")
    expect(state.channel?.lastSyncError).toBe("Shopify rejected the access token")
  })

  it("never shows a database error's internals to the project", async () => {
    connected()
    vi.spyOn(console, "error").mockImplementation(() => {})
    shopify = (query) => {
      if (query.includes("shop {")) return { body: { data: SHOP } }
      return {
        body: {
          data: {
            orders: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [order("1")] },
          },
        },
      }
    }
    state.failOrderWrite = true
    await expect(syncShopifyProject("proj1")).rejects.toThrow()
    expect(state.channel?.lastSyncError).toBe(
      "The sync failed while saving. The details are in the server log.",
    )
    expect(state.channel?.lastSyncError).not.toMatch(/shopify_orders|secret|invocation/)
  })
})

describe("servedHistoryDays", () => {
  it("never claims more than Shopify's 60 days without read_all_orders", () => {
    expect(servedHistoryDays([])).toBeLessThanOrEqual(60)
    expect(servedHistoryDays(["read_orders"])).toBeLessThanOrEqual(60)
    expect(servedHistoryDays(["read_orders", "read_all_orders"])).toBe(SHOPIFY_HISTORY_DAYS)
  })
})

describe("disconnectShopify", () => {
  it("removes the store's products and the store (its orders cascade)", async () => {
    connected()
    await disconnectShopify("proj1")
    expect(state.calls).toEqual(["channel.findFirst", "product.deleteMany", "channel.delete"])
    expect(state.channel).toBeNull()
  })

  it("does nothing when nothing is connected", async () => {
    await disconnectShopify("proj1")
    expect(state.calls).toEqual(["channel.findFirst"])
  })
})
