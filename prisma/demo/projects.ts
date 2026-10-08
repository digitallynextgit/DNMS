// Demo projects: the four dataset projects with the standard six teams and every project tab. Tasks live in
// tasks.ts (they need the goals and requirements made here).
// Safety: production jobs read this database too, so nothing seeded here may wake one (monitors, SEO sites,
// renewals, the Meta integration and the mailer are all stored inert - see each one below).

import { randomUUID } from "node:crypto"
import { encrypt } from "@/lib/crypto"
import { DEMO_EMAIL_DOMAIN } from "@/lib/demo"
import { slugify } from "@/lib/utils"
import { DEMO_PROJECTS, demoPerson } from "@/features/help/demo/dataset"
import {
  addDays,
  at,
  dayKey,
  firstOfMonth,
  idOf,
  lastOfMonth,
  make,
  makeMany,
  mondayOf,
  shiftWorkingDays,
  type DemoContext,
} from "./context"

const M = "Projects"
export const TEAM_NAMES = ["WEB", "DESIGN", "MAP", "VIDEO", "AMG/SMO", "ADMIN"] as const

/** Team managers and members per project (one team per person per project). */
const TEAMS: Record<
  string,
  Partial<Record<(typeof TEAM_NAMES)[number], { manager: string | null; members: string[] }>>
> = {
  // Rohan is the Account Manager on Sunmeadow and UrbanNest and manages DESIGN there; Priya is a DESIGN member.
  sunrise: {
    // Guide requirement: WEB is the first staffed team.
    WEB: { manager: "karthik", members: ["rahul"] },
    DESIGN: { manager: "rohan", members: ["priya"] },
    MAP: { manager: "vikram", members: ["ananya"] },
    VIDEO: { manager: "arjun", members: [] },
    "AMG/SMO": { manager: "sneha", members: [] },
  },
  urbannest: {
    WEB: { manager: "karthik", members: [] },
    DESIGN: { manager: "rohan", members: ["priya"] },
    MAP: { manager: "vikram", members: ["ananya"] },
  },
  fitlife: {
    DESIGN: { manager: "rohan", members: ["priya", "rahul"] },
    VIDEO: { manager: "arjun", members: [] },
    "AMG/SMO": { manager: "sneha", members: [] },
  },
  internal: {
    WEB: { manager: "karthik", members: [] },
    DESIGN: { manager: "rohan", members: ["priya"] },
    MAP: { manager: "ananya", members: [] },
  },
}

const DETAILS: Record<
  string,
  { description: string; startDaysAgo: number; budget: number | null; priority: string }
> = {
  sunrise: {
    description:
      "Festive launch of the Sunmeadow Organics millet range: social media, launch reels, offer page and product copy. Retainer runs through March.",
    startDaysAgo: 75,
    budget: 1_800_000,
    priority: "HIGH",
  },
  urbannest: {
    description:
      "Website rebuild for UrbanNest Realty plus monthly technical and content SEO for project pages.",
    startDaysAgo: 200,
    budget: 950_000,
    priority: "MEDIUM",
  },
  fitlife: {
    description:
      "Brand refresh for FitLife ahead of the app relaunch: identity, app UI direction and launch content.",
    startDaysAgo: 20,
    budget: 1_200_000,
    priority: "HIGH",
  },
  internal: {
    description: "Our own website: case studies, careers page and a faster build.",
    startDaysAgo: 300,
    budget: null,
    priority: "LOW",
  },
}

const teamId = (ctx: DemoContext, project: string, team: string) => {
  const id = ctx.team[project]?.[team]
  if (!id) throw new Error(`No team ${team} on ${project}`)
  return id
}

async function seedProjectsAndTeams(ctx: DemoContext): Promise<void> {
  const activity: Record<string, unknown>[] = []
  let members = 0
  for (const [i, p] of DEMO_PROJECTS.entries()) {
    const d = DETAILS[p.key]!
    const start = addDays(ctx.today, -d.startDaysAgo)
    const created = at(start, "11:00")
    const projectId = await make(ctx, "project", {
      name: p.name,
      code: `DN${String(i + 1).padStart(5, "0")}`,
      slug: slugify(p.name),
      description: d.description,
      status: p.status,
      priority: d.priority,
      stage: p.stage,
      ownerId: idOf(ctx, p.accountManager),
      clientId: p.client ? ctx.client[p.client] : null,
      startDate: start,
      budget: d.budget,
      createdAt: created,
    })
    ctx.project[p.key] = projectId
    ctx.team[p.key] = {}

    for (const name of TEAM_NAMES) {
      const plan = TEAMS[p.key]?.[name]
      const id = await make(ctx, "projectTeam", {
        projectId,
        name,
        managerId: plan?.manager ? idOf(ctx, plan.manager) : null,
        createdAt: created,
      })
      ctx.team[p.key]![name] = id
      const people = plan ? [...(plan.manager ? [plan.manager] : []), ...plan.members] : []
      await makeMany(
        ctx,
        "projectTeamMember",
        people.map((who, j) => ({
          teamId: id,
          projectId,
          employeeId: idOf(ctx, who),
          joinedAt: at(addDays(start, j === 0 ? 0 : 1), "12:00"),
        })),
      )
      members += people.length
      for (const [j, who] of people.entries()) {
        activity.push({
          projectId,
          actorId: idOf(ctx, p.accountManager),
          type: "TEAM_MEMBER_ADDED",
          entityType: "ProjectTeam",
          entityId: id,
          meta: { teamName: name, employeeId: idOf(ctx, who) },
          createdAt: at(addDays(start, j === 0 ? 0 : 1), "12:00"),
        })
      }
    }
  }
  await makeMany(ctx, "projectActivity", activity)
  ctx.summary.add(M, "projects", DEMO_PROJECTS.length)
  ctx.summary.add(M, "teams (6 per project)", DEMO_PROJECTS.length * TEAM_NAMES.length)
  ctx.summary.add(M, "team memberships", members)
}

