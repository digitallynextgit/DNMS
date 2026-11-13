// The weekly growth scorecard: the standard metric set every project starts with, and the small
// rules the table, the API and the seeding share.

export const CHANNELS = [
  "Overall",
  "SEO",
  "SMO",
  "Email / WhatsApp / SMS",
  "Ecommerce",
  "PR",
  "AEO",
  "GEO",
] as const
export type Channel = (typeof CHANNELS)[number]

/** CURRENCY ₹, PERCENT %, COUNT whole things, RATIO a multiple (3.5x), NUMBER anything else. */
export const UNITS = ["CURRENCY", "PERCENT", "COUNT", "RATIO", "NUMBER"] as const
export type Unit = (typeof UNITS)[number]

/** Which direction is an improvement when there is no healthy band to judge against. */
export const GOOD_WHEN = ["UP", "DOWN"] as const
export type GoodWhen = (typeof GOOD_WHEN)[number]

export interface MetricSeed {
  channel: Channel
  name: string
  unit: Unit
  howTo: string
  healthyMin?: number
  healthyMax?: number
  goodWhen?: GoodWhen
  healthyNote?: string
}

/**
 * The standard set, from the agency's weekly review sheet. Rows that held two numbers in one cell
 * ("59438 / 12 Orders", "1% / 7.5") are split, so every metric carries one number and can be
 * trended and compared against its band.
 */
export const STANDARD_METRICS: MetricSeed[] = [
  {
    channel: "Overall",
    name: "Revenue",
    unit: "CURRENCY",
    howTo: "Sum of net sales in the week.",
    healthyNote: "Trend up",
  },
  {
    channel: "Overall",
    name: "Orders",
    unit: "COUNT",
    howTo: "Count of orders in the week.",
    healthyNote: "Trend up",
  },
  {
    channel: "Overall",
    name: "MER (marketing efficiency ratio)",
    unit: "RATIO",
    howTo: "Total revenue / total marketing spend.",
    healthyMin: 3,
    healthyNote: "3-5x or higher",
  },
  {
    channel: "Overall",
    name: "Site conversion rate",
    unit: "PERCENT",
    howTo: "Orders / sessions.",
    healthyMin: 1.5,
    healthyMax: 3,
  },
  {
    channel: "Overall",
    name: "AOV (average order value)",
    unit: "CURRENCY",
    howTo: "Revenue / orders.",
    healthyNote: "Trend up",
  },
  {
    channel: "Overall",
    name: "Prepaid share (India)",
    unit: "PERCENT",
    howTo: "Prepaid orders / total orders.",
    healthyMin: 50,
    healthyNote: "50% or higher",
  },
  {
    channel: "Overall",
    name: "COD share",
    unit: "PERCENT",
    howTo: "COD orders shipped / total orders.",
    healthyMax: 20,
    goodWhen: "DOWN",
    healthyNote: "Under 15-20% overall",
  },
  {
    channel: "Overall",
    name: "Repeat purchase rate (12 months)",
    unit: "PERCENT",
    howTo: "Customers with 2+ orders / total customers in the period.",
    healthyMin: 2,
    healthyMax: 10,
  },
  {
    channel: "SEO",
    name: "Non-brand clicks",
    unit: "COUNT",
    howTo: "Filter out queries containing the brand name, then read total clicks.",
    healthyNote: "Trend up",
  },
  {
    channel: "SEO",
    name: "Impressions",
    unit: "COUNT",
    howTo: "Total impressions.",
    healthyNote: "Trend up",
  },
  {
    channel: "SEO",
    name: "CTR",
    unit: "PERCENT",
    howTo: "Clicks / impressions.",
    healthyNote: "Trend up",
  },
  {
    channel: "SEO",
    name: "Average position",
    unit: "NUMBER",
    howTo: "Average position of the website across queries.",
    goodWhen: "DOWN",
    healthyNote: "Lower is better",
  },
  {
    channel: "SEO",
    name: "Organic revenue share",
    unit: "PERCENT",
    howTo: "Revenue from organic search / total revenue.",
    healthyMin: 20,
    healthyMax: 30,
    healthyNote: "20-30% for mature stores",
  },
  {
    channel: "SMO",
    name: "Reach",
    unit: "COUNT",
    howTo: "Accounts reached across social in the week.",
    healthyNote: "Trend up",
  },
  {
    channel: "SMO",
    name: "Engagement rate",
    unit: "PERCENT",
    howTo: "(Likes + comments + saves + shares) / reach.",
    healthyMin: 1,
    healthyMax: 3,
    healthyNote: "1-3% (Instagram)",
  },
  {
    channel: "SMO",
    name: "Social conversion rate",
    unit: "PERCENT",
    howTo: "Purchases from social sessions / social sessions.",
    healthyMin: 1,
    healthyNote: "About 1%",
  },
  {
    channel: "Email / WhatsApp / SMS",
    name: "Revenue per recipient session",
    unit: "CURRENCY",
    howTo: "Attributed revenue / recipient sessions.",
    healthyNote: "Trend up",
  },
  {
    channel: "Ecommerce",
    name: "Product page to add-to-cart",
    unit: "PERCENT",
    howTo: "Add-to-cart sessions / product page view sessions.",
    healthyNote: "Trend up",
  },
  {
    channel: "PR",
    name: "Branded search lift",
    unit: "COUNT",
    howTo: "This week's brand-query clicks.",
    healthyNote: "About +10% month over month",
  },
  {
    channel: "AEO",
    name: "Question-query clicks",
    unit: "COUNT",
    howTo: "Clicks from question-style queries (who, what, how, why, is, can...).",
    healthyNote: "Trend up",
  },
  {
    channel: "GEO",
    name: "AI referral sessions",
    unit: "COUNT",
    howTo: "Sessions from AI sources.",
    healthyNote: "Trend up",
  },
]

