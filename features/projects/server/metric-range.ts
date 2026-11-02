// The date range the Analytics dashboards (Meta Ads, Shopify) are read for.

/** Metrics slice: inclusive yyyy-MM-dd `from`/`to` (wins over `days`); empty = all synced days. */
export interface MetricRange {
  days?: number
  from?: string
  to?: string
}

/** yyyy-MM-dd -> UTC midnight (how @db.Date stores it); junk -> null, which widens the range. */
export function parseDay(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Prisma filter for a range (null = none). Inclusive: DATE columns sit at UTC midnight. */
export function metricDateFilter(range?: MetricRange): { gte?: Date; lte?: Date } | null {
  if (!range) return null

  const from = parseDay(range.from)
  const to = parseDay(range.to)
  if (from || to) {
    // A backwards range is read as the span between the two dates.
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