async function seedBrandFilesVault(ctx: DemoContext): Promise<void> {
  const rohan = idOf(ctx, "rohan")
  const sunrise = ctx.project.sunrise!
  const brands: {
    project: string
    brief: string
    overview: string
    objectives: unknown
    manifestation: unknown
    guidelines: unknown
  }[] = [
    {
      project: "sunrise",
      brief:
        "Sunmeadow Foods is launching a millet range (atta, poha, cookies) for health-conscious urban families. Position it as everyday nutrition, not diet food. Festive season first: Diwali hampers and gifting.",
      overview:
        "Audience: 25-45, metro India, cooks at home, reads labels. Competitors lean clinical; Sunmeadow should feel warm, family-first and Indian. Tone: friendly, confident, never preachy.",
      objectives: [
        {
          id: randomUUID(),
          platform: "Instagram",
          metric: "Followers",
          current: "18,400",
          target: "25,000",
          deadline: dayKey(addDays(ctx.today, 80)),
        },
        {
          id: randomUUID(),
          platform: "Website",
          metric: "Monthly sessions",
          current: "32,000",
          target: "50,000",
          deadline: dayKey(addDays(ctx.today, 110)),
        },
        {
          id: randomUUID(),
          platform: "YouTube",
          metric: "Reel views / month",
          current: "120K",
          target: "300K",
          deadline: dayKey(addDays(ctx.today, 60)),
        },
      ],
      manifestation: {
        AWARENESS: {
          social: "Festive reels with families cooking millet recipes; creator collaborations.",
          website: "Offer page and recipe hub.",
        },
        DEMAND: {
          social: "Hamper offers, countdown stories, retargeting ads.",
          website: "Product pages with reviews and bundles.",
        },
        THOUGHT: {
          social: "Nutritionist Q&A carousels.",
          website: "Blog: why millets, myth vs fact.",
        },
        COMMUNITY: {
          social: "#MyMilletPlate user recipes, weekly features.",
          website: "Recipe submissions.",
        },
      },
      guidelines: {
        colors: [
          { name: "Sunmeadow Orange", hex: "#F28C28" },
          { name: "Millet Gold", hex: "#E8C468" },
          { name: "Leaf Green", hex: "#3E7D3A" },
        ],
        fonts: "Headings: Gilroy Bold. Body: Inter Regular. Hindi: Mukta.",
        logoNotes:
          "Keep clear space equal to the sun mark. Never place the logo on busy photography.",
        uiux: "Warm photography, rounded cards, generous white space.",
      },
    },
    {
      project: "urbannest",
      brief:
        "Rebuild the website around project pages that rank and convert. Every page needs an enquiry form and site-visit booking.",
      overview:
        "Buyers research for months; trust signals (RERA numbers, possession dates, walkthroughs) decide the shortlist.",
      objectives: [
        {
          id: randomUUID(),
          platform: "Google",
          metric: "Money keywords in top 10",
          current: "6",
          target: "15",
          deadline: dayKey(addDays(ctx.today, 120)),
        },
        {
          id: randomUUID(),
          platform: "Website",
          metric: "Enquiries / month",
          current: "140",
          target: "250",
          deadline: dayKey(addDays(ctx.today, 120)),
        },
      ],
      manifestation: {
        AWARENESS: { social: "Locality guides.", website: "Project landing pages." },
        DEMAND: { social: "Site-visit offers.", website: "Enquiry and booking flows." },
        THOUGHT: { social: "Home-loan explainers.", website: "Buyer guides on the blog." },
        COMMUNITY: { social: "Resident stories.", website: "Testimonials." },
      },
      guidelines: {
        colors: [
          { name: "Nest Navy", hex: "#1F2A44" },
          { name: "Brick", hex: "#C0583A" },
        ],
        fonts: "Playfair Display for headings, Source Sans for body.",
        logoNotes: "Navy on light backgrounds only.",
        uiux: "Big photography, sticky enquiry button on mobile.",
      },
    },
  ]
  for (const b of brands) {
    await make(ctx, "projectBrand", {
      projectId: ctx.project[b.project],
      brief: b.brief,
      overview: b.overview,
      objectives: b.objectives,
      manifestation: b.manifestation,
      guidelines: b.guidelines,
      createdAt: at(addDays(ctx.today, -60), "12:00"),
    })
  }
  // The brand brief as an uploaded file - a row only (fake demo/ key).
  await make(ctx, "brandAsset", {
    projectId: sunrise,
    kind: "BRIEF",
    fileName: "Sunmeadow-Millet-Range-Brand-Brief.pdf",
    fileSize: 1_480_000,
    mimeType: "application/pdf",
    objectKey: `demo/projects/${sunrise}/brand/${randomUUID()}-brief.pdf`,
    uploadedById: rohan,
    createdAt: at(addDays(ctx.today, -70), "15:00"),
  })
  ctx.summary.add(M, "brand workspaces (+1 brief file row)", brands.length)

  // Repository: folders, files (rows only), links.
  const folder: Record<string, string> = {}
  for (const name of ["Brand", "Campaigns", "Reports"]) {
    folder[name] = await make(ctx, "projectFolder", {
      projectId: sunrise,
      name,
      createdById: rohan,
      createdAt: at(addDays(ctx.today, -70), "16:00"),
    })
  }
  const files = [
    {
      name: "Sunmeadow-Brand-Guidelines.pdf",
      folder: "Brand",
      category: "BRIEFS",
      tag: "BRAND",
      mime: "application/pdf",
      size: 4_200_000,
      by: "rohan",
      days: 68,
    },
    {
      name: "Diwali-Campaign-Brief.docx",
      folder: "Campaigns",
      category: "BRIEFS",
      tag: "CREATIVE",
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 96_000,
      by: "rohan",
      days: 30,
      shared: true,
    },
    {
      name: "Festive-Media-Plan.xlsx",
      folder: "Campaigns",
      category: "OTHER",
      tag: "REPORT",
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size: 58_000,
      by: "sneha",
      days: 25,
    },
    {
      name: "Product-Copy-Deck.docx",
      folder: "Campaigns",
      category: "REFERENCES",
      tag: "CREATIVE",
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 71_000,
      by: "ananya",
      days: 12,
    },
    {
      name: "September-Performance-Report.xlsx",
      folder: "Reports",
      category: "DELIVERABLES",
      tag: "REPORT",
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size: 132_000,
      by: "sneha",
      days: 6,
      shared: true,
    },
  ]
  await makeMany(
    ctx,
    "projectResource",
    files.map((f) => ({
      projectId: sunrise,
      category: f.category,
      tag: f.tag,
      fileName: f.name,
      fileSize: f.size,
      mimeType: f.mime,
      objectKey: `demo/projects/${sunrise}/files/${randomUUID()}-${f.name}`,
      uploadedById: idOf(ctx, f.by),
      isClientVisible: f.shared ?? false,
      sharedAt: f.shared ? at(addDays(ctx.today, -f.days + 1), "10:00") : null,
      reviewStatus: f.shared ? "APPROVED" : null,
      reviewedAt: f.shared ? at(addDays(ctx.today, -f.days + 2), "12:30") : null,
      reviewedByClientId: f.shared ? (ctx.ref["client:nandini"] ?? null) : null,
      folderId: folder[f.folder],
      createdAt: at(addDays(ctx.today, -f.days), "14:00"),
    })),
  )
  await makeMany(ctx, "projectLink", [
    {
      projectId: sunrise,
      folderId: folder.Campaigns,
      title: "Figma - Diwali campaign",
      url: "https://example.com/figma/sunmeadow-diwali",
      tag: "CREATIVE",
      description: "All festive statics, banners and reel covers.",
      createdById: idOf(ctx, "priya"),
      createdAt: at(addDays(ctx.today, -20), "11:00"),
    },
    {
      projectId: sunrise,
      folderId: null,
      title: "Live offer page",
      url: "https://sunmeadowfoods.example.com/diwali",
      tag: "OTHER",
      description: "Goes live with the hamper offer.",
      createdById: rohan,
      createdAt: at(addDays(ctx.today, -3), "18:00"),
    },
  ])
  ctx.summary.add(
    M,
    "Sunmeadow repository: folders / files (rows only) / links",
    3 + files.length + 2,
  )

  // Passwords, encrypted with lib/crypto the app's own way.
  const vault = [
    {
      project: "sunrise",
      label: "Instagram - @sunmeadoworganics",
      username: "sunmeadoworganics.demo",
      url: "https://www.instagram.com/",
      notes: "2FA codes go to Nandini's phone - ask before logging in.",
    },
    {
      project: "sunrise",
      label: "Meta Business Suite",
      username: `ads.sunmeadow@${DEMO_EMAIL_DOMAIN}`,
      url: "https://business.facebook.com/",
      notes: "Ad account: Sunmeadow Organics - Festive.",
    },
    {
      project: "sunrise",
      label: "Shopify admin",
      username: `store.sunmeadow@${DEMO_EMAIL_DOMAIN}`,
      url: "https://sunmeadowfoods.example.com/admin",
      notes: null,
    },
    {
      project: "sunrise",
      label: "Google Analytics",
      username: `analytics.sunmeadow@${DEMO_EMAIL_DOMAIN}`,
      url: "https://analytics.google.com/",
      notes: "Read-only access.",
    },
    {
      project: "urbannest",
      label: "WordPress admin",
      username: "urbannest-admin",
      url: "https://urbannestrealty.example.com/wp-admin",
      notes: null,
    },
    {
      project: "urbannest",
      label: "Hosting control panel",
      username: "urbannest",
      url: "https://hosting.example.com/",
      notes: "Business plan, renews in the spring.",
    },
  ]
  await makeMany(
    ctx,
    "projectPasswordEntry",
    vault.map((v) => ({
      projectId: ctx.project[v.project],
      label: v.label,
      username: v.username,
      // Fake, random - and never a real credential.
      encPassword: encrypt(`Demo-${randomUUID().slice(0, 12)}`),
      url: v.url,
      notes: v.notes,
      createdById: rohan,
      createdAt: at(addDays(ctx.today, -55), "12:00"),
    })),
  )
  ctx.summary.add(M, "password vault entries (encrypted)", vault.length)
}

