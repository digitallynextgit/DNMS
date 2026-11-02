// A Shopify order (Admin GraphQL shape) -> the numbers DNMS keeps. Pure, so the money rules are
// tested without the API. Same rules as adauto's shopify_extractor.py, which H2S was built on.

/** Orders that count as sales. Refunded, voided and expired ones drop out. */
export const COUNTED_FINANCIAL_STATUSES = new Set([
  "PAID",
  "PARTIALLY_PAID",
  "PARTIALLY_REFUNDED",
  "PENDING",
])

type Money = { shopMoney: { amount: string } } | null | undefined

export interface ShopifyOrderLine {
  quantity: number
  sku: string | null
  title: string
  variantTitle: string | null
  originalUnitPriceSet: Money
  variant: { legacyResourceId: string } | null
  product: { legacyResourceId: string } | null
}

export interface ShopifyOrderNode {
  /** GraphQL id ("gid://shopify/Order/..."), for fetching the rest of a long order's lines. */
  id?: string
  legacyResourceId: string
  createdAt: string
  test: boolean
  cancelledAt: string | null
  displayFinancialStatus: string | null
  displayFulfillmentStatus: string | null
  sourceName: string | null
  /** The sales channel that took the order ("Online Store", a checkout app...). */
  app: { name: string | null } | null
  totalDiscountsSet: Money
  totalTaxSet: Money
  totalShippingPriceSet: Money
  shippingAddress: { province: string | null } | null
  customerJourneySummary: {
    customerOrderIndex: number | null
    lastVisit: { referrerUrl: string | null } | null
  } | null
  refunds: { refundLineItems: { nodes: { subtotalSet: Money }[] } }[]
  lineItems: {
    /** Set when the order has more lines than the first page carried. */
    pageInfo?: { hasNextPage: boolean; endCursor: string | null }
    nodes: ShopifyOrderLine[]
  }
}

const amount = (m: Money): number => Number(m?.shopMoney.amount ?? 0) || 0
export const round2 = (n: number): number => Math.round(n * 100) / 100

export interface OrderNumbers {
  grossSales: number
  discounts: number
  returns: number
  netSales: number
  shipping: number
  taxes: number
  totalSales: number
  unitsSold: number
}

/** A line's list price x quantity, before discounts. */
export const lineRevenue = (li: ShopifyOrderLine): number =>
  round2(amount(li.originalUnitPriceSet) * li.quantity)

/** gross = list price x qty; net = gross - discounts - returns; total = net + shipping + taxes. */
export function orderNumbers(o: ShopifyOrderNode): OrderNumbers {
  let gross = 0
  let units = 0
  for (const li of o.lineItems.nodes) {
    gross += amount(li.originalUnitPriceSet) * li.quantity
    units += li.quantity
  }
  let returns = 0
  for (const r of o.refunds)
    for (const rli of r.refundLineItems.nodes) returns += amount(rli.subtotalSet)

  const discounts = amount(o.totalDiscountsSet)
  const shipping = amount(o.totalShippingPriceSet)
  const taxes = amount(o.totalTaxSet)
  const net = gross - discounts - returns
  return {
    grossSales: round2(gross),
    discounts: round2(discounts),
    returns: round2(returns),
    netSales: round2(net),
    shipping: round2(shipping),
    taxes: round2(taxes),
    totalSales: round2(net + shipping + taxes),
    unitsSold: units,
  }
}

/** A cancelled order is not a sale even while its payment still reads PENDING (cash on delivery). */
export function isCountedOrder(
  o: Pick<ShopifyOrderNode, "displayFinancialStatus" | "cancelledAt">,
) {
  return !o.cancelledAt && COUNTED_FINANCIAL_STATUSES.has(o.displayFinancialStatus ?? "")
}

/** The channel's name; source_name alone is a bare app id for orders placed through an app. */
export function salesChannelName(o: Pick<ShopifyOrderNode, "app" | "sourceName">): string {
  return o.app?.name || o.sourceName || "Unknown"
}

/** "https://l.facebook.com/x" -> "facebook.com"; nothing -> "direct". */
export function referrerHost(url: string | null | undefined): string {
  if (!url) return "direct"
  let host: string
  try {
    host = new URL(url).hostname || url
  } catch {
    host = url
  }
  // Mobile and link-shim subdomains are the same source.
  return host.toLowerCase().replace(/^(www|m|l|lm)\./, "") || "direct"
}

/** 1 = their first order, 2+ = returning; null when Shopify doesn't know. */
export function isReturningCustomer(o: Pick<ShopifyOrderNode, "customerJourneySummary">) {
  const index = o.customerJourneySummary?.customerOrderIndex
  return typeof index === "number" ? index > 1 : null
}

/** The yyyy-MM-dd an instant falls on in the shop's timezone (Shopify sends UTC). */
export function shopDay(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso))
}

/** "xxvjh8-ad", "https://xxvjh8-ad.myshopify.com/admin" -> "xxvjh8-ad.myshopify.com"; else null. */
export function normalizeShopDomain(input: string): string | null {
  let s = input.trim().toLowerCase()
  s = s.replace(/^https?:\/\//, "").split(/[/?#]/)[0] ?? ""
  if (/^[a-z0-9][a-z0-9-]*$/.test(s)) s = `${s}.myshopify.com`
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(s) ? s : null
}
