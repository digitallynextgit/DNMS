// =============================================================================
// Clients and the client portal: the three client companies from the dataset,
// their contacts (portal logins on the demo domain, same DEMO_PASSWORD), the
// per-project grants that decide which portal modules each contact sees, and a
// little portal activity.
//
// Runs in two steps: seedClients() before projects (projects hang off a
// client), seedClientAccess() after (a grant points at a project).
// =============================================================================

import { db } from "@/server/db"
import { provisionIdentity } from "@/server/identity"
import { isDemoEmail } from "@/lib/demo"
import { DEMO_CLIENTS, DEMO_PROJECTS } from "@/features/help/demo/dataset"
import { DEMO_EMAIL_DOMAIN } from "@/lib/demo"
import { slugify } from "@/lib/utils"
import { addDays, at, idOf, make, makeMany, type DemoContext } from "./context"

const M = "Clients & portal"

const DETAILS: Record<
  string,
  { website: string; phone: string; address: string; taxId: string; notes: string; contact: string }
> = {
  sunrise: {
    website: "https://sunmeadowfoods.example.com",
    phone: "+91 98765 47001",
    address: "Plot 42, Sector 18, Udyog Vihar, Gurugram, Haryana 122015",
    taxId: "06AABCS1234D1Z5",
    notes:
      "Organic staples brand. Launching a millet range for the festive season; social + website retainer.",
    contact: "accounts.sunmeadow",
  },
  urbannest: {
    website: "https://urbannestrealty.example.com",
    phone: "+91 98765 47002",
    address: "Tower B, 9th Floor, Golf Course Extension Road, Gurugram, Haryana 122102",
    taxId: "06AACCU5678E1Z2",
    notes: "Residential projects in Gurugram and Noida. Website rebuild plus monthly SEO.",
    contact: "marketing.urbannest",
  },
  fitlife: {
    website: "https://fitlife.example.com",
    phone: "+91 98765 47003",
    address: "2nd Floor, Hauz Khas Village, New Delhi 110016",
    taxId: "07AADCF9012F1Z8",
    notes: "Fitness app and studios. Rebrand ahead of the app relaunch in January.",
    contact: "hello.fitlife",
  },
}

/** Portal contacts. `grant` = the module keys on their project (features/client-portal/modules.ts). */
const CONTACTS: {
  client: string
  name: string
  local: string
  phone: string
  grant: string[] | null
  lastLoginDaysAgo: number | null
}[] = [
  // GUIDE REQUIREMENT (project tools): Sunmeadow has two contacts - one with an
  // active grant (Content plan, Documents & assets, Calendars) who has signed
  // in, and one with no projects.
  {
    client: "sunrise",
    name: "Nandini Rao",
    local: "nandini.rao",
    phone: "+91 98765 48001",
    grant: ["plan", "documents", "calendars", "activity"],
    lastLoginDaysAgo: 1,
  },
  {
    client: "sunrise",
    name: "Aditya Bose",
    local: "aditya.bose",
    phone: "+91 98765 48002",
    grant: null,
    lastLoginDaysAgo: null,
  },
  {
    client: "urbannest",
    name: "Rajiv Khanna",
    local: "rajiv.khanna",
    phone: "+91 98765 48003",
    grant: ["plan", "calendars", "activity"],
    lastLoginDaysAgo: 4,
  },
  {
    client: "fitlife",
    name: "Shalini Menon",
    local: "shalini.menon",
    phone: "+91 98765 48004",
    grant: ["plan", "documents", "activity"],
    lastLoginDaysAgo: 9,
  },
]

export async function seedClients(ctx: DemoContext): Promise<void> {
  const aarav = idOf(ctx, "aarav")
  for (const [i, c] of DEMO_CLIENTS.entries()) {
    const d = DETAILS[c.key]!
    const owner = DEMO_PROJECTS.find((p) => p.client === c.key)?.accountManager ?? "aarav"
    ctx.client[c.key] = await make(ctx, "client", {
      name: c.name,
      code: `CL${String(i + 1).padStart(5, "0")}`,
      slug: slugify(c.name),
      status: "ACTIVE",
      industry: c.industry,
      website: d.website,
      email: `${d.contact}@${DEMO_EMAIL_DOMAIN}`,
      phone: d.phone,
      address: d.address,
      taxId: d.taxId,
      notes: d.notes,
      ownerId: idOf(ctx, owner),
      createdById: aarav,
      createdAt: at(addDays(ctx.today, -(220 - i * 70)), "12:00"),
    })
  }
  // A prospect, so the client book is not only paying accounts.
  ctx.client.prospect = await make(ctx, "client", {
    name: "Teapot Lane Cafes",
    code: "CL00004",
    slug: "teapot-lane-cafes",
    status: "PROSPECT",
    industry: "Food & Beverage",
    website: "https://teapotlane.example.com",
    email: `partnerships.teapotlane@${DEMO_EMAIL_DOMAIN}`,
    notes: "Pitch for social media retainer sent - follow up after Diwali.",
    ownerId: idOf(ctx, "ishaan"),
    createdById: idOf(ctx, "ishaan"),
    createdAt: at(addDays(ctx.today, -12), "16:30"),
  })
  ctx.summary.add(M, "clients (3 active + 1 prospect)", DEMO_CLIENTS.length + 1)
}