async function seedRequirementsAndChats(ctx: DemoContext): Promise<void> {
  const reqs = [
    // Guide requirement: OPEN asked of Rohan (blocks Priya's task), IN_PROGRESS and overdue, PROVIDED with a note.
    {
      key: "req:photos",
      project: "sunrise",
      team: "DESIGN",
      by: "priya",
      from: "rohan",
      type: "CONTENT",
      status: "OPEN",
      title: "Product photos for the new millet range",
      details:
        "Need the final packshots (front + back) for atta, poha and cookies to finish the label mock-ups.",
      neededBy: 2,
      createdDaysAgo: 1,
    },
    {
      key: "req:meta",
      project: "sunrise",
      team: "AMG/SMO",
      by: "sneha",
      from: "rohan",
      type: "ACCESS",
      status: "IN_PROGRESS",
      title: "Meta Business Manager access for the festive ad account",
      details: "Partner access to the new ad account so we can launch the hamper campaign.",
      neededBy: -3,
      createdDaysAgo: 8,
    },
    {
      key: "req:fonts",
      project: "sunrise",
      team: "DESIGN",
      by: "priya",
      from: "rohan",
      type: "DESIGN",
      status: "PROVIDED",
      title: "Brand font licence files (Gilroy)",
      details: "Web + print licence for the brand font.",
      neededBy: -6,
      createdDaysAgo: 12,
      resolvedDaysAgo: 5,
      note: "Shared in Brand folder - the licence covers web and print.",
    },
    {
      key: "req:cpanel",
      project: "urbannest",
      team: "WEB",
      by: "karthik",
      from: "rohan",
      type: "CREDENTIAL",
      status: "OPEN",
      title: "Hosting control panel credentials",
      details: "Needed to point the new site at production.",
      neededBy: 4,
      createdDaysAgo: 2,
    },
    {
      key: "req:wireframe",
      project: "urbannest",
      team: "WEB",
      by: "karthik",
      from: "rohan",
      type: "APPROVAL",
      status: "CLOSED",
      title: "Homepage wireframe sign-off",
      details: null,
      neededBy: -20,
      createdDaysAgo: 30,
      resolvedDaysAgo: 22,
      note: "Approved on the review call.",
    },
    {
      key: "req:guidelines",
      project: "fitlife",
      team: "DESIGN",
      by: "priya",
      from: "aarav",
      type: "DOCUMENT",
      status: "OPEN",
      title: "Old brand guidelines PDF from the previous agency",
      details: null,
      neededBy: 5,
      createdDaysAgo: 3,
    },
  ]
  const activity: Record<string, unknown>[] = []
  for (const r of reqs) {
    const created = at(addDays(ctx.today, -r.createdDaysAgo), "12:10")
    const resolved =
      r.resolvedDaysAgo !== undefined ? at(addDays(ctx.today, -r.resolvedDaysAgo), "16:40") : null
    ctx.ref[r.key] = await make(ctx, "projectRequirement", {
      projectId: ctx.project[r.project],
      teamId: teamId(ctx, r.project, r.team),
      raisedById: idOf(ctx, r.by),
      requestedFromId: idOf(ctx, r.from),
      type: r.type,
      status: r.status,
      title: r.title,
      details: r.details,
      neededBy: addDays(ctx.today, r.neededBy),
      resolvedAt: resolved,
      resolutionNote: r.note ?? null,
      // Already nudged today, so the daily overdue reminder stays quiet.
      remindedAt: r.neededBy < 0 && !resolved ? ctx.now : null,
      createdAt: created,
    })
    activity.push({
      projectId: ctx.project[r.project],
      actorId: idOf(ctx, r.by),
      type: "REQUIREMENT_RAISED",
      entityType: "ProjectRequirement",
      entityId: ctx.ref[r.key],
      meta: {
        title: r.title,
        type: r.type,
        requestedFrom: r.from === "rohan" ? "Rohan Verma" : "Aarav Mehta",
      },
      createdAt: created,
    })
    if (r.status !== "OPEN") {
      activity.push({
        projectId: ctx.project[r.project],
        actorId: idOf(ctx, r.from),
        type: "REQUIREMENT_STATUS_CHANGED",
        entityType: "ProjectRequirement",
        entityId: ctx.ref[r.key],
        meta: { title: r.title, from: "OPEN", to: r.status },
        createdAt: resolved ?? at(addDays(ctx.today, -r.createdDaysAgo + 1), "10:00"),
      })
    }
  }
  ctx.summary.add(M, "requirements", reqs.length)

  const ago = (mins: number) => new Date(ctx.now.getTime() - mins * 60_000)
  type Thread = {
    project: string
    title: string
    by: string
    content: string
    mentions?: string[]
    pinned?: boolean
    minsAgo: number
    replies: { by: string; content: string; minsAgo: number; mentions?: string[] }[]
    reactions?: { on: number | "root"; by: string; emoji: string }[]
  }
  const threads: Thread[] = [
    {
      project: "sunrise",
      title: "Launch plan",
      by: "rohan",
      content:
        "Team, here's the plan for launch week:\n1. Offer page + website banner live Thursday\n2. 6 hamper statics and 2 reels across the week\n3. Blog on millet recipes on Friday\n\n@Priya Sharma please own the banner and statics - client review on Thursday at 4.",
      mentions: ["priya"],
      pinned: true,
      minsAgo: 4400,
      replies: [
        {
          by: "priya",
          content: "On it. Banner draft by tomorrow noon, statics from Wednesday.",
          minsAgo: 4370,
        },
        {
          by: "sneha",
          content:
            "I'll schedule everything once approved - need the final files by Thursday 6 PM.",
          minsAgo: 4300,
        },
        {
          by: "arjun",
          content: "Reels: shooting the hamper unboxing on Tuesday. Rough cut Wednesday.",
          minsAgo: 4200,
        },
        {
          by: "ananya",
          content: "Blog draft is ready for review. @Rohan Verma can you check the recipe list?",
          minsAgo: 2900,
          mentions: ["rohan"],
        },
        {
          by: "rohan",
          content: "Looks good. Client approved the banner today - great work everyone!",
          minsAgo: 170,
        },
      ],
      reactions: [
        { on: "root", by: "priya", emoji: "👍" },
        { on: 4, by: "priya", emoji: "🎉" },
        { on: 4, by: "sneha", emoji: "🎉" },
      ],
    },
    {
      project: "sunrise",
      title: "Weekly status",
      by: "rohan",
      content:
        "Quick status for this week - please reply with what's done, what's next and anything blocking you.",
      minsAgo: 1500,
      replies: [
        {
          by: "sneha",
          content:
            "Done: 8 festive posts scheduled. Next: hamper stories. Blocked: Meta ad account access.",
          minsAgo: 1440,
        },
        {
          by: "vikram",
          content: "Done: product page keywords. Next: internal links on the recipe hub.",
          minsAgo: 1400,
        },
        {
          by: "priya",
          content:
            "Done: banner v2, carousel. Next: hamper statics. Blocked: packshots for the label mock-ups.",
          minsAgo: 95,
        },
      ],
    },
    {
      project: "urbannest",
      title: "Homepage go-live checklist",
      by: "karthik",
      content:
        "Staging is ready. Before go-live: redirects, sitemap, form tests and the cPanel access from the client.",
      minsAgo: 3000,
      replies: [
        { by: "vikram", content: "Redirect map uploaded - 212 old URLs mapped.", minsAgo: 2800 },
        { by: "rohan", content: "Chasing the cPanel access with Rajiv today.", minsAgo: 2700 },
      ],
    },
  ]
  let replies = 0
  for (const t of threads) {
    const projectId = ctx.project[t.project]!
    const rootId = randomUUID()
    await make(ctx, "projectMessage", {
      id: rootId,
      projectId,
      authorId: idOf(ctx, t.by),
      title: t.title,
      content: t.content,
      isPinned: t.pinned ?? false,
      mentionedIds: (t.mentions ?? []).map((k) => idOf(ctx, k)),
      createdAt: ago(t.minsAgo),
      // The Chats tab shows "edited" when updatedAt !== createdAt, and a reply does not touch its thread.
      updatedAt: ago(t.minsAgo),
    })
    const replyIds = t.replies.map(() => randomUUID())
    await makeMany(
      ctx,
      "projectMessageReply",
      t.replies.map((r, i) => ({
        id: replyIds[i],
        messageId: rootId,
        authorId: idOf(ctx, r.by),
        content: r.content,
        mentionedIds: (r.mentions ?? []).map((k) => idOf(ctx, k)),
        createdAt: ago(r.minsAgo),
        updatedAt: ago(r.minsAgo), // never edited (see the thread above)
      })),
    )
    replies += t.replies.length
    await makeMany(
      ctx,
      "projectMessageReaction",
      (t.reactions ?? []).map((r) => ({
        messageId: r.on === "root" ? rootId : null,
        replyId: r.on === "root" ? null : replyIds[r.on],
        employeeId: idOf(ctx, r.by),
        emoji: r.emoji,
        createdAt: ago((r.on === "root" ? t.minsAgo : t.replies[r.on]!.minsAgo) - 3),
      })),
    )
    activity.push({
      projectId,
      actorId: idOf(ctx, t.by),
      type: "MESSAGE_POSTED",
      entityType: "ProjectMessage",
      entityId: rootId,
      meta: { title: t.title },
      createdAt: ago(t.minsAgo),
    })
  }
  // Read markers: Rohan is up to date; Priya has not seen the latest replies.
  await makeMany(ctx, "projectMessageRead", [
    { projectId: ctx.project.sunrise, employeeId: idOf(ctx, "rohan"), lastSeenAt: ago(60) },
    { projectId: ctx.project.sunrise, employeeId: idOf(ctx, "priya"), lastSeenAt: ago(1450) },
    { projectId: ctx.project.sunrise, employeeId: idOf(ctx, "sneha"), lastSeenAt: ago(300) },
    { projectId: ctx.project.urbannest, employeeId: idOf(ctx, "rohan"), lastSeenAt: ago(2650) },
  ])
  await makeMany(ctx, "projectActivity", activity)
  ctx.summary.add(M, "project chat threads", threads.length)
  ctx.summary.add(M, "project chat replies", replies)
}

