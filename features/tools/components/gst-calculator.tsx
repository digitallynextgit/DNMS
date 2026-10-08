"use client"

import { useState } from "react"
import { Calculator, Copy, Info } from "lucide-react"
import { toast } from "sonner"
import { SegmentedControl } from "@/components/shared/segmented-control"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  GST_RATES,
  calculateGst,
  formatIndianNumber,
  formatRate,
  formatRupees,
  gstSummary,
  parseQuantity,
  parseRate,
  parseRupees,
  rupeesInWords,
  type GstMode,
  type GstSupply,
} from "../lib/gst"
import { ToolPage } from "./tool-page"

const MODES = [
  { value: "add", label: "Add GST" },
  { value: "remove", label: "Remove GST" },
] as const satisfies readonly { value: GstMode; label: string }[]

const SUPPLIES = [
  { value: "intra", label: "Within state" },
  { value: "inter", label: "Other state" },
] as const satisfies readonly { value: GstSupply; label: string }[]

const CUSTOM = "custom"
const RATE_OPTIONS = [
  ...GST_RATES.map((r) => ({ value: String(r.value), label: formatRate(r.value), hint: r.hint })),
  { value: CUSTOM, label: "Custom", hint: "Type any rate" },
]

export function GstCalculator() {
  const [mode, setMode] = useState<GstMode>("add")
  const [amountText, setAmountText] = useState("")
  const [qtyText, setQtyText] = useState("")
  const [rateChoice, setRateChoice] = useState("18")
  const [customText, setCustomText] = useState("")
  const [supply, setSupply] = useState<GstSupply>("intra")

  const amount = parseRupees(amountText)
  const quantity = parseQuantity(qtyText)
  const rate = rateChoice === CUSTOM ? parseRate(customText) : Number(rateChoice)
  const ready = amount !== null && quantity !== null && rate !== null
  const result = ready
    ? calculateGst({ amountPaise: amount, quantity, ratePercent: rate, mode, supply })
    : null

  const amountError =
    amountText.trim() && amount === null
      ? "Type an amount like 25000 or 1,25,000.50"
      : ready && !result
        ? "That's more than this calculator handles (₹10 lakh crore)."
        : null
  const qtyError = quantity === null ? "Type a number above 0, like 3 or 2.5" : null
  const rateError =
    rateChoice === CUSTOM && customText.trim() && rate === null
      ? "Type a rate from 0 to 100, like 12 or 2.5"
      : null
  const rateHint = RATE_OPTIONS.find((o) => o.value === rateChoice)?.hint

  async function copySummary() {
    if (!result) return
    try {
      await navigator.clipboard.writeText(gstSummary(result))
      toast.success("Summary copied")
    } catch {
      toast.error("Your browser blocked copying - select the text and copy it instead")
    }
  }

  const half = rate !== null ? formatRate(rate / 2) : ""
  const answer = result ? (mode === "add" ? result.total : result.base) : null

  return (
    <ToolPage slug="gst-calculator">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardContent className="space-y-6 p-5">
            <div className="space-y-2">
              <SegmentedControl
                aria-label="Add or remove GST"
                value={mode}
                onChange={setMode}
                options={MODES}
              />
              <p className="text-muted-foreground text-xs">
                {mode === "add"
                  ? "Your price doesn't include GST yet - work out the total to charge."
                  : "Your price already includes GST - find the price before tax."}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
              <div className="space-y-2">
                <Label required htmlFor="gst-amount">
                  {mode === "add" ? "Price before GST" : "Price including GST"}
                </Label>
                <div className="relative">
                  <span
                    aria-hidden
                    className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm"
                  >
                    ₹
                  </span>
                  <Input
                    id="gst-amount"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="25,000"
                    value={amountText}
                    onChange={(e) => setAmountText(e.target.value)}
                    onBlur={() => {
                      // Tidy to Indian grouping once they're done typing: 125000 -> 1,25,000
                      if (amount !== null)
                        setAmountText(formatIndianNumber(amount).replace(/\.00$/, ""))
                    }}
                    aria-invalid={!!amountError}
                    aria-describedby={amountError ? "gst-amount-error" : undefined}
                    className="pl-7 tabular-nums"
                  />
                </div>
                {amountError && (
                  <p id="gst-amount-error" className="text-destructive text-xs">
                    {amountError}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="gst-qty">Quantity (optional)</Label>
                <Input
                  id="gst-qty"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="1"
                  value={qtyText}
                  onChange={(e) => setQtyText(e.target.value)}
                  aria-invalid={!!qtyError}
                  aria-describedby={qtyError ? "gst-qty-error" : undefined}
                  className="tabular-nums"
                />
                {qtyError && (
                  <p id="gst-qty-error" className="text-destructive text-xs">
                    {qtyError}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label id="gst-rate-label">GST rate</Label>
              <div role="group" aria-labelledby="gst-rate-label" className="flex flex-wrap gap-2">
                {RATE_OPTIONS.map((o) => {
                  const active = rateChoice === o.value
                  return (
                    <button
                      key={o.value}
                      type="button"
                      aria-pressed={active}
                      title={o.hint}
                      onClick={() => setRateChoice(o.value)}
                      className={cn(
                        "focus-visible:ring-ring h-9 min-w-14 rounded-sm border px-3 text-sm font-medium tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:bg-accent",
                      )}
                    >
                      {o.label}
                    </button>
                  )
                })}
              </div>
              {rateChoice === CUSTOM ? (
                <div className="max-w-48 space-y-2 pt-1">
                  <Label htmlFor="gst-custom-rate" className="sr-only">
                    Custom rate in percent
                  </Label>
                  <div className="relative">
                    <Input
                      id="gst-custom-rate"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="12"
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      aria-invalid={!!rateError}
                      aria-describedby={rateError ? "gst-rate-error" : undefined}
                      className="pr-8 tabular-nums"
                    />
                    <span
                      aria-hidden
                      className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm"
                    >
                      %
                    </span>
                  </div>
                  {rateError && (
                    <p id="gst-rate-error" className="text-destructive text-xs">
                      {rateError}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-xs">{rateHint}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Where is the customer?</Label>
              <SegmentedControl
                aria-label="Where is the customer?"
                value={supply}
                onChange={setSupply}
                options={SUPPLIES}
              />
              <p className="text-muted-foreground text-xs">
                {supply === "intra"
                  ? "Same state as you: the GST is split half and half into CGST and SGST."
                  : "Another state (or a Union Territory): the full GST is charged as IGST."}
              </p>
            </div>

            <p className="text-muted-foreground flex items-start gap-2 text-xs leading-relaxed">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              GST rates change from time to time. Always check the rate for the item&apos;s HSN code
              (goods) or SAC code (services) before you raise an invoice.
            </p>
          </CardContent>
        </Card>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardContent className="space-y-4 p-5">
              {result && answer !== null ? (
                <>
                  <div className="bg-muted/50 rounded-sm p-4">
                    <p className="text-muted-foreground text-xs">
                      {mode === "add" ? "Total with GST" : "Price before GST"}
                    </p>
                    <p className="text-2xl font-semibold tabular-nums" aria-live="polite">
                      {formatRupees(answer)}
                    </p>
                  </div>

                  <dl className="space-y-2 text-sm">
                    {result.quantity !== 1 && (
                      <Row
                        label="Quantity"
                        value={`${result.quantity} × ${formatRupees(result.amountPaise)}`}
                      />
                    )}
                    <Row label="Price before GST" value={formatRupees(result.base)} />
                    {supply === "intra" ? (
                      <>
                        <Row label={`CGST @ ${half}`} value={formatRupees(result.cgst)} />
                        <Row label={`SGST @ ${half}`} value={formatRupees(result.sgst)} />
                      </>
                    ) : (
                      <Row
                        label={`IGST @ ${formatRate(result.ratePercent)}`}
                        value={formatRupees(result.igst)}
                      />
                    )}
                    <Row label="Total GST" value={formatRupees(result.tax)} />
                    <Row label="Total" value={formatRupees(result.total)} strong />
                  </dl>

                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs">Total in words</p>
                    <p className="text-sm leading-relaxed">{rupeesInWords(result.total)}</p>
                  </div>

                  <Button className="w-full" onClick={copySummary}>
                    <Copy />
                    Copy summary
                  </Button>
                </>
              ) : (
                <div className="text-muted-foreground flex flex-col items-center gap-2 px-6 py-10 text-center text-xs">
                  <Calculator className="h-8 w-8" />
                  Type an amount to see the GST
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ToolPage>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4",
        strong && "border-t pt-2 font-semibold",
      )}
    >
      <dt className={cn(!strong && "text-muted-foreground")}>{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </div>
  )
}
