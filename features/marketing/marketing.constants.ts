import {
  Users,
  Fingerprint,
  CalendarDays,
  Wallet,
  FolderKanban,
  Briefcase,
  Building2,
  MessagesSquare,
  LineChart,
  ShieldCheck,
  Zap,
  Lock,
  Server,
  Layers,
  Gauge,
  Sparkles,
  HandshakeIcon,
  TrendingUp,
  Boxes,
  type LucideIcon,
} from "lucide-react"

import { siteConfig } from "@/config/site"

/** Pre-filled "Book a demo" mailto. Change the address in config/site.ts. */
export const demoHref = `mailto:${siteConfig.contactEmail}?subject=${encodeURIComponent(
  "DNMS demo request",
)}`

export interface MarketingModule {
  icon: LucideIcon
  name: string
  headline: string
  text: string
  points: string[]
}

/** The ten product modules, grounded in what the app actually ships. */
export const MODULES: MarketingModule[] = [
  {
    icon: Users,
    name: "HR & People",
    headline: "Your whole workforce, one record",
    text: "Profiles, org chart, documents, roles and onboarding, audited and secure.",
    points: [
      "Searchable directory with department, designation & status filters",
      "Auto-built org chart with solid & dotted-line reporting",
      "Automated onboarding: codes, credentials, welcome email, leave balances",
      "Per-employee document vault with expiry tracking",
    ],
  },
  {
    icon: Fingerprint,
    name: "Attendance & Time",
    headline: "Biometric attendance on autopilot",
    text: "Sync every biometric punch to accurate daily attendance, automatically.",
    points: [
      "Hikvision face / card / fingerprint sync over ISAPI, no extra hardware",
      "Live webhook + scheduled sync + full history backfill",
      "Auto Present / Half-Day / Absent from hours against your policy",
      "Employee self-service regularization with manager & HR approval",
    ],
  },
  {
    icon: CalendarDays,
    name: "Leave & Remote Work",
    headline: "Leave & WFH, fully automated",
    text: "Policies, accruals and approvals that enforce your rules on their own - casual, sick, earned, comp-offs, WFH and optional holidays, all accrued monthly, checked against the company holiday calendar and reconciled without a single spreadsheet.",
    points: [
      "Policy matrix by employment type with monthly accrual & rollover",
      "Apply-time rules: probation gates, notice windows, caps & clash checks",
      "Two-tier manager + HR approval with editable email letters",
      "Live per-person balances and a company-wide balance directory",
      "WFH & remote-day requests on the same approval workflow",
    ],
  },
  {
    icon: Wallet,
    name: "Payroll & Performance",
    headline: "Payroll that pays itself",
    text: "Attendance-accurate payslips in one click, plus structured reviews.",
    points: [
      "One-click monthly payroll, prorated from real attendance & leave",
      "Percentage-based salary structures across all components",
      "Self-service payslip portal with print-to-PDF",
      "Weighted KPI scorecards mapping scores to increments & promotions",
    ],
  },
  {
    icon: FolderKanban,
    name: "Projects & Delivery",
    headline: "Run every client project in one place",
    text: "Teams, task boards and deliverables so nothing slips through.",
    points: [
      "Per-project teams with managers and role-based access",
      "Task boards with time tracking and auto follow-ups for on-hold work",
      "Blocking-requirements workflow to clear what stalls delivery",
      "Threaded messaging with @mentions, polls, reactions & voice notes",
    ],
  },
  {
    icon: Briefcase,
    name: "Recruitment & Hiring",
    headline: "Hire faster, end to end",
    text: "From AI-drafted job posts to signed offers, with referrals built in.",
    points: [
      "AI-generated job posting copy from just a role title",
      "Drag-and-drop pipeline: Applied → Screening → Interview → Offer → Hired",
      "Interview scheduling with feedback, ratings and automated emails",
      "Public careers API for your marketing site + one-click offer letters",
    ],
  },
  {
    icon: Building2,
    name: "Client Portal",
    headline: "Give clients their own portal",
    text: "A secure, per-project portal that shows each client exactly what you choose - product catalog, live inventory, sales-channel status, their own email campaigns and an activity log, all behind auto-issued credentials and module-level access.",
    points: [
      "Per-project client accounts with module-level access control",
      "Product catalog, inventory alerts and sales-channel views",
      "Let clients run their own email campaigns from the project address",
      "Auto-issued credentials, forced password change & activity log",
    ],
  },
  {
    icon: MessagesSquare,
    name: "Comms & Culture",
    headline: "One place your team connects",
    text: "Secure 1:1 chat with attachments, voice notes and stickers, a company noticeboard, shared galleries, polls and events, all delivered in real time with browser push, so every conversation and announcement lives in one place instead of scattered across email and chat apps.",
    points: [
      "Private 1:1 chat with attachments, voice notes and stickers",
      "Polls, events and shared contacts as message cards",
      "Company announcement board with priorities and auto-expiry",
      "Real-time delivery plus browser Web Push notifications",
    ],
  },
  {
    icon: LineChart,
    name: "SEO Suite",
    headline: "Client SEO on autopilot",
    text: "Agency-grade SEO for every client site, mostly on free data sources: Search Console sync, a scored keyword backlog, competitor gap analysis, technical and uptime audits, and SERP-informed content briefs, all rolled up into one weighted monthly scorecard.",
    points: [
      "Search Console sync stored as diffable snapshots over time",
      "Prioritized keyword backlog scored by demand & winnability",
      "Competitor gap analysis, technical audits and uptime monitoring",
      "SERP-informed content briefs and a weighted monthly scorecard",
      "Automated rank tracking with position history and up/down alerts",
    ],
  },
  {
    icon: ShieldCheck,
    name: "Governance & Control",
    headline: "Control, trust, full visibility",
    text: "Granular roles, tamper-evident audit trails and encrypted secrets.",
    points: [
      "Permission-based access enforced on every API route",
      "Custom role builder from a full permission catalogue",
      "Audit log capturing actor, IP, entity and action by date range",
      "AES-256-GCM encryption of secrets at rest + rate limiting",
    ],
  },
]