async function seedGoals(ctx: DemoContext): Promise<void> {
  type Goal = {
    key: string
    project: string
    parent?: string
    title: string
    description?: string
    status: string
    progress: number
    target: number
    tags: string[]
    owner: string
    reason?: string
    sort: number
  }
  // Guide requirement: Sunmeadow has three goals - one with two sub-goals, one AT_RISK with a reason, one with a target.
  const goals: Goal[] = [
    {
      key: "goal:launch",
      project: "sunrise",
      title: "Launch the millet range online",
      description: "Everything live for the festive launch: website, social, content.",
      status: "IN_PROGRESS",
      progress: 0,
      target: 45,
      tags: ["launch", "q4"],
      owner: "rohan",
      sort: 0,
    },
    {
      key: "goal:launch-social",
      project: "sunrise",
      parent: "goal:launch",
      title: "Festive creatives live on Instagram",
      status: "IN_PROGRESS",
      progress: 50,
      target: 10,
      tags: ["social"],
      owner: "rohan",
      sort: 0,
    },
    {
      key: "goal:launch-web",
      project: "sunrise",
      parent: "goal:launch",
      title: "Offer page live on the website",
      status: "DONE",
      progress: 100,
      target: -2,
      tags: ["website"],
      owner: "rohan",
      sort: 1,
    },
    {
      key: "goal:followers",
      project: "sunrise",
      title: "Grow Instagram to 25k followers",
      description: "From 18.4k at kickoff.",
      status: "AT_RISK",
      progress: 40,
      target: 80,
      tags: ["growth", "monthly"],
      owner: "sneha",
      reason:
        "Reach dropped 18% after the algorithm change - boosting two reels a week to recover.",
      sort: 1,
    },
    {
      key: "goal:reels",
      project: "sunrise",
      title: "12 festive reels",
      description: "Hamper, recipe and behind-the-scenes reels across the season.",
      status: "IN_PROGRESS",
      progress: 0,
      target: 40,
      tags: ["video", "festive"],
      owner: "arjun",
      sort: 2,
    },
    {
      key: "goal:rankings",
      project: "urbannest",
      title: "Top-10 rankings for 15 money keywords",
      status: "IN_PROGRESS",
      progress: 60,
      target: 120,
      tags: ["seo", "quarterly"],
      owner: "vikram",
      sort: 0,
    },
    {
      key: "goal:site",
      project: "urbannest",
      title: "New website live",
      status: "DONE",
      progress: 100,
      target: -30,
      tags: ["website"],
      owner: "karthik",
      sort: 1,
    },
    {
      key: "goal:rebrand",
      project: "fitlife",
      title: "Rebrand approved by the client",
      status: "NOT_STARTED",
      progress: 0,
      target: 70,
      tags: ["rebrand"],
      owner: "aarav",
      sort: 0,
    },
  ]
  const events: Record<string, unknown>[] = []
  for (const g of goals) {
    const created = at(addDays(ctx.today, -40), "12:00")
    ctx.ref[g.key] = await make(ctx, "projectGoal", {
      projectId: ctx.project[g.project],
      parentId: g.parent ? ctx.ref[g.parent] : null,
      title: g.title,
      description: g.description ?? null,
      status: g.status,
      progress: g.progress,
      targetDate: addDays(ctx.today, g.target),
      sortOrder: g.sort,
      tags: g.tags,
      statusReason: g.reason ?? null,
      createdById: idOf(ctx, "rohan"),
      ownerId: idOf(ctx, g.owner),
      createdAt: created,
    })
    events.push({
      goalId: ctx.ref[g.key],
      type: "CREATED",
      toStatus: "NOT_STARTED",
      actorId: idOf(ctx, "rohan"),
      createdAt: created,
    })
    if (g.status !== "NOT_STARTED") {
      events.push({
        goalId: ctx.ref[g.key],
        type: "STATUS_CHANGED",
        fromStatus: "NOT_STARTED",
        toStatus: g.status,
        reason: g.reason ?? null,
        actorId: idOf(ctx, g.owner),
        createdAt: at(addDays(ctx.today, g.status === "AT_RISK" ? -4 : -20), "15:00"),
      })
    }
  }
  await makeMany(ctx, "projectGoalEvent", events)
  // "12 festive reels" reads its progress off delivered Reels.
  await make(ctx, "projectGoalTarget", {
    goalId: ctx.ref["goal:reels"],
    deliverableType: "Reel",
    quantity: 12,
    periodStart: firstOfMonth(ctx.today, -1),
    periodEnd: addDays(ctx.today, 40),
    createdById: idOf(ctx, "rohan"),
  })
  ctx.summary.add(M, "goals (incl. sub-goals)", goals.length)
}

