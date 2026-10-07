// =============================================================================
// Notifications for the personas, the attendance devices, and Priya's AI
// connection (Claude).
// =============================================================================

import { db } from "@/server/db"
import { addDays, at, idOf, make, makeMany, type DemoContext } from "./context"

// ── Notifications ────────────────────────────────────────────────────────────

export async function seedNotifications(ctx: DemoContext): Promise<void> {
  const sunrise = "/projects/sunmeadow-organics-launch"
  const ago = (mins: number) => new Date(ctx.now.getTime() - mins * 60_000)
  type N = {
    to: string
    title: string
    message: string
    type: "info" | "success" | "warning" | "error"
    link: string | null
    minsAgo: number
    read?: boolean
  }
  const list: N[] = [
    // Priya (employee) - GUIDE REQUIREMENT: several, some unread.
    {
      to: "priya",
      title: "New task assigned",
      message: 'Rohan Verma assigned you "Diwali hamper statics (6)" on Sunmeadow Organics Launch.',
      type: "info",
      link: "/projects/my-tasks",
      minsAgo: 1080,
    },
    {
      to: "priya",
      title: "You were mentioned",
      message: 'Rohan Verma mentioned you in "Launch plan".',
      type: "info",
      link: `${sunrise}?tab=messages`,
      minsAgo: 4400,
    },
    {
      to: "priya",
      title: "Your referral was shortlisted",
      message: "Kunal Mehra (UI/UX Designer) has been shortlisted.",
      type: "success",
      link: "/referrals",
      minsAgo: 300,
    },
    {
      to: "priya",
      title: "Self-evaluation due",
      message: "Your self-evaluation for the last fortnight is pending.",
      type: "warning",
      link: "/performance/me",
      minsAgo: 2900,
    },
    {
      to: "priya",
      title: "Leave Approved",
      message: "Your Sick Leave last month was approved by Rohan Verma.",
      type: "success",
      link: "/leave",
      minsAgo: 30000,
      read: true,
    },
    {
      to: "priya",
      title: "Requirement provided",
      message: 'Rohan Verma provided "Brand font licence files (Gilroy)".',
      type: "success",
      link: `${sunrise}?tab=requirements`,
      minsAgo: 7200,
      read: true,
    },
    {
      to: "priya",
      title: "Document requested",
      message: "HR asked you to upload: Updated Address Proof.",
      type: "info",
      link: "/profile",
      minsAgo: 8600,
      read: true,
    },
    {
      to: "priya",
      title: "Task completed",
      message: 'Your task "Instagram carousel - millet benefits (5 slides)" was marked done.',
      type: "success",
      link: "/projects/my-tasks",
      minsAgo: 1500,
      read: true,
    },
    // Rohan (manager)
    {
      to: "rohan",
      title: "Leave request",
      message: "Priya Sharma applied for Casual Leave next week.",
      type: "info",
      link: "/leave?tab=requests",
      minsAgo: 240,
    },
    {
      to: "rohan",
      title: "Leave request",
      message: "Ananya Gupta applied for Casual Leave.",
      type: "info",
      link: "/leave?tab=requests",
      minsAgo: 200,
    },
    {
      to: "rohan",
      title: "WFH request",
      message: "Priya Sharma requested to work from home.",
      type: "info",
      link: "/wfh",
      minsAgo: 180,
    },
    {
      to: "rohan",
      title: "Resignation submitted",
      message: "Arjun Nair has submitted a resignation.",
      type: "warning",
      link: "/resignations",
      minsAgo: 1300,
    },
    {
      to: "rohan",
      title: "New requirement raised",
      message: 'Priya Sharma needs "Product photos for the new millet range" from you.',
      type: "warning",
      link: `${sunrise}?tab=requirements`,
      minsAgo: 1400,
    },
    {
      to: "rohan",
      title: "Exit clearance waiting on you",
      message: 'Sign off Pooja Bansal\'s "Manager / Reporting Head" clearance.',
      type: "warning",
      link: "/clearances",
      minsAgo: 15000,
      read: true,
    },
    // Neha (HR)
    {
      to: "neha",
      title: "Resignation submitted",
      message: "Arjun Nair has submitted a resignation.",
      type: "warning",
      link: "/resignations",
      minsAgo: 1300,
    },
    {
      to: "neha",
      title: "Floating holiday request",
      message: "Kavya Pillai requested a floating holiday.",
      type: "info",
      link: "/holidays",
      minsAgo: 2000,
    },
    {
      to: "neha",
      title: "Document uploaded",
      message: "Rahul Das uploaded a document for onboarding.",
      type: "info",
      link: "/onboarding",
      minsAgo: 900,
    },
    {
      to: "neha",
      title: "Payroll paid",
      message: "Last month's payroll was marked paid.",
      type: "success",
      link: "/payroll/payroll-directory",
      minsAgo: 8000,
      read: true,
    },
    // Aarav (admin)
    {
      to: "aarav",
      title: "Leave request",
      message: "Neha Kapoor applied for Casual Leave.",
      type: "info",
      link: "/leave/leave-directory",
      minsAgo: 220,
    },
    {
      to: "aarav",
      title: "Leave request",
      message: "Meera Joshi applied for Casual Leave.",
      type: "info",
      link: "/leave/leave-directory",
      minsAgo: 400,
    },
    {
      to: "aarav",
      title: "Weekly work digest",
      message: "Last week: 142 tasks done, 18 deliverables made, 2 requirements open.",
      type: "info",
      link: "/projects/progress",
      minsAgo: 3000,
      read: true,
    },
    // Clearance owners
    {
      to: "meera",
      title: "Exit clearance waiting on you",
      message: "Finance sign-off needed for Pooja Bansal's exit.",
      type: "warning",
      link: "/clearances",
      minsAgo: 15000,
    },
    {
      to: "karthik",
      title: "Exit clearance waiting on you",
      message: "IT / Admin sign-off needed for Pooja Bansal's exit.",
      type: "warning",
      link: "/clearances",
      minsAgo: 15000,
    },
  ]
  await makeMany(
    ctx,
    "notification",
    list.map((n) => ({
      employeeId: idOf(ctx, n.to),
      title: n.title,
      message: n.message,
      type: n.type,
      link: n.link,
      isRead: n.read ?? false,
      readAt: n.read ? ago(n.minsAgo - 30) : null,
      createdAt: ago(n.minsAgo),
    })),
  )
  ctx.summary.add("Notifications", "notifications (unread ones for every persona)", list.length)
}

