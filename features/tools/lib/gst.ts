// Money is in PAISE (whole numbers) and taxed with BigInt, so there's no floating-point drift:
// each amount is rounded to the nearest paisa (half up) exactly once.

export type GstMode = "add" | "remove"
/** Within the same state (CGST + SGST) or to another state (IGST). */
export type GstSupply = "intra" | "inter"

/** Rates after the September 2025 reform: 5% and 18% for most things, 40% for luxury/"sin" goods. */
export const GST_RATES: readonly { value: number; hint: string }[] = [
  { value: 0, hint: "Exempt or nil-rated items" },
  { value: 0.25, hint: "Rough diamonds and precious stones" },
  { value: 3, hint: "Gold, silver and jewellery" },
  { value: 5, hint: "Lower rate - everyday essentials and some services" },
  { value: 18, hint: "Standard rate - most services, like design, websites and ads" },
  { value: 40, hint: "Luxury and 'sin' goods" },
]

/** Biggest line total the calculator takes: ₹10 lakh crore. */
export const MAX_PAISE = 1e15

/** Rates are kept to 4 decimal places (0.0001%). */
const RATE_SCALE = 10_000n
const HUNDRED = 100n * RATE_SCALE

/** num / den rounded half up, for num >= 0 and den > 0. */
function divRound(num: bigint, den: bigint): bigint {
  return (2n * num + den) / (2n * den)
}

/** "1,23,456.78", "₹ 25000", "Rs. 500" -> paise, rounded to the paisa. Null if not a plain amount. */
export function parseRupees(text: string): number | null {
  const cleaned = text
    .trim()
    .replace(/^(₹|rs\.?|inr)/i, "")
    .replace(/[,\s]/g, "")
  const m = /^(\d*)(?:\.(\d*))?$/.exec(cleaned)
  if (!m || (!m[1] && !m[2])) return null
  const whole = m[1] || "0"
  if (whole.replace(/^0+/, "").length > 13) return null // beyond ₹10 lakh crore
  const decimals = (m[2] ?? "").padEnd(3, "0")
  let paise = Number(whole) * 100 + Number(decimals.slice(0, 2))
  if (Number(decimals[2]) >= 5) paise += 1
  return paise
}

/** A quantity like "3" or "2.5" (hours). Empty means 1. Null if not a positive number. */
export function parseQuantity(text: string): number | null {
  const t = text.trim().replace(/,/g, "")
  if (!t) return 1
  if (!/^(\d+\.?\d*|\.\d+)$/.test(t)) return null
  const q = Number(t)
  return q > 0 && q <= 1_000_000 ? q : null
}

/** A custom rate like "12" or "2.5" (percent, 0-100). Null if not valid. */
export function parseRate(text: string): number | null {
  const t = text.trim().replace(/%$/, "").trim()
  if (!/^(\d+\.?\d*|\.\d+)$/.test(t)) return null
  const r = Number(t)
  return r >= 0 && r <= 100 ? r : null
}

export interface GstInput {
  /** Price of one item in paise - before GST ("add") or including it ("remove"). */
  amountPaise: number
  quantity?: number
  /** e.g. 18 for 18%. */
  ratePercent: number
  mode: GstMode
  supply: GstSupply
}

export interface GstResult extends Required<GstInput> {
  base: number
  cgst: number
  sgst: number
  igst: number
  tax: number
  total: number
}

/**
 * Within a state the tax splits into CGST + SGST halves, each rounded on its own (as on an invoice).
 * Removing GST keeps the typed total exact; any rounding paisa lands in the base.
 */
export function calculateGst(input: GstInput): GstResult | null {
  const quantity = input.quantity ?? 1
  const rate = BigInt(Math.round(input.ratePercent * Number(RATE_SCALE)))
  const qtyMilli = BigInt(Math.round(quantity * 1000))
  const line = divRound(BigInt(Math.round(input.amountPaise)) * qtyMilli, 1000n)
  if (line > BigInt(MAX_PAISE)) return null

  let base: bigint
  let cgst = 0n
  let igst = 0n
  if (input.mode === "add") {
    base = line
    if (input.supply === "intra") cgst = divRound(base * rate, 2n * HUNDRED)
    else igst = divRound(base * rate, HUNDRED)
  } else {
    if (input.supply === "intra") {
      cgst = divRound(line * rate, 2n * (HUNDRED + rate))
      base = line - 2n * cgst
    } else {
      igst = divRound(line * rate, HUNDRED + rate)
      base = line - igst
    }
  }
  const tax = 2n * cgst + igst
  return {
    ...input,
    quantity,
    base: Number(base),
    cgst: Number(cgst),
    sgst: Number(cgst),
    igst: Number(igst),
    tax: Number(tax),
    total: Number(base + tax),
  }
}