async function seedDeliverables(ctx: DemoContext): Promise<void> {
  const mon = mondayOf(ctx.today)
  const week = (k: number) => ({ start: addDays(mon, 7 * k), end: addDays(mon, 7 * k + 4) })
  const wd = (n: number) => shiftWorkingDays(ctx, ctx.today, n)
  type D = {
    project: string
    team: string
    who: string | null
    k: number
    type: string
    title: string
    qty: number
    status: string
    done?: number
    completed?: Date
    reason?: string
    revisions?: number
    link?: string
    goal?: string
  }
  // Guide requirement: Sunmeadow's newest week is THIS week, with an unassigned DESIGN "To do", Priya's To do /
  // In progress and a "Made" one with a link; older weeks hold Accepted and "Awaiting revision". Priya also has
  // an overdue one and items on UrbanNest and FitLife.
  const rows: D[] = [
    // Sunmeadow - this week
    {
      project: "sunrise",
      team: "DESIGN",
      who: null,
      k: 0,
      type: "Creative",
      title: "Diwali hamper statics",
      qty: 6,
      status: "PLANNED",
    },
    {
      project: "sunrise",
      team: "DESIGN",
      who: "priya",
      k: 0,
      type: "Creative",
      title: "Product label mock-ups",
      qty: 3,
      status: "IN_PROGRESS",
      done: 1,
    },
    {
      project: "sunrise",
      team: "DESIGN",
      who: "priya",
      k: 0,
      type: "Creative",
      title: "Reel cover templates",
      qty: 3,
      status: "PLANNED",
    },
    {
      project: "sunrise",
      team: "DESIGN",
      who: "priya",
      k: 0,
      type: "Creative",
      title: "Website banner - Diwali offer",
      qty: 1,
      status: "DELIVERED",
      completed: wd(-2),
      link: "https://example.com/sunmeadow/offer-banner-v2",
      goal: "goal:launch-web",
    },
    {
      project: "sunrise",
      team: "VIDEO",
      who: "arjun",
      k: 0,
      type: "Reel",
      title: "Diwali hamper reels",
      qty: 2,
      status: "IN_PROGRESS",
      goal: "goal:reels",
    },
    {
      project: "sunrise",
      team: "AMG/SMO",
      who: "sneha",
      k: 0,
      type: "Post",
      title: "Festive posts scheduled",
      qty: 8,
      status: "DELIVERED",
      completed: wd(-1),
      link: "https://example.com/sunmeadow/schedule-week",
    },
    {
      project: "sunrise",
      team: "MAP",
      who: "ananya",
      k: 0,
      type: "Blog",
      title: "Blog: 5 millet recipes for Diwali",
      qty: 1,
      status: "PLANNED",
    },
    {
      project: "sunrise",
      team: "WEB",
      who: "karthik",
      k: 0,
      type: "Page",
      title: "Diwali offer page",
      qty: 1,
      status: "DELIVERED",
      completed: wd(-2),
      link: "https://sunmeadowfoods.example.com/diwali",
      goal: "goal:launch-web",
    },
    // Sunmeadow - last week
    {
      project: "sunrise",
      team: "DESIGN",
      who: "priya",
      k: -1,
      type: "Creative",
      title: "Carousel: millet benefits (5 slides)",
      qty: 1,
      status: "IN_PROGRESS",
    },
    {
      project: "sunrise",
      team: "DESIGN",
      who: "priya",
      k: -1,
      type: "Creative",
      title: "Launch teaser thumbnail",
      qty: 1,
      status: "REJECTED",
      completed: addDays(week(-1).end, -1),
      reason: "Client wants the logo bigger and a warmer background.",
      revisions: 1,
      link: "https://example.com/sunmeadow/teaser-thumb-v1",
    },
    {
      project: "sunrise",
      team: "DESIGN",
      who: "priya",
      k: -1,
      type: "Creative",
      title: "Instagram statics - set 1",
      qty: 4,
      status: "ACCEPTED",
      completed: addDays(week(-1).start, 2),
      link: "https://example.com/sunmeadow/statics-set-1",
    },
    {
      project: "sunrise",
      team: "VIDEO",
      who: "arjun",
      k: -1,
      type: "Reel",
      title: "Launch teaser reel",
      qty: 1,
      status: "ACCEPTED",
      completed: addDays(week(-1).start, 3),
      link: "https://example.com/sunmeadow/teaser-reel",
      goal: "goal:reels",
    },
    {
      project: "sunrise",
      team: "AMG/SMO",
      who: "sneha",
      k: -1,
      type: "Post",
      title: "Weekly posts",
      qty: 6,
      status: "DELIVERED",
      completed: week(-1).end,
      link: "https://example.com/sunmeadow/posts-wk",
    },
    {
      project: "sunrise",
      team: "MAP",
      who: "ananya",
      k: -1,
      type: "Page",
      title: "Product page copy (4 SKUs)",
      qty: 4,
      status: "ACCEPTED",
      completed: addDays(week(-1).start, 1),
      link: "https://example.com/sunmeadow/product-copy",
    },
    // Sunmeadow - two and three weeks ago
    {
      project: "sunrise",
      team: "DESIGN",
      who: "priya",
      k: -2,
      type: "Creative",
      title: "Launch key visual",
      qty: 1,
      status: "ACCEPTED",
      completed: addDays(week(-2).start, 2),
      link: "https://example.com/sunmeadow/key-visual",
    },
    {
      project: "sunrise",
      team: "VIDEO",
      who: "arjun",
      k: -2,
      type: "Reel",
      title: "Behind-the-scenes reels",
      qty: 2,
      status: "ACCEPTED",
      completed: addDays(week(-2).start, 3),
      link: "https://example.com/sunmeadow/bts",
      goal: "goal:reels",
    },
    {
      project: "sunrise",
      team: "MAP",
      who: "vikram",
      k: -2,
      type: "Report",
      title: "Keyword map for product pages",
      qty: 1,
      status: "ACCEPTED",
      completed: addDays(week(-2).start, 1),
      link: "https://example.com/sunmeadow/keyword-map",
    },
    {
      project: "sunrise",
      team: "AMG/SMO",
      who: "sneha",
      k: -2,
      type: "Report",
      title: "Influencer shortlist",
      qty: 1,
      status: "REJECTED",
      completed: addDays(week(-2).start, 4),
      reason: "Budget changed - revise the list to micro-creators only.",
      revisions: 1,
    },
    {
      project: "sunrise",
      team: "DESIGN",
      who: "priya",
      k: -3,
      type: "Creative",
      title: "Packaging label - millet atta",
      qty: 1,
      status: "ACCEPTED",
      completed: addDays(week(-3).start, 3),
      link: "https://example.com/sunmeadow/label-atta",
    },
    {
      project: "sunrise",
      team: "VIDEO",
      who: "arjun",
      k: -3,
      type: "Reel",
      title: "Product reel - atta",
      qty: 1,
      status: "ACCEPTED",
      completed: addDays(week(-3).start, 4),
      link: "https://example.com/sunmeadow/reel-atta",
      goal: "goal:reels",
    },
    {
      project: "sunrise",
      team: "AMG/SMO",
      who: "sneha",
      k: -3,
      type: "Post",
      title: "X (Twitter) launch thread",
      qty: 1,
      status: "DISCARDED",
      reason: "Client dropped X from the plan.",
    },
    // UrbanNest
    {
      project: "urbannest",
      team: "WEB",
      who: "karthik",
      k: 0,
      type: "Page",
      title: "Property listing pages",
      qty: 10,
      status: "IN_PROGRESS",
      done: 6,
    },
    {
      project: "urbannest",
      team: "MAP",
      who: "vikram",
      k: 0,
      type: "Report",
      title: "Technical SEO fixes - batch 2",
      qty: 1,
      status: "PLANNED",
    },
    {
      project: "urbannest",
      team: "MAP",
      who: "ananya",
      k: 0,
      type: "Blog",
      title: "Blog: home loan checklist",
      qty: 1,
      status: "DELIVERED",
      completed: wd(-1),
      link: "https://example.com/urbannest/blog-home-loan",
    },
    {
      project: "urbannest",
      team: "DESIGN",
      who: "priya",
      k: 0,
      type: "Creative",
      title: "Listing page icons",
      qty: 12,
      status: "DELIVERED",
      completed: wd(-2),
      link: "https://example.com/urbannest/icons",
    },
    {
      project: "urbannest",
      team: "WEB",
      who: "karthik",
      k: -1,
      type: "Page",
      title: "Homepage redesign",
      qty: 1,
      status: "ACCEPTED",
      completed: addDays(week(-1).start, 3),
      link: "https://urbannestrealty.example.com/",
    },
    {
      project: "urbannest",
      team: "MAP",
      who: "vikram",
      k: -1,
      type: "Report",
      title: "Monthly SEO report",
      qty: 1,
      status: "ACCEPTED",
      completed: addDays(week(-1).start, 1),
      link: "https://example.com/urbannest/seo-report",
    },
    {
      project: "urbannest",
      team: "DESIGN",
      who: "priya",
      k: -1,
      type: "Creative",
      title: "Hero banner set",
      qty: 3,
      status: "ACCEPTED",
      completed: addDays(week(-1).start, 2),
      link: "https://example.com/urbannest/hero-banners",
    },
    // FitLife
    {
      project: "fitlife",
      team: "DESIGN",
      who: "priya",
      k: 0,
      type: "Creative",
      title: "Moodboard v1",
      qty: 1,
      status: "STUCK",
      reason: "Waiting for the brand questionnaire from FitLife.",
    },
    {
      project: "fitlife",
      team: "DESIGN",
      who: "rahul",
      k: 0,
      type: "Creative",
      title: "Icon style exploration",
      qty: 1,
      status: "PLANNED",
    },
    {
      project: "fitlife",
      team: "VIDEO",
      who: "arjun",
      k: 0,
      type: "Video",
      title: "Studio walkthrough video",
      qty: 1,
      status: "PLANNED",
    },
  ]
  const managerOf = (project: string, team: string) => {
    const t = TEAMS[project]?.[team as (typeof TEAM_NAMES)[number]]
    return t?.manager ?? (project === "fitlife" ? "aarav" : "rohan")
  }
  const delivRows: Record<string, unknown>[] = []
  const eventRows: Record<string, unknown>[] = []
  const activity: Record<string, unknown>[] = []
  for (const d of rows) {
    const id = randomUUID()
    const w = week(d.k)
    const made = d.status === "DELIVERED" || d.status === "ACCEPTED"
    const logger = idOf(ctx, managerOf(d.project, d.team))
    const created = at(addDays(w.start, -3), "11:30")
    const completed = d.completed && d.completed > ctx.today ? ctx.today : d.completed
    delivRows.push({
      id,
      projectId: ctx.project[d.project],
      teamId: teamId(ctx, d.project, d.team),
      employeeId: d.who ? idOf(ctx, d.who) : null,
      loggedById: logger,
      type: d.type,
      title: d.title,
      quantity: d.qty,
      deliveredQuantity: made ? d.qty : (d.done ?? 0),
      status: d.status,
      statusReason: d.reason ?? null,
      dueOn: w.end,
      periodStart: w.start,
      periodEnd: w.end,
      goalId: d.goal ? ctx.ref[d.goal] : null,
      startedOn: d.status === "PLANNED" ? null : w.start,
      completedOn: completed ?? null,
      revisionCount: d.revisions ?? 0,
      acceptedAt: d.status === "ACCEPTED" && completed ? at(addDays(completed, 1), "12:00") : null,
      acceptedById: d.status === "ACCEPTED" ? logger : null,
      links: d.link ? [d.link] : [],
      verifiedById: made ? logger : null,
      verifiedAt: made && completed ? at(completed, "18:00") : null,
      createdAt: created,
    })
    eventRows.push({
      deliverableId: id,
      type: "CREATED",
      toStatus: "PLANNED",
      actorId: logger,
      createdAt: created,
    })
    if (d.status !== "PLANNED") {
      eventRows.push({
        deliverableId: id,
        type: "STATUS_CHANGED",
        fromStatus: "PLANNED",
        toStatus: d.status,
        reason: d.reason ?? null,
        actorId: d.who ? idOf(ctx, d.who) : logger,
        createdAt: completed ? at(completed, "17:00") : at(w.start, "15:00"),
      })
    }
    if (made || d.status === "REJECTED") {
      activity.push({
        projectId: ctx.project[d.project],
        actorId: d.who ? idOf(ctx, d.who) : logger,
        type: "DELIVERABLE_LOGGED",
        entityType: "ProjectDeliverable",
        entityId: id,
        meta: {
          title: d.title,
          type: d.type,
          quantity: d.qty,
          status: d.status,
          employeeName: d.who
            ? `${demoPerson(d.who).firstName} ${demoPerson(d.who).lastName}`
            : null,
          completedOn: completed ? dayKey(completed) : null,
          dueOn: dayKey(w.end),
        },
        createdAt: completed ? at(completed, "17:00") : created,
      })
    }
  }
  await makeMany(ctx, "projectDeliverable", delivRows)
  await makeMany(ctx, "projectDeliverableEvent", eventRows)
  await makeMany(ctx, "projectActivity", activity)
  ctx.summary.add(M, "deliverables (this week + 3 weeks back)", delivRows.length)
}

