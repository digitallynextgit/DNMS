// Pure parsing helpers for the stock import dialog (no DB access).

/** Collapse whitespace and case for name comparison ("  Deepak  Goel " → "deepak goel"). */
export function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase()
}

const pad = (n: number) => String(n).padStart(2, "0")

/** Accepts Date cells, ISO, en-GB "22/12/2025" and "22nd December, 2025" (the ordinal defeats Date.parse). */
export function toIsoDateLoose(v: unknown): string | null {
  if (v instanceof Date) {
    return Number.isNaN(v.getTime())
      ? null
      : `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`
  }
  if (v === null || v === undefined || v === "" || typeof v === "boolean") return null
  const s = String(v).trim()
  if (/^\d+(\.\d+)?$/.test(s)) return null // a bare number is not a date
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return `${m[1]}-${pad(Number(m[2]))}-${pad(Number(m[3]))}`
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/)
  if (m) {
    const y = m[3]!.length === 2 ? `20${m[3]}` : m[3]!
    return `${y}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`
  }
  // "22nd December, 2025" → "22 December, 2025"
  const deOrdinal = s.replace(/(\d+)(st|nd|rd|th)\b/gi, "$1")
  const d = new Date(deOrdinal)
  return Number.isNaN(d.getTime())
    ? null
    : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** A non-negative integer quantity, or null for blanks/junk. */
export function toQty(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n)
}

/** Sheet summary rows ("Stock left", "Total"...) - the app computes these, so never import them. */
export function isSummaryHolder(name: string): boolean {
  return /^(stock\s*(left|given|remaining)|total|balance|remaining|grand\s*total)\b/i.test(
    name.trim(),
  )
}

export interface ParsedImport {
  /** Catalogue rows (from a Sheet2-style "Item | Price | Quantity" sheet). */
  items: { name: string; pricePerPiece: number | null; purchasedQty: number | null }[]
  issues: { holderName: string; itemName: string; quantity: number; issuedOn: string | null }[]
  /** Anything skipped, with the reason - shown in the preview so nothing vanishes silently. */
  skipped: string[]
}

type Cell = string | number | boolean | Date | null

/** Two layouts: an ISSUANCE matrix (`Given to | On date | <item>...`) and a CATALOGUE
 *  (`Item | Price | Quantity`). Anything else is reported in `skipped`, never guessed. */
export function parseStockWorkbook(sheets: { name: string; rows: Cell[][] }[]): ParsedImport {
  const out: ParsedImport = { items: [], issues: [], skipped: [] }

  for (const sheet of sheets) {
    const [header, ...rows] = sheet.rows
    if (!header || header.length === 0) continue
    const heads = header.map((h) => String(h ?? "").trim())
    const lower = heads.map((h) => h.toLowerCase())

    if (lower[0]?.startsWith("given")) {
      const dateCol = lower.findIndex((h) => h.includes("date"))
      const itemCols = heads
        .map((name, index) => ({ name, index }))
        .filter(({ name, index }) => index > 0 && index !== dateCol && name !== "")
      for (const row of rows) {
        const holder = String(row[0] ?? "").trim()
        if (!holder) continue
        if (isSummaryHolder(holder)) {
          out.skipped.push(`${sheet.name}: "${holder}" row (summary, computed by the app)`)
          continue
        }
        const issuedOn = dateCol >= 0 ? toIsoDateLoose(row[dateCol]) : null
        for (const { name, index } of itemCols) {
          const qty = toQty(row[index])
          if (!qty) continue
          out.issues.push({ holderName: holder, itemName: name, quantity: qty, issuedOn })
        }
      }
      continue
    }

    if (lower[0]?.startsWith("item")) {
      const priceCol = lower.findIndex((h) => h.includes("price"))
      const qtyCol = lower.findIndex((h) => h.includes("quantity") || h === "qty")
      for (const row of rows) {
        const name = String(row[0] ?? "").trim()
        if (!name) {
          out.skipped.push(`${sheet.name}: unnamed catalogue row (totals line)`)
          continue
        }
        out.items.push({
          name,
          // Prices keep their decimals - toQty() would round them.
          pricePerPiece: priceCol >= 0 ? numberOrNull(row[priceCol]) : null,
          purchasedQty: qtyCol >= 0 ? toQty(row[qtyCol]) : null,
        })
      }
      continue
    }

    out.skipped.push(`${sheet.name}: unrecognised sheet layout (first header "${heads[0] ?? ""}")`)
  }

  return out
}

function numberOrNull(v: Cell): number | null {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