/** Indian digit grouping: "12345678" -> "1,23,45,678". */
function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits
  const last3 = digits.slice(-3)
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",")
  return `${rest},${last3}`
}

/** 12345678 paise -> "1,23,456.78" */
export function formatIndianNumber(paise: number): string {
  const p = Math.round(Math.abs(paise))
  const sign = paise < 0 ? "-" : ""
  return `${sign}${groupIndian(String(Math.floor(p / 100)))}.${String(p % 100).padStart(2, "0")}`
}

export function formatRupees(paise: number): string {
  return `₹${formatIndianNumber(paise)}`
}

/** 18 -> "18%", 0.25 -> "0.25%", 2.5 -> "2.5%" */
export function formatRate(rate: number): string {
  return `${Number(rate.toFixed(4))}%`
}

const ONES = [
  "Zero",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
]
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

function below100(n: number): string {
  if (n < 20) return ONES[n] ?? ""
  const ones = n % 10
  return `${TENS[Math.floor(n / 10)]}${ones ? ` ${ONES[ones]}` : ""}`
}

function below1000(n: number): string {
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  const parts: string[] = []
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`)
  if (rest) parts.push(below100(rest))
  return parts.join(" ")
}

/** 12345678 -> "One Crore Twenty Three Lakh ...". Above 99 crore the crore count is itself worded. */
export function numberToIndianWords(n: number): string {
  const v = Math.floor(Math.abs(n))
  if (v === 0) return "Zero"
  const crore = Math.floor(v / 1e7)
  const lakh = Math.floor((v % 1e7) / 1e5)
  const thousand = Math.floor((v % 1e5) / 1e3)
  const rest = v % 1000
  const parts: string[] = []
  if (crore) parts.push(`${numberToIndianWords(crore)} Crore`)
  if (lakh) parts.push(`${below100(lakh)} Lakh`)
  if (thousand) parts.push(`${below100(thousand)} Thousand`)
  if (rest) parts.push(below1000(rest))
  return parts.join(" ")
}

/** For invoices: "Rupees ... and Fifty Paise Only". */
export function rupeesInWords(paise: number): string {
  const p = Math.round(Math.abs(paise))
  const rupees = Math.floor(p / 100)
  const ps = p % 100
  if (!rupees && ps) return `${below100(ps)} Paise Only`
  const words = `Rupees ${numberToIndianWords(rupees)}`
  return ps ? `${words} and ${below100(ps)} Paise Only` : `${words} Only`
}

export function gstSummary(r: GstResult): string {
  const half = formatRate(r.ratePercent / 2)
  const lines = [
    `GST at ${formatRate(r.ratePercent)} - ${r.mode === "add" ? "added to the price" : "taken out of the price"}, ${
      r.supply === "intra" ? "within state" : "other state"
    }`,
  ]
  if (r.quantity !== 1)
    lines.push(
      `Quantity: ${r.quantity} x ${formatRupees(r.amountPaise)} (${r.mode === "add" ? "before" : "including"} GST)`,
    )
  lines.push(`Price before GST: ${formatRupees(r.base)}`)
  if (r.supply === "intra") {
    lines.push(`CGST @ ${half}: ${formatRupees(r.cgst)}`)
    lines.push(`SGST @ ${half}: ${formatRupees(r.sgst)}`)
  } else lines.push(`IGST @ ${formatRate(r.ratePercent)}: ${formatRupees(r.igst)}`)
  lines.push(`Total GST: ${formatRupees(r.tax)}`)
  lines.push(`Total: ${formatRupees(r.total)}`)
  lines.push(`In words: ${rupeesInWords(r.total)}`)
  return lines.join("\n")
}