// ── Attendance devices ───────────────────────────────────────────────────────

export async function seedDevices(ctx: DemoContext): Promise<void> {
  // STORED DISABLED, on purpose. An ENABLED device whose stored address does
  // not answer makes the attendance-sync job sweep the server's whole local
  // subnet for any Hikvision terminal (features/attendance/server/
  // device-resolver.ts) - on the production server that is the real office
  // LAN. Disabled devices are skipped by the job and still listed on the page.
  // TEST-NET addresses (RFC 5737) and documentation MACs (RFC 7042) besides.
  const ago = (mins: number) => new Date(ctx.now.getTime() - mins * 60_000)
  const devices = [
    {
      name: "Main Entrance",
      serial: "DEMO-DS-K1T341-0001",
      ip: "192.0.2.10",
      location: "Ground floor, reception",
      mac: "00:00:5e:00:53:01",
      sync: 22,
    },
    {
      name: "First Floor",
      serial: "DEMO-DS-K1T341-0002",
      ip: "192.0.2.11",
      location: "First floor, studio door",
      mac: "00:00:5e:00:53:02",
      sync: 22,
    },
  ]
  for (const d of devices) {
    await make(ctx, "hikvisionDevice", {
      name: d.name,
      deviceSerial: d.serial,
      ipAddress: d.ip,
      port: 8000,
      username: "admin",
      password: "demo-not-a-real-password",
      location: d.location,
      isActive: false,
      lastSyncAt: ago(d.sync),
      lastPushAt: ago(d.sync + 3),
      hardwareSerial: `${d.serial}-HW`,
      macAddress: d.mac,
      createdAt: at(addDays(ctx.today, -400), "12:00"),
    })
  }
  ctx.summary.add(
    "Attendance",
    "attendance devices (stored DISABLED - see seed notes)",
    devices.length,
  )
}

