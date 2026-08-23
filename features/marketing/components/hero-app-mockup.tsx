"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  LayoutDashboard,
  Fingerprint,
  CalendarDays,
  Wallet,
  FolderKanban,
  Briefcase,
  LineChart,
  ChevronRight,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { BorderBeam } from "./fx"

type ViewKey = "dashboard" | "attendance" | "leave" | "payroll" | "projects" | "recruitment" | "seo"

const NAV: { key: ViewKey; label: string; icon: LucideIcon }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "attendance", label: "Attendance", icon: Fingerprint },
  { key: "leave", label: "Leave", icon: CalendarDays },
  { key: "payroll", label: "Payroll", icon: Wallet },
  { key: "projects", label: "Projects", icon: FolderKanban },
  { key: "recruitment", label: "Recruitment", icon: Briefcase },
  { key: "seo", label: "SEO", icon: LineChart },
]

/* ------------------------------ small helpers ----------------------------- */

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="border-border bg-background rounded-[6px] border p-3">
      <div className="text-muted-foreground text-[10px] tracking-wide uppercase">{k}</div>
      <div className="mt-1 text-xl font-semibold">{v}</div>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-border bg-background rounded-[6px] border p-4">
      <div className="text-muted-foreground mb-3 text-xs font-medium">{title}</div>
      {children}
    </div>
  )
}

/* --------------------------------- views ---------------------------------- */