export interface TrustItem {
  icon: LucideIcon
  label: string
  sub: string
}

export const TRUST: TrustItem[] = [
  { icon: Zap, label: "10 modules", sub: "one login" },
  { icon: Fingerprint, label: "Biometric → payroll", sub: "one data trail" },
  { icon: Lock, label: "Permission-controlled", sub: "every route" },
  { icon: Server, label: "Encrypted at rest", sub: "AES-256-GCM" },
]

export interface Benefit {
  icon: LucideIcon
  title: string
  text: string
}

/** Outcome-focused: what a company GETS, not what the software has. */
export const BENEFITS: Benefit[] = [
  {
    icon: Layers,
    title: "Replace a dozen tools",
    text: "HR, attendance, payroll, projects, hiring, chat and client access in one login and one bill, with no more stitching spreadsheets and SaaS subscriptions together.",
  },
  {
    icon: Wallet,
    title: "Payroll that matches reality",
    text: "Payslips are computed from real biometric attendance and approved leave, so what you pay reflects what actually happened, not a hand-typed sheet.",
  },
  {
    icon: Sparkles,
    title: "Less manual HR work",
    text: "Onboarding, leave accruals, approvals and email letters run themselves, freeing your people team to do people work instead of paperwork.",
  },
  {
    icon: Gauge,
    title: "Nothing slips through",
    text: "Task boards, auto follow-ups, blocking-requirement tracking and reminders keep delivery on schedule and make it obvious when something is stuck.",
  },
  {
    icon: HandshakeIcon,
    title: "Clients that trust you",
    text: "Invite clients into a branded portal that shows exactly the products, inventory and updates you choose, and nothing internal.",
  },
  {
    icon: TrendingUp,
    title: "Decisions backed by data",
    text: "Live dashboards, KPI scorecards and a full audit trail give leadership a single, honest view of the whole company.",
  },
]

export interface Reason {
  title: string
  text: string
}

/** Why a company should pick DNMS over point tools or spreadsheets. */
export const WHY_REASONS: Reason[] = [
  {
    title: "Built for how companies actually run",
    text: "Attendance flows into leave, into payroll, into performance, as one connected chain, not disconnected apps you reconcile by hand.",
  },
  {
    title: "One source of truth",
    text: "People, projects, clients and communication share one database, so headcount, hours and pay always add up.",
  },
  {
    title: "Secure and governed by default",
    text: "Every action is permission-checked and audited, and secrets are encrypted: the controls leadership and IT expect before trusting a system.",
  },
  {
    title: "Grows with you",
    text: "From a 10-person team to multi-project delivery with an external client portal, and the same platform scales up without a re-platform.",
  },
]