async function seedCalendars(ctx: DemoContext): Promise<void> {
  const sunrise = ctx.project.sunrise!
  const sneha = idOf(ctx, "sneha")
  const people = {
    sneha,
    priya: idOf(ctx, "priya"),
    arjun: idOf(ctx, "arjun"),
    ananya: idOf(ctx, "ananya"),
  }
  const COLUMNS = [
    { name: "Date", type: "DATE", width: 120 },
    {
      name: "Platform",
      type: "SELECT",
      width: 120,
      options: ["Instagram", "Facebook", "LinkedIn", "YouTube", "Blog"],
    },
    {
      name: "Format",
      type: "SELECT",
      width: 110,
      options: ["Reel", "Static", "Carousel", "Story", "Article"],
    },
    { name: "Topic", type: "TEXT", width: 220 },
    { name: "Caption", type: "LONG_TEXT", width: 320 },
    { name: "Owner", type: "PERSON", width: 140 },
    { name: "Link", type: "URL", width: 200 },
    { name: "Approved", type: "CHECKBOX", width: 90 },
  ] as const
  const TOPICS = [
    [
      "Reel",
      "Diwali hamper unboxing",
      "Unbox the goodness this Diwali 🪔 Our millet hamper has everything for a healthier festive table.",
    ],
    [
      "Static",
      "Millet atta launch",
      "Meet the atta your rotis have been waiting for. Now with 100% millet.",
    ],
    [
      "Carousel",
      "5 benefits of millets",
      "Swipe for 5 reasons your grandmother was right about millets 👵",
    ],
    ["Story", "Hamper countdown", "Only 3 days left to pre-order the festive hamper!"],
    [
      "Reel",
      "Recipe: millet laddoo",
      "Two ingredients, ten minutes, zero guilt. Save this for Diwali.",
    ],
    ["Static", "Customer review", "\"My kids didn't even notice it's healthy\" - Ritu from Pune"],
    ["Carousel", "Millet myths vs facts", "Myth: millets are hard to cook. Fact: swipe ➡️"],
    ["Reel", "Behind the scenes", "How a Sunmeadow hamper is packed, from farm to your door."],
    ["Static", "Festive offer", "Flat 20% off on hampers till Diwali. Link in bio."],
    ["Story", "Poll: favourite sweet", "Kaju katli or laddoo? Vote now!"],
  ] as const
  const owners = [
    people.arjun,
    people.priya,
    people.priya,
    people.sneha,
    people.arjun,
    people.priya,
    people.priya,
    people.arjun,
    people.priya,
    people.sneha,
  ]

  for (const delta of [-1, 0]) {
    const month = firstOfMonth(ctx.today, delta)
    const monthEnd = lastOfMonth(ctx.today, delta)
    const current = delta === 0
    const workbookId = randomUUID()
    await make(ctx, "projectWorkbook", {
      id: workbookId,
      projectId: sunrise,
      name: "Content calendar",
      periodMonth: month,
      position: 0,
      createdById: sneha,
      assignedToId: sneha,
      isClientVisible: false,
      createdAt: at(addDays(month, -6), "11:00"),
    })
    for (const [tabIndex, tab] of (["Instagram", "Blog & YouTube"] as const).entries()) {
      const sheetId = randomUUID()
      await make(ctx, "projectSheet", {
        id: sheetId,
        projectId: sunrise,
        workbookId,
        name: tab,
        position: tabIndex,
        createdById: sneha,
        createdAt: at(addDays(month, -6), "11:05"),
      })
      const colIds = COLUMNS.map(() => randomUUID())
      await makeMany(
        ctx,
        "projectSheetColumn",
        COLUMNS.map((c, i) => ({
          id: colIds[i],
          sheetId,
          name: c.name,
          type: c.type,
          position: i,
          width: c.width,
          options: "options" in c ? [...c.options] : undefined,
        })),
      )
      const rows =
        tab === "Instagram"
          ? TOPICS.map((t, i) => ({
              date: addDays(month, 1 + i * 3),
              platform: "Instagram",
              format: t[0],
              topic: t[1],
              caption: t[2],
              owner: owners[i]!,
              i,
            }))
          : [
              {
                date: addDays(month, 4),
                platform: "Blog",
                format: "Article",
                topic: "5 millet recipes for Diwali",
                caption: "Long-form recipe post with step photos.",
                owner: people.ananya,
                i: 0,
              },
              {
                date: addDays(month, 11),
                platform: "YouTube",
                format: "Reel",
                topic: "Millet laddoo recipe (Short)",
                caption: "Vertical cut of the laddoo reel.",
                owner: people.arjun,
                i: 1,
              },
              {
                date: addDays(month, 16),
                platform: "Blog",
                format: "Article",
                topic: "Why millets: a beginner's guide",
                caption: "SEO article targeting 'benefits of millets'.",
                owner: people.ananya,
                i: 2,
              },
              {
                date: addDays(month, 22),
                platform: "YouTube",
                format: "Reel",
                topic: "Hamper unboxing (Short)",
                caption: "Reuse of the Instagram reel.",
                owner: people.arjun,
                i: 3,
              },
              {
                date: addDays(month, 26),
                platform: "LinkedIn",
                format: "Article",
                topic: "Founder's note: why we bet on millets",
                caption: "Ghost-written for the Sunmeadow founder.",
                owner: people.ananya,
                i: 4,
              },
            ]
      await makeMany(
        ctx,
        "projectSheetRow",
        rows.map((r, pos) => {
          const past = !current || r.date < ctx.today
          return {
            sheetId,
            position: pos,
            cells: {
              [colIds[0]!]: dayKey(r.date > monthEnd ? monthEnd : r.date),
              [colIds[1]!]: r.platform,
              [colIds[2]!]: r.format,
              [colIds[3]!]: r.topic,
              [colIds[4]!]: r.caption,
              [colIds[5]!]: r.owner,
              [colIds[6]!]: past
                ? `https://example.com/sunmeadow/post-${dayKey(r.date)}-${r.i}`
                : null,
              [colIds[7]!]: past,
            },
            createdById: sneha,
            createdAt: at(addDays(month, -5), "12:00"),
          }
        }),
      )
      await make(ctx, "projectSheetEvent", {
        sheetId,
        type: "SHEET_CREATED",
        label: tab,
        actorId: sneha,
        createdAt: at(addDays(month, -6), "11:05"),
      })
    }

    // The month's team plan.
    const plan = [
      {
        team: "AMG/SMO",
        qty: 12,
        who: ["sneha"],
        status: current ? "IN_PROGRESS" : "DONE",
        due: 0,
      },
      {
        team: "DESIGN",
        qty: 10,
        who: ["priya"],
        status: current ? "IN_PROGRESS" : "DONE",
        due: -3,
      },
      { team: "VIDEO", qty: 4, who: ["arjun"], status: current ? "TODO" : "DONE", due: -5 },
    ]
    for (const p of plan) {
      const wbTeam = randomUUID()
      await make(ctx, "projectWorkbookTeam", {
        id: wbTeam,
        workbookId,
        teamId: teamId(ctx, "sunrise", p.team),
        quantity: p.qty,
        status: p.status,
        dueOn: addDays(monthEnd, p.due),
        links: current
          ? p.team === "DESIGN"
            ? ["https://example.com/figma/sunmeadow-diwali"]
            : []
          : [
              `https://example.com/sunmeadow/${p.team === "AMG/SMO" ? "smo" : p.team.toLowerCase()}-${dayKey(month).slice(0, 7)}`,
            ],
        notes: p.team === "VIDEO" ? "2 hamper reels + 2 recipe reels." : null,
        createdById: sneha,
        createdAt: at(addDays(month, -5), "12:30"),
      })
      await makeMany(
        ctx,
        "projectWorkbookTeamMember",
        p.who.map((w) => ({ workbookTeamId: wbTeam, workbookId, employeeId: idOf(ctx, w) })),
      )
    }
  }
  ctx.summary.add(M, 'Sunmeadow "Content calendar" (2 months x 2 tabs)', 2)
}

