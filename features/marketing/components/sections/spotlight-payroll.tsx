"use client"

import { useEffect, useRef, useState } from "react"
import { motion, type Variants } from "motion/react"
import { FileText } from "lucide-react"

import { MODULES } from "../../marketing.constants"
import { CountUp } from "../fx"
import { SpotlightSection } from "../spotlight-section"

const m = MODULES.find((x) => x.name === "Payroll & Performance")!

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } },
}
const row: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
}

/** Bespoke visual: an attendance-accurate payslip with a bold Net Pay total,
 *  beside a circular KPI ring gauge that maps scores to increments. */
function PayrollVisual() {
  const lines: [string, string, number][] = [
    ["Basic", "+", 42000],
    ["HRA", "+", 16800],
    ["Allowances", "+", 9500],
    ["Deductions", "−", 6300],
  ]
  const tone: Record<string, string> = {
    "+": "text-emerald-500",
    "−": "text-red-500",
  }

  // KPI ring geometry (r=34 → circumference ≈ 213.6).
  const score = 86
  const circ = 2 * Math.PI * 34
  const dash = (score / 100) * circ

  // Draw the ring in when it scrolls into view - transitions only
  // stroke-dashoffset (no transform), so it can never overflow the card.
  const ringRef = useRef<HTMLDivElement>(null)
  const [drawn, setDrawn] = useState(false)
  useEffect(() => {
    const el = ringRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setDrawn(true)
          io.disconnect()
        }
      },
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div className="flex h-full flex-col gap-3 sm:flex-row">
      {/* payslip */}
      <div className="border-border bg-background flex flex-1 flex-col rounded-sm border p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="bg-primary/10 text-primary flex h-7 w-7 items-center justify-center rounded-full">
            <FileText className="h-3.5 w-3.5" />
          </span>
          <div className="leading-tight">
            <div className="text-xs font-semibold">Payslip · Aug</div>
            <div className="text-muted-foreground text-[10px]">Prorated from attendance</div>
          </div>
        </div>
        <motion.div
          className="space-y-1.5"
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.4 }}
        >
          {lines.map(([label, sign, amount]) => (
            <motion.div
              key={label}
              variants={row}
              className="flex items-center justify-between text-xs"
            >
              <span className="text-muted-foreground">{label}</span>
              <span className="tabular-nums">
                <span className={`mr-1 font-medium ${tone[sign]}`}>{sign}</span>
                <CountUp value={amount} />
              </span>
            </motion.div>
          ))}
        </motion.div>
        <div className="border-border/60 mt-auto flex items-center justify-between border-t pt-3">
          <span className="text-xs font-semibold">Net Pay</span>
          <CountUp
            value={61000}
            prefix="₹"
            className="text-primary text-base font-bold tabular-nums"
          />
        </div>
      </div>

      {/* KPI ring */}
      <div className="border-border bg-background flex flex-1 flex-col items-center justify-center rounded-sm border p-4">
        <div ref={ringRef} className="relative h-28 w-28">
          <svg viewBox="0 0 80 80" className="h-28 w-28 -rotate-90">
            <circle cx="40" cy="40" r="34" fill="none" strokeWidth="7" className="stroke-muted" />
            <circle
              cx="40"
              cy="40"
              r="34"
              fill="none"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={drawn ? circ - dash : circ}
              className="stroke-emerald-500 transition-[stroke-dashoffset] duration-[1300ms] ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <CountUp value={score} className="text-2xl font-bold tabular-nums" />
            <span className="text-muted-foreground text-[10px]">/ 100</span>
          </div>
        </div>
        <div className="text-muted-foreground mt-3 text-xs font-medium">KPI score</div>
        <div className="mt-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-500">
          On track · increment
        </div>
      </div>
    </div>
  )
}

export function SpotlightPayroll() {
  return (
    <SpotlightSection
      eyebrow={m.name}
      title={m.headline}
      text={m.text}
      points={m.points}
      visual={<PayrollVisual />}
      reverse={false}
      tinted
    />
  )
}