/** The Monday of a date's week, as "yyyy-MM-dd". Weeks run Monday-Sunday, like the work digest. */
export function weekStartOf(value: Date | string): string {
  const d = typeof value === "string" ? new Date(`${value.slice(0, 10)}T00:00:00.000Z`) : value
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  // getUTCDay: 0 = Sunday, so Sunday steps back 6 days rather than 0.
  const back = (utc.getUTCDay() + 6) % 7
  utc.setUTCDate(utc.getUTCDate() - back)
  return utc.toISOString().slice(0, 10)
}

/** `shift` weeks away from a given Monday: -1 is the week before. */
export function shiftWeek(weekStart: string, shift: number): string {
  const d = new Date(`${weekStart}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + shift * 7)
  return d.toISOString().slice(0, 10)
}

/** "10 - 16 Nov 2026", the label above a week's column. */
export function weekLabel(weekStart: string): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const a = new Date(`${weekStart}T00:00:00.000Z`)
  const b = new Date(a)
  b.setUTCDate(b.getUTCDate() + 6)
  const sameMonth = a.getUTCMonth() === b.getUTCMonth()
  const left = sameMonth ? `${a.getUTCDate()}` : `${a.getUTCDate()} ${months[a.getUTCMonth()]}`
  return `${left} - ${b.getUTCDate()} ${months[b.getUTCMonth()]} ${b.getUTCFullYear()}`
}

/** How a number is written in the table. */
export function formatMetricValue(value: number | null | undefined, unit: string): string {
  if (value == null) return "-"
  const round = (n: number, dp: number) =>
    n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: dp })
  switch (unit) {
    case "CURRENCY":
      return `₹${round(value, 0)}`
    case "PERCENT":
      return `${round(value, 2)}%`
    case "RATIO":
      return `${round(value, 2)}x`
    case "COUNT":
      return round(value, 0)
    default:
      return round(value, 2)
  }
}

/** The change between two weeks, as a percentage of the earlier one. Null when it cannot be read. */
export function changePercent(
  current: number | null | undefined,
  previous: number | null | undefined,
): number | null {
  if (current == null || previous == null || previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

export type Health = "good" | "warn" | "bad" | "unknown"

/** Judge a value against its band. Without a band there is nothing to judge, so "unknown". */
export function healthOf(
  value: number | null | undefined,
  metric: { healthyMin?: number | null; healthyMax?: number | null; goodWhen?: string | null },
): Health {
  if (value == null) return "unknown"
  const { healthyMin, healthyMax } = metric
  if (healthyMin == null && healthyMax == null) return "unknown"
  const low = healthyMin != null && value < healthyMin
  const high = healthyMax != null && value > healthyMax
  if (!low && !high) return "good"
  // Only one end set means the other side is open, so missing it is a real miss, not a near miss.
  if (healthyMin != null && healthyMax != null) return "warn"
  return "bad"
}

/** Did this week move the right way? Used for the arrow's colour, not its direction. */
export function movedWell(
  current: number | null | undefined,
  previous: number | null | undefined,
  goodWhen: string | null | undefined,
): boolean | null {
  if (current == null || previous == null || current === previous) return null
  return goodWhen === "DOWN" ? current < previous : current > previous
}