async function seedMonitoring(ctx: DemoContext): Promise<void> {
  const urbannest = ctx.project.urbannest!
  const karthik = idOf(ctx, "karthik")
  const ago = (mins: number) => new Date(ctx.now.getTime() - mins * 60_000)
  // PAUSED (isActive false): the uptime sweep and its escalation skip them.
  const up = await make(ctx, "uptimeMonitor", {
    projectId: urbannest,
    url: "https://example.com",
    label: "Main website",
    isActive: false,
    state: "UP",
    lastCheckedAt: ago(4),
    lastStatusCode: 200,
    consecutiveSuccesses: 1,
    ownerId: karthik,
    createdAt: at(addDays(ctx.today, -90), "12:00"),
  })
  const down = await make(ctx, "uptimeMonitor", {
    projectId: urbannest,
    url: "https://staging.example.com",
    label: "Property search (staging)",
    isActive: false,
    state: "DOWN",
    lastCheckedAt: ago(4),
    lastStatusCode: 503,
    lastError: "HTTP 503 Service Unavailable",
    consecutiveFailures: 6,
    ownerId: karthik,
    createdAt: at(addDays(ctx.today, -30), "12:00"),
  })
  await makeMany(ctx, "uptimeIncident", [
    {
      monitorId: up,
      startedAt: at(addDays(ctx.today, -11), "02:05"),
      endedAt: at(addDays(ctx.today, -11), "02:34"),
      statusCode: 502,
      detail: "HTTP 502 Bad Gateway",
      acknowledgedAt: at(addDays(ctx.today, -11), "02:20"),
      acknowledgedById: karthik,
      escalationLevel: 0,
    },
    {
      monitorId: down,
      startedAt: ago(30),
      endedAt: null,
      statusCode: 503,
      detail: "HTTP 503 Service Unavailable",
      escalationLevel: 0,
    },
  ])
  // Renewals: lastAlertStage = the stage already crossed, so nothing is sent until the next threshold.
  await makeMany(ctx, "projectAsset", [
    {
      projectId: urbannest,
      kind: "DOMAIN",
      name: "urbannestrealty.example.com",
      provider: "Nimbus Registrar",
      url: "https://example.com/registrar",
      expiresAt: addDays(ctx.today, 20),
      autoRenew: true,
      paymentMethod: "Company Visa ending 4242",
      ownerId: karthik,
      lastAlertStage: 30,
      lastAlertAt: ago(60),
      notes: "Auto-renew is on - check the card before it runs.",
    },
    {
      projectId: urbannest,
      kind: "SSL",
      name: "*.urbannestrealty.example.com SSL",
      provider: "Let's Encrypt",
      expiresAt: addDays(ctx.today, 90),
      autoRenew: true,
      ownerId: karthik,
    },
    {
      projectId: urbannest,
      kind: "HOSTING",
      name: "Business hosting plan",
      provider: "Nimbus Hosting",
      url: "https://hosting.example.com/",
      expiresAt: addDays(ctx.today, 200),
      autoRenew: false,
      ownerId: null,
      notes: "Nobody owns this renewal yet.",
    },
  ])
  ctx.summary.add(M, "UrbanNest uptime monitors (PAUSED - never checked)", 2)
  ctx.summary.add(M, "UrbanNest renewals", 3)
}

async function seedInsights(ctx: DemoContext): Promise<void> {
  const sunrise = ctx.project.sunrise!
  // "Connected" with NO credentials: the tab reads the stored series; a manual sync would simply fail.
  await make(ctx, "projectIntegration", {
    projectId: sunrise,
    provider: "META",
    // Stored without the "act_" prefix, as saveMetaIntegration does; the tab and the sync add it.
    metaAdAccountId: "000000000000",
    status: "connected",
    lastSyncedAt: new Date(ctx.now.getTime() - 3 * 3_600_000),
  })
  const campaigns = [
    // Lowercase, exactly as the sync's STATUS_MAP writes them (and the tab filters on).
    { name: "Diwali Hamper - Conversions", status: "active", spend: 6500, roas: 3.4 },
    { name: "Millet Atta Launch - Reach", status: "active", spend: 4200, roas: 1.6 },
    { name: "Recipe Reels - Engagement", status: "active", spend: 2100, roas: 1.1 },
    { name: "Retargeting - Cart Abandoners", status: "active", spend: 1800, roas: 5.2 },
    { name: "Lookalike - Website Buyers", status: "paused", spend: 1200, roas: 2.3 },
    { name: "Festive Teaser - Video Views", status: "completed", spend: 900, roas: 0.8 },
  ]
  const r = ctx.rand
  let metrics = 0
  for (const [i, c] of campaigns.entries()) {
    const campaignId = await make(ctx, "metaCampaign", {
      projectId: sunrise,
      campaignId: `120000000000${String(i + 1).padStart(4, "0")}`,
      name: c.name,
      status: c.status,
    })
    const rows: Record<string, unknown>[] = []
    for (let d = 30; d >= 1; d--) {
      if (c.status === "completed" && d < 12) continue
      if (c.status === "paused" && d < 5) continue
      const spend = Math.round(c.spend * (0.7 + r() * 0.6) * (1 + (30 - d) / 60))
      const impressions = Math.round(spend * (55 + r() * 30))
      const clicks = Math.round(impressions * (0.012 + r() * 0.01))
      const purchases = Math.round((spend * c.roas) / 1450)
      const value = Math.round(purchases * 1450 * (0.9 + r() * 0.2))
      rows.push({
        campaignId,
        date: addDays(ctx.today, -d),
        spend,
        impressions: BigInt(impressions),
        clicks: BigInt(clicks),
        ctr: Math.round((clicks / impressions) * 10000) / 100,
        cpc: Math.round((spend / Math.max(1, clicks)) * 100) / 100,
        cpm: Math.round((spend / impressions) * 1000 * 100) / 100,
        reach: BigInt(Math.round(impressions * 0.72)),
        conversions: purchases,
        costPerConversion: purchases ? Math.round((spend / purchases) * 100) / 100 : 0,
        purchases,
        purchaseValue: value,
        roas: Math.round((value / Math.max(1, spend)) * 100) / 100,
        addToCart: purchases * 3 + r.int(0, 6),
        landingPageViews: Math.round(clicks * 0.8),
        currency: "INR",
      })
    }
    metrics += await makeMany(ctx, "metaCampaignMetric", rows)
  }
  ctx.summary.add(
    M,
    "Sunmeadow Insights: Meta campaigns / daily rows (no credentials)",
    campaigns.length,
  )
  ctx.summary.add(M, "  daily metric rows", metrics)
}