function DashboardView() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat k="Present" v="142" />
        <Stat k="On leave" v="8" />
        <Stat k="Open roles" v="5" />
        <Stat k="Projects" v="23" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Panel title="Attendance · 12 weeks">
          <div className="flex h-32 items-end gap-1.5" aria-hidden>
            {[40, 62, 48, 78, 58, 88, 70, 96, 82, 66, 92, 76].map((h, i) => (
              <div
                key={i}
                className="bg-muted-foreground/25 flex-1 rounded-[6px]"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </Panel>
        <Panel title="Recent">
          <div className="space-y-2.5">
            {[
              ["Punch synced", "09:02"],
              ["Payroll approved", "142"],
              ["New applicant", "Shortlisted"],
              ["Leave request", "Pending"],
            ].map(([a, b]) => (
              <div key={a} className="flex items-center justify-between text-xs">
                <span className="truncate">{a}</span>
                <span className="text-muted-foreground">{b}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  )
}

function AttendanceView() {
  const tone = [
    "",
    "ok",
    "ok",
    "half",
    "ok",
    "ok",
    "",
    "ok",
    "ok",
    "wfh",
    "ok",
    "absent",
    "ok",
    "ok",
  ]
  const bg: Record<string, string> = {
    ok: "bg-emerald-500/15",
    half: "bg-amber-500/15",
    wfh: "bg-blue-500/15",
    absent: "bg-red-500/15",
    "": "bg-muted/40",
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat k="Present" v="142" />
        <Stat k="Half-day" v="6" />
        <Stat k="Absent" v="3" />
      </div>
      <Panel title="August · biometric sync">
        <div className="text-muted-foreground mb-2 grid grid-cols-7 gap-1 text-center text-[9px] uppercase">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 28 }).map((_, i) => (
            <div
              key={i}
              className={cn("h-7 rounded-[6px]", bg[tone[i % tone.length] ?? ""])}
              aria-hidden
            />
          ))}
        </div>
      </Panel>
    </div>
  )
}

function LeaveView() {
  const bal: [string, number, number][] = [
    ["Casual", 4, 12],
    ["Sick", 6, 8],
    ["Earned", 10, 15],
  ]
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {bal.map(([name, used, total]) => (
          <div key={name} className="border-border bg-background rounded-[6px] border p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{name}</span>
              <span className="font-medium">
                {used}/{total}
              </span>
            </div>
            <div className="bg-muted mt-3 h-1.5 overflow-hidden rounded-full">
              <div
                className="bg-primary/70 h-full rounded-full"
                style={{ width: `${(used / total) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <Panel title="Requests">
        <div className="space-y-2.5">
          {[
            ["Aarav · Casual · 2 days", "Approved", "text-emerald-500"],
            ["Diya · Sick · 1 day", "Approved", "text-emerald-500"],
            ["Kabir · Earned · 5 days", "Pending", "text-amber-500"],
          ].map(([a, s, c]) => (
            <div key={a} className="flex items-center justify-between text-xs">
              <span className="truncate">{a}</span>
              <span className={cn("font-medium", c)}>{s}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}

function PayrollView() {
  const rows: [string, string][] = [
    ["Basic", "45,000"],
    ["HRA", "18,000"],
    ["Allowances", "+7,000"],
    ["Deductions", "-3,200"],
  ]
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Panel title="Payslip · August">
        <div className="space-y-2">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{k}</span>
              <span className="tabular-nums">₹ {v}</span>
            </div>
          ))}
          <div className="border-border/60 mt-2 flex items-center justify-between border-t pt-2 text-sm font-semibold">
            <span>Net pay</span>
            <span className="tabular-nums">₹ 66,800</span>
          </div>
        </div>
      </Panel>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Stat k="Payslips" v="142" />
          <Stat k="Approved" v="142" />
        </div>
        <div className="border-border bg-background flex items-center justify-between rounded-[6px] border p-4 text-xs">
          <span className="text-muted-foreground">Run status</span>
          <span className="rounded-[6px] bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-500">
            Paid
          </span>
        </div>
      </div>
    </div>
  )
}

function ProjectsView() {
  const cols: [string, string[]][] = [
    ["To do", ["Landing page", "Q3 report"]],
    ["In progress", ["Payroll run", "SEO audit"]],
    ["Done", ["Onboarding", "Invoices"]],
  ]
  return (
    <div className="grid grid-cols-3 gap-3">
      {cols.map(([name, tasks], ci) => (
        <div key={name} className="space-y-2">
          <div className="text-muted-foreground flex items-center justify-between px-0.5 text-[11px] font-medium">
            <span>{name}</span>
            <span>{tasks.length}</span>
          </div>
          {tasks.map((t) => (
            <div
              key={t}
              className={cn(
                "rounded-[6px] border p-2.5 text-xs",
                ci === 1 ? "border-primary/40 bg-primary/5" : "border-border bg-background",
              )}
            >
              <div className="truncate">{t}</div>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="bg-muted-foreground/30 h-4 w-4 rounded-full" />
                <span className="bg-muted-foreground/40 h-1 w-1 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function RecruitmentView() {
  const stages: [string, number][] = [
    ["Applied", 24],
    ["Screening", 12],
    ["Interview", 6],
    ["Offer", 3],
    ["Hired", 2],
  ]
  return (
    <div className="no-scrollbar flex items-stretch gap-1.5 overflow-x-auto">
      {stages.map(([name, n], i) => (
        <div key={name} className="flex flex-1 items-stretch gap-1.5">
          <div
            className={cn(
              "flex min-w-[68px] flex-1 flex-col rounded-[6px] border p-2.5",
              name === "Offer" ? "border-primary/40 bg-primary/5" : "border-border bg-background",
            )}
          >
            <div className="text-muted-foreground text-[10px] font-medium">{name}</div>
            <div className="mt-1 text-lg font-semibold">{n}</div>
            <div className="mt-2 flex -space-x-1.5">
              {Array.from({ length: Math.min(3, n) }).map((_, k) => (
                <span
                  key={k}
                  className="border-background bg-muted-foreground/30 h-4 w-4 rounded-full border"
                />
              ))}
            </div>
          </div>
          {i < stages.length - 1 && (
            <ChevronRight className="text-muted-foreground/50 my-auto h-3.5 w-3.5 shrink-0" />
          )}
        </div>
      ))}
    </div>
  )
}

function SeoView() {
  return (
    <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
      <Panel title="Clicks · +18%">
        <svg viewBox="0 0 300 110" className="h-32 w-full" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id="seoFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0 90 L40 78 L80 82 L120 60 L160 66 L200 40 L240 48 L300 20 L300 110 L0 110 Z"
            fill="url(#seoFill)"
          />
          <path
            d="M0 90 L40 78 L80 82 L120 60 L160 66 L200 40 L240 48 L300 20"
            fill="none"
            stroke="#ef4444"
            strokeWidth="2"
          />
        </svg>
      </Panel>
      <Panel title="Keywords">
        <div className="space-y-2.5">
          {[
            ["hr software", "#4", "+3"],
            ["payroll app", "#7", "+2"],
            ["attendance", "#2", "+1"],
          ].map(([kw, pos, delta]) => (
            <div key={kw} className="flex items-center justify-between text-xs">
              <span className="truncate">{kw}</span>
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground tabular-nums">{pos}</span>
                <span className="text-emerald-500">{delta}</span>
              </span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}

const VIEWS: Record<ViewKey, () => React.ReactNode> = {
  dashboard: DashboardView,
  attendance: AttendanceView,
  leave: LeaveView,
  payroll: PayrollView,
  projects: ProjectsView,
  recruitment: RecruitmentView,
  seo: SeoView,
}

export function HeroAppMockup() {
  const [active, setActive] = useState<ViewKey>("dashboard")
  const View = VIEWS[active]
  const title = NAV.find((n) => n.key === active)!.label

  return (
    <div className="border-border bg-card relative overflow-hidden rounded-[6px] border text-left shadow-2xl">
      <BorderBeam />
      {/* window chrome */}
      <div className="border-border bg-muted/50 flex items-center gap-2 border-b px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
        <span className="text-muted-foreground ml-3 text-xs">DNMS · Workspace</span>
      </div>

      <div className="grid grid-cols-[56px_1fr] sm:grid-cols-[190px_1fr]">
        {/* sidebar */}
        <nav className="border-border bg-muted/30 space-y-1 border-r p-2 sm:p-3">
          <div className="text-muted-foreground hidden px-2 pt-1 pb-2 text-[10px] font-semibold tracking-wider uppercase sm:block">
            Workspace
          </div>
          {NAV.map((n) => {
            const on = n.key === active
            return (
              <button
                key={n.key}
                type="button"
                onClick={() => setActive(n.key)}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "relative flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-left text-xs font-medium transition-colors sm:text-sm",
                  on
                    ? "bg-background text-foreground"
                    : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
                )}
              >
                {on && (
                  <span className="bg-primary absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full" />
                )}
                <n.icon className="h-4 w-4 shrink-0" />
                <span className="hidden truncate sm:inline">{n.label}</span>
              </button>
            )
          })}
        </nav>

        {/* content */}
        <div className="min-h-[360px] p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-semibold sm:text-base">{title}</div>
            <div className="text-muted-foreground hidden text-xs sm:block">Live preview</div>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <View />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