// ── AI connection ────────────────────────────────────────────────────────────

/** The AI apps' client ids. OAuthClient rows are PLATFORM-level and shared. */
const CLAUDE = "https://claude.ai/oauth/mcp-oauth-client-metadata"
const CLAUDE_CODE = "https://claude.ai/oauth/claude-code-client-metadata"

/**
 * Who has connected which AI app. GUIDE REQUIREMENT: Priya has one active
 * Claude connection, and Aarav's "Everyone in this workspace" list has rows.
 */
const CONNECTIONS: {
  who: string
  client: string
  daysAgo: number
  usedHoursAgo: number
  calls: [string, string | null, number][]
}[] = [
  {
    who: "priya",
    client: CLAUDE,
    daysAgo: 6,
    usedHoursAgo: 2,
    calls: [
      ["dnms_dashboard", null, 2],
      ["dnms_get", "GET /api/tasks?mine=true", 2],
      ["dnms_who_is_away", null, 26],
    ],
  },
  {
    who: "karthik",
    client: CLAUDE_CODE,
    daysAgo: 21,
    usedHoursAgo: 5,
    calls: [
      ["dnms_get", "GET /api/projects", 5],
      ["dnms_find_endpoints", null, 30],
    ],
  },
  {
    who: "neha",
    client: CLAUDE,
    daysAgo: 12,
    usedHoursAgo: 20,
    calls: [
      ["dnms_my_approvals", null, 20],
      ["dnms_who_is_away", null, 44],
    ],
  },
  {
    who: "rohan",
    client: CLAUDE,
    daysAgo: 3,
    usedHoursAgo: 28,
    calls: [["dnms_my_approvals", null, 28]],
  },
]

export async function seedAiConnection(ctx: DemoContext): Promise<void> {
  // Only tenant-scoped GRANTS are written. The OAuth clients are shared,
  // platform-level rows that already exist once anybody has connected the app;
  // they are never created here. No tokens: a connection lists, it cannot act.
  const clients = new Set(
    (
      await db.oAuthClient.findMany({
        where: { clientId: { in: [CLAUDE, CLAUDE_CODE] } },
        select: { clientId: true },
      })
    ).map((c) => c.clientId),
  )
  const origin = (
    process.env.APP_PUBLIC_ORIGIN ||
    process.env.NEXTAUTH_URL ||
    "https://dnms.digitallynext.com"
  ).replace(/\/$/, "")
  const hoursAgo = (h: number) => new Date(ctx.now.getTime() - h * 3_600_000)
  let made = 0
  for (const c of CONNECTIONS) {
    if (!clients.has(c.client)) {
      ctx.summary.skip(
        "AI connections",
        `${c.who}: the AI app ${c.client} is not registered on the platform yet`,
      )
      continue
    }
    const employeeId = idOf(ctx, c.who)
    const membership = await db.membership.findUnique({
      where: { employeeId },
      select: { id: true, userId: true },
    })
    if (!membership) throw new Error(`${c.who} has no membership`)
    const grantId = await make(ctx, "oAuthGrant", {
      membershipId: membership.id,
      userId: membership.userId,
      employeeId,
      clientId: c.client,
      scope: "hrms:read hrms:write",
      resource: `${origin}/api/mcp`,
      createdAt: at(addDays(ctx.today, -c.daysAgo), "16:10"),
      lastUsedAt: hoursAgo(c.usedHoursAgo),
    })
    await makeMany(
      ctx,
      "mcpToolCall",
      c.calls.map(([tool, target, h], i) => ({
        grantId,
        employeeId,
        tool,
        target,
        ok: true,
        status: 200,
        durationMs: 90 + i * 70,
        createdAt: hoursAgo(h),
      })),
    )
    made++
  }
  ctx.summary.add("AI connections", "active connections (grants only, no tokens)", made)
}