async function seedSeo(ctx: DemoContext): Promise<void> {
  const urbannest = ctx.project.urbannest!
  const sites = [
    { label: "Main site", domain: "urbannestrealty.example.com", primary: true, base: 5200 },
    { label: "Blog", domain: "blog.urbannestrealty.example.com", primary: false, base: 1900 },
  ]
  const r = ctx.rand
  let snapshots = 0
  for (const s of sites) {
    // isActive false: the SEO job (and the seo crons) skip the whole tenant.
    const propertyId = await make(ctx, "seoProperty", {
      projectId: urbannest,
      label: s.label,
      isPrimary: s.primary,
      domain: s.domain,
      siteUrl: `sc-domain:${s.domain}`,
      moneyKeywords: [
        "flats in gurugram",
        "3 bhk golf course extension road",
        "ready to move flats gurugram",
      ],
      competitors: ["competitor-one.example.com", "competitor-two.example.com"],
      targetClicks: s.base * 6,
      targetPosition: 8,
      isActive: false,
      lastSyncedAt: new Date(ctx.now.getTime() - 26 * 3_600_000),
      createdAt: at(addDays(ctx.today, -150), "12:00"),
    })
    // Eight weekly Search Console windows, the latest ending 3 days ago.
    let latest = ""
    for (let k = 7; k >= 0; k--) {
      const end = addDays(ctx.today, -3 - k * 7)
      const growth = 1 + (7 - k) * 0.06
      const clicks = Math.round(s.base * growth * (0.9 + r() * 0.2))
      const impressions = Math.round(clicks * (24 + r() * 6))
      const id = randomUUID()
      await make(ctx, "seoSnapshot", {
        id,
        propertyId,
        periodStart: addDays(end, -6),
        periodEnd: end,
        clicks,
        impressions,
        ctr: Math.round((clicks / impressions) * 10000) / 10000,
        position: Math.round((18 - (7 - k) * 0.9 + r()) * 10) / 10,
        source: "GSC",
        createdAt: at(addDays(end, 3), "07:30"),
      })
      latest = id
      snapshots++
    }
    const queries = s.primary
      ? [
          "flats in gurugram",
          "urbannest realty",
          "3 bhk golf course extension road",
          "ready to move flats gurugram",
          "urbannest heights price",
        ]
      : [
          "home loan checklist",
          "rera meaning",
          "stamp duty in haryana",
          "carpet area vs built up area",
          "home loan eligibility",
        ]
    await makeMany(
      ctx,
      "seoQueryStat",
      queries.map((q, i) => {
        const clicks = Math.round(s.base / (2 + i * 1.6))
        const impressions = clicks * (20 + i * 6)
        return {
          snapshotId: latest,
          query: q,
          clicks,
          impressions,
          ctr: clicks / impressions,
          position: 3 + i * 2.4,
        }
      }),
    )
    const pages = s.primary
      ? ["/", "/projects/urbannest-heights", "/projects/urbannest-greens", "/contact", "/about"]
      : [
          "/home-loan-checklist",
          "/what-is-rera",
          "/stamp-duty-haryana",
          "/carpet-area-explained",
          "/home-loan-eligibility",
        ]
    await makeMany(
      ctx,
      "seoPageStat",
      pages.map((p, i) => {
        const clicks = Math.round(s.base / (1.8 + i * 1.5))
        const impressions = clicks * (18 + i * 5)
        return {
          snapshotId: latest,
          page: `https://${s.domain}${p}`,
          clicks,
          impressions,
          ctr: clicks / impressions,
          position: 2.5 + i * 2.1,
        }
      }),
    )
  }
  ctx.summary.add(
    M,
    "UrbanNest SEO sites (inactive - never synced) / weekly snapshots",
    sites.length,
  )
  ctx.summary.add(M, "  weekly SEO snapshots", snapshots)
}

async function seedMailer(ctx: DemoContext): Promise<void> {
  const sunrise = ctx.project.sunrise!
  const sneha = idOf(ctx, "sneha")
  const mailerId = await make(ctx, "projectMailer", {
    projectId: sunrise,
    name: "Newsletter",
    fromName: "Sunmeadow Organics",
    fromEmail: `newsletter.sunmeadow@${DEMO_EMAIL_DOMAIN}`,
    replyTo: `hello.sunmeadow@${DEMO_EMAIL_DOMAIN}`,
    // .invalid can never resolve, so nothing could ever connect with this.
    host: "smtp.demo.invalid",
    port: 587,
    secure: false,
    username: `newsletter.sunmeadow@${DEMO_EMAIL_DOMAIN}`,
    password: encrypt(`not-a-real-password-${randomUUID().slice(0, 8)}`),
    isActive: true,
    lastVerifiedAt: at(addDays(ctx.today, -20), "12:00"),
    createdAt: at(addDays(ctx.today, -40), "12:00"),
  })
  const names = [
    "Ritu Agarwal",
    "Sameer Khan",
    "Pooja Iyer",
    "Deepak Yadav",
    "Anjali Desai",
    "Rakesh Nair",
    "Swati Mishra",
    "Gaurav Sethi",
    "Neelam Bedi",
    "Farhan Qureshi",
    "Lata Menon",
    "Vivek Tandon",
    "Komal Arora",
  ]
  const recipients = names.map((name, i) => ({
    id: randomUUID(),
    projectId: sunrise,
    email: `${name.toLowerCase().replace(/ /g, ".")}@${DEMO_EMAIL_DOMAIN}`,
    name,
    company: i % 4 === 0 ? "Retail partner" : null,
    tags: i % 3 === 0 ? ["newsletter", "vip"] : ["newsletter"],
    fields: { city: ["Delhi", "Mumbai", "Pune", "Bengaluru"][i % 4] },
    isSubscribed: i !== 7,
    unsubscribedAt: i === 7 ? at(addDays(ctx.today, -9), "21:10") : null,
    createdAt: at(addDays(ctx.today, -35), "12:00"),
  }))
  await makeMany(ctx, "projectRecipient", recipients)
  const templates = [
    {
      id: randomUUID(),
      name: "Festive offer",
      subject: "Your Diwali hamper is waiting 🪔",
      body: "<h1>Hi {{name}},</h1><p>Our millet hamper is back for Diwali - 20% off till the festival.</p>",
    },
    {
      id: randomUUID(),
      name: "Monthly newsletter",
      subject: "This month at Sunmeadow",
      body: "<h1>Hi {{name}},</h1><p>New recipes, new products and a little something for {{city}}.</p>",
    },
  ]
  await makeMany(
    ctx,
    "projectEmailTemplate",
    templates.map((t) => ({
      id: t.id,
      projectId: sunrise,
      name: t.name,
      subject: t.subject,
      bodyHtml: t.body,
      bodyMode: "RICH",
      createdById: sneha,
      createdAt: at(addDays(ctx.today, -30), "12:00"),
    })),
  )
  const subscribed = recipients.filter((x) => x.isSubscribed)
  for (const [i, c] of [
    { name: "September newsletter", t: templates[1]!, daysAgo: 28 },
    { name: "Diwali hamper - early access", t: templates[0]!, daysAgo: 6 },
  ].entries()) {
    const sent = at(addDays(ctx.today, -c.daysAgo), "10:00")
    const campaignId = randomUUID()
    const list = i === 1 ? subscribed.filter((x) => x.tags.includes("vip")) : subscribed
    await make(ctx, "projectCampaign", {
      id: campaignId,
      projectId: sunrise,
      templateId: c.t.id,
      mailerId,
      name: c.name,
      subject: c.t.subject,
      bodyHtml: c.t.body,
      bodyMode: "RICH",
      status: "SENT",
      totalCount: list.length,
      sentCount: list.length,
      failedCount: 0,
      startedAt: sent,
      completedAt: new Date(sent.getTime() + 4 * 60_000),
      createdById: sneha,
      createdAt: new Date(sent.getTime() - 3_600_000),
    })
    await makeMany(
      ctx,
      "projectCampaignSend",
      list.map((x, j) => ({
        campaignId,
        recipientId: x.id,
        email: x.email,
        name: x.name,
        status: "SENT",
        sentAt: new Date(sent.getTime() + j * 15_000),
        claimedAt: new Date(sent.getTime() + j * 15_000 - 2_000),
        createdAt: sent,
      })),
    )
  }
  ctx.summary.add(M, "Sunmeadow mailer: account / recipients / templates / SENT campaigns", 1)
  ctx.summary.add(M, "  recipients", recipients.length)
}

export async function seedProjects(ctx: DemoContext): Promise<void> {
  await seedProjectsAndTeams(ctx)
  await seedBrandFilesVault(ctx)
  await seedRequirementsAndChats(ctx)
  await seedGoals(ctx)
  await seedDeliverables(ctx)
  await seedCalendars(ctx)
  await seedMonitoring(ctx)
  await seedInsights(ctx)
  await seedSeo(ctx)
  await seedMailer(ctx)
}
