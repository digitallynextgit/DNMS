import { describe, expect, it } from "vitest"

import {
  isCountedOrder,
  isReturningCustomer,
  normalizeShopDomain,
  orderNumbers,
  referrerHost,
  salesChannelName,
  shopDay,
  type ShopifyOrderNode,
} from "./shopify-orders"

const money = (amount: string | number) => ({ shopMoney: { amount: String(amount) } })

function order(over: Partial<ShopifyOrderNode> = {}): ShopifyOrderNode {
  return {
    legacyResourceId: "1",
    createdAt: "2026-10-30T06:01:33Z",
    test: false,
    cancelledAt: null,
    displayFinancialStatus: "PAID",
    displayFulfillmentStatus: "FULFILLED",
    sourceName: "web",
    app: { name: "Online Store" },
    totalDiscountsSet: money(0),
    totalTaxSet: money(0),
    totalShippingPriceSet: money(0),
    shippingAddress: null,
    customerJourneySummary: null,
    refunds: [],
    lineItems: { nodes: [] },
    ...over,
  }
}

const line = (price: number, quantity: number) => ({
  quantity,
  sku: "SKU",
  title: "Cartridge",
  variantTitle: null,
  originalUnitPriceSet: money(price),
  variant: { legacyResourceId: "v1" },
  product: { legacyResourceId: "p1" },
})

describe("orderNumbers", () => {
  it("builds gross, net and total the way Shopify's sales report does", () => {
    const n = orderNumbers(
      order({
        lineItems: { nodes: [line(4999, 1), line(1000, 2)] },
        totalDiscountsSet: money("1299.80"),
        totalShippingPriceSet: money(100),
        totalTaxSet: money(18),
        refunds: [{ refundLineItems: { nodes: [{ subtotalSet: money(500) }] } }],
      }),
    )
    expect(n).toEqual({
      grossSales: 6999,
      discounts: 1299.8,
      returns: 500,
      netSales: 5199.2,
      shipping: 100,
      taxes: 18,
      totalSales: 5317.2,
      unitsSold: 3,
    })
  })

  it("treats missing money as zero", () => {
    const n = orderNumbers(order({ totalDiscountsSet: null, totalTaxSet: undefined }))
    expect(n.totalSales).toBe(0)
  })
})

describe("isCountedOrder", () => {
  it("counts paid and pending (cash on delivery) orders", () => {
    expect(isCountedOrder(order({ displayFinancialStatus: "PAID" }))).toBe(true)
    expect(isCountedOrder(order({ displayFinancialStatus: "PENDING" }))).toBe(true)
    expect(isCountedOrder(order({ displayFinancialStatus: "PARTIALLY_REFUNDED" }))).toBe(true)
  })

  it("drops refunded, voided and cancelled orders", () => {
    expect(isCountedOrder(order({ displayFinancialStatus: "REFUNDED" }))).toBe(false)
    expect(isCountedOrder(order({ displayFinancialStatus: "VOIDED" }))).toBe(false)
    expect(
      isCountedOrder(
        order({ displayFinancialStatus: "PENDING", cancelledAt: "2026-10-31T00:00:00Z" }),
      ),
    ).toBe(false)
  })
})

describe("salesChannelName", () => {
  it("names a checkout app rather than showing its numeric id", () => {
    expect(
      salesChannelName({ sourceName: "263703822337", app: { name: "Cashfree-OCC-h2s" } }),
    ).toBe("Cashfree-OCC-h2s")
    expect(salesChannelName({ sourceName: "web", app: null })).toBe("web")
    expect(salesChannelName({ sourceName: null, app: null })).toBe("Unknown")
  })
})

describe("referrerHost", () => {
  it("reduces a referrer to its site", () => {
    expect(referrerHost("https://www.google.com/")).toBe("google.com")
    expect(referrerHost("https://l.facebook.com/l.php?u=x")).toBe("facebook.com")
    expect(referrerHost("https://m.facebook.com/")).toBe("facebook.com")
    expect(referrerHost("android-app://com.google.android.gm/")).toBe("com.google.android.gm")
  })

  it("calls no referrer direct", () => {
    expect(referrerHost(null)).toBe("direct")
    expect(referrerHost("")).toBe("direct")
  })
})

describe("isReturningCustomer", () => {
  it("reads the customer's order index", () => {
    const at = (customerOrderIndex: number | null) =>
      isReturningCustomer({ customerJourneySummary: { customerOrderIndex, lastVisit: null } })
    expect(at(1)).toBe(false)
    expect(at(2)).toBe(true)
    expect(at(null)).toBeNull()
    expect(isReturningCustomer({ customerJourneySummary: null })).toBeNull()
  })
})

describe("shopDay", () => {
  it("dates an order by the shop's clock, not UTC", () => {
    // 20:00 UTC is already the next morning in India.
    expect(shopDay("2026-10-30T20:00:00Z", "Asia/Kolkata")).toBe("2026-10-31")
    expect(shopDay("2026-10-30T06:01:33Z", "Asia/Kolkata")).toBe("2026-10-30")
  })
})

describe("normalizeShopDomain", () => {
  it("accepts the handle, the domain or an admin URL", () => {
    expect(normalizeShopDomain("xxvjh8-ad")).toBe("xxvjh8-ad.myshopify.com")
    expect(normalizeShopDomain(" XXVJH8-AD.myshopify.com ")).toBe("xxvjh8-ad.myshopify.com")
    expect(normalizeShopDomain("https://xxvjh8-ad.myshopify.com/admin")).toBe(
      "xxvjh8-ad.myshopify.com",
    )
  })

  it("rejects a storefront domain, which the Admin API doesn't answer on", () => {
    expect(normalizeShopDomain("h2s.co.in")).toBeNull()
    expect(normalizeShopDomain("")).toBeNull()
  })
})