export async function seedClientAccess(ctx: DemoContext, passwordHash: string): Promise<void> {
  const contactId: Record<string, string> = {}
  for (const c of CONTACTS) {
    const email = `${c.local}@${DEMO_EMAIL_DOMAIN}`
    if (!isDemoEmail(email)) throw new Error(`Refusing non-demo email ${email}`)
    const project = DEMO_PROJECTS.find((p) => p.client === c.client)!
    const id = await make(ctx, "clientUser", {
      email,
      name: c.name,
      phone: c.phone,
      company: DEMO_CLIENTS.find((x) => x.key === c.client)!.name,
      clientId: ctx.client[c.client],
      passwordHash,
      mustChangePassword: false,
      isActive: true,
      lastLoginAt:
        c.lastLoginDaysAgo === null ? null : at(addDays(ctx.today, -c.lastLoginDaysAgo), "11:40"),
      createdById: idOf(ctx, project.accountManager),
      createdAt: at(addDays(ctx.today, -60), "15:00"),
    })
    contactId[c.local] = id
    await provisionIdentity({
      email,
      name: c.name,
      tenantId: ctx.tenantId,
      kind: "CLIENT",
      clientUserId: id,
      passwordHash,
      mustChangePassword: false,
    })
    if (c.grant) {
      await make(ctx, "clientProjectAccess", {
        clientUserId: id,
        projectId: ctx.project[project.key],
        modules: c.grant,
        status: "ACTIVE",
        grantedById: idOf(ctx, project.accountManager),
        createdAt: at(addDays(ctx.today, -59), "15:05"),
      })
    }
  }
  // Same reset as for staff: a re-run must not keep an old credential.
  const emails = CONTACTS.map((c) => `${c.local}@${DEMO_EMAIL_DOMAIN}`)
  await db.user.updateMany({
    where: { email: { in: emails } },
    data: { passwordHash, mustChangePassword: false, isActive: true, passwordChangedAt: ctx.now },
  })

  // Portal activity, in the words the portal writes it.
  const sunrise = ctx.project.sunrise
  const rows = [
    {
      who: "nandini.rao",
      action: "auth:signin",
      module: "auth",
      project: null,
      summary: "Signed in to the portal",
      daysAgo: 1,
      time: "11:40",
    },
    {
      who: "nandini.rao",
      action: "content_plan:view",
      module: "project",
      project: sunrise,
      summary: "Viewed the content plan for Sunmeadow Organics Launch",
      daysAgo: 1,
      time: "11:42",
    },
    {
      who: "nandini.rao",
      action: "calendar:view",
      module: "project",
      project: sunrise,
      summary: "Opened the Content calendar",
      daysAgo: 1,
      time: "11:46",
    },
    {
      who: "nandini.rao",
      action: "auth:signin",
      module: "auth",
      project: null,
      summary: "Signed in to the portal",
      daysAgo: 6,
      time: "18:05",
    },
    {
      who: "nandini.rao",
      action: "portal_document:download",
      module: "project",
      project: sunrise,
      summary: 'Downloaded "September Performance Report.xlsx"',
      daysAgo: 6,
      time: "18:09",
    },
    {
      who: "rajiv.khanna",
      action: "auth:signin",
      module: "auth",
      project: null,
      summary: "Signed in to the portal",
      daysAgo: 4,
      time: "10:15",
    },
    {
      who: "shalini.menon",
      action: "auth:signin",
      module: "auth",
      project: null,
      summary: "Signed in to the portal",
      daysAgo: 9,
      time: "20:30",
    },
  ]
  await makeMany(
    ctx,
    "clientActivityLog",
    rows.map((r) => ({
      clientUserId: contactId[r.who],
      projectId: r.project,
      action: r.action,
      module: r.module,
      summary: r.summary,
      ipAddress: "198.51.100.7", // documentation range (RFC 5737)
      createdAt: at(addDays(ctx.today, -r.daysAgo), r.time),
    })),
  )
  ctx.ref["client:nandini"] = contactId["nandini.rao"]!
  ctx.summary.add(M, "portal contacts (logins on the demo domain)", CONTACTS.length)
  ctx.summary.add(M, "project grants", CONTACTS.filter((c) => c.grant).length)
  ctx.summary.add(M, "portal activity rows", rows.length)
}