export interface SecurityPoint {
  icon: LucideIcon
  title: string
  text: string
}

export const SECURITY_POINTS: SecurityPoint[] = [
  {
    icon: ShieldCheck,
    title: "Granular RBAC",
    text: "Module:action permission scopes checked on every request.",
  },
  {
    icon: Boxes,
    title: "Audit everything",
    text: "Actor, IP, entity and action captured and filterable.",
  },
  {
    icon: Lock,
    title: "Encrypted secrets",
    text: "AES-256-GCM for storage keys and SMTP passwords.",
  },
  {
    icon: Server,
    title: "Hardened access",
    text: "OTP reset, bcrypt, lockout and sliding-window rate limits.",
  },
]

/** Keywords for the scrolling capability marquee. */
export const MARQUEE_ITEMS: string[] = [
  "HR & People",
  "Biometric Attendance",
  "Leave & WFH",
  "Payroll",
  "Performance",
  "Projects",
  "Recruitment",
  "Client Portal",
  "Team Chat",
  "SEO Suite",
  "Announcements",
  "Documents",
  "Org Chart",
  "Audit Log",
  "Analytics",
  "Notifications",
]

export interface Stat {
  value: number
  suffix?: string
  label: string
  sub: string
}

export const STATS: Stat[] = [
  { value: 10, label: "Modules", sub: "in one platform" },
  { value: 1, label: "Login", sub: "for your whole company" },
  { value: 100, suffix: "%", label: "Permission-controlled", sub: "on every API route" },
  { value: 24, suffix: "/7", label: "Realtime", sub: "push notifications & SSE" },
]

export interface FlowStep {
  icon: LucideIcon
  title: string
  text: string
}

/** The connected chain that makes DNMS one system, not point tools. */
export const HOW_STEPS: FlowStep[] = [
  {
    icon: Fingerprint,
    title: "Attendance",
    text: "Every punch becomes daily attendance.",
  },
  {
    icon: CalendarDays,
    title: "Leave & WFH",
    text: "Leave and WFH adjust the day.",
  },
  {
    icon: Wallet,
    title: "Payroll",
    text: "Payslips compute from real days.",
  },
  {
    icon: TrendingUp,
    title: "Performance",
    text: "The record feeds KPI scores.",
  },
]

export interface Faq {
  q: string
  a: string
}

export const FAQS: Faq[] = [
  {
    q: "What is DNMS?",
    a: "DNMS (Digitally Next Management System) is an all-in-one company management platform. It brings HR, attendance, leave, payroll, performance, projects, recruitment, a client portal, team chat and SEO tools into one secure, permission-controlled system.",
  },
  {
    q: "Who is DNMS for?",
    a: "DNMS is for companies and agencies tired of stitching together separate HR apps, spreadsheets and chat threads. In DNMS, HR, finance, project managers, leadership and even clients each get exactly the view they need.",
  },
  {
    q: "Does DNMS work with our biometric devices?",
    a: "Yes. DNMS syncs attendance directly from Hikvision face, card and fingerprint terminals over ISAPI, with a live webhook plus scheduled sync and full history backfill, and no extra hardware bridge.",
  },
  {
    q: "How does DNMS protect our data?",
    a: "In DNMS, access is permission-based and enforced on every API route, every action is written to a tamper-evident audit trail, and secrets are encrypted at rest with AES-256-GCM and never leave the server.",
  },
  {
    q: "Can we give clients access in DNMS?",
    a: "Yes. DNMS lets you invite clients into a per-project portal that shows exactly the products, inventory, channels and updates you choose, and nothing internal.",
  },
  {
    q: "Is DNMS genuinely connected, or just many tools in one login?",
    a: "DNMS is genuinely connected. Attendance flows into leave, into payroll, into performance as one chain over a single database, so your headcount, hours and pay always reconcile.",
  },
]

export const PHILOSOPHY = {
  quote: "Software should remove the busywork between the work, not add one more tool to manage.",
  author: "Digitally Next",
}
