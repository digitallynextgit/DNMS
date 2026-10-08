// Demo recruitment: the careers tree, applications in every state, referrals, and a few legacy job postings
// (Analytics still counts them). Candidates are made up; links point at example.com.

import { randomUUID } from "node:crypto"
import { DEMO_EMAIL_DOMAIN } from "@/lib/demo"
import { addDays, at, idOf, make, makeMany, type DemoContext } from "./context"

const M = "Recruitment"

interface RoleDef {
  title: string
  slug: string
  meta: string
  summary: string
  requirements: string[]
  openings: string[]
  status?: "DRAFT" | "PUBLISHED"
}
interface SubDef {
  title: string
  slug: string
  roles: RoleDef[]
}
interface GroupDef {
  mode: "FULL_TIME" | "INTERNSHIP"
  code: string
  title: string
  slug: string
  tone: string
  subs: SubDef[]
}

const TREE: GroupDef[] = [
  {
    mode: "FULL_TIME",
    code: "CRE",
    title: "Creative",
    slug: "creative",
    tone: "red",
    subs: [
      {
        title: "Design",
        slug: "design",
        roles: [
          {
            title: "Graphic Designer",
            slug: "graphic-designer",
            meta: "Full-time · Gurugram · 2-4 years",
            summary:
              "Design social creatives, campaign key visuals and brand collateral for FMCG and D2C clients.",
            requirements: [
              "2+ years in an agency",
              "Strong in Photoshop, Illustrator and Figma",
              "A portfolio of social and print work",
            ],
            openings: ["Gurugram (On-site)"],
          },
          {
            title: "UI/UX Designer",
            slug: "ui-ux-designer",
            meta: "Full-time · Gurugram · 3-5 years",
            summary:
              "Own website and app design for client launches, from wireframes to dev-ready Figma files.",
            requirements: [
              "3+ years designing websites or apps",
              "Design systems in Figma",
              "Basic understanding of HTML/CSS",
            ],
            openings: ["Gurugram (Hybrid)"],
          },
        ],
      },
      {
        title: "Content",
        slug: "content",
        roles: [
          {
            title: "Content Writer",
            slug: "content-writer",
            meta: "Full-time · Gurugram · 1-3 years",
            summary:
              "Write blogs, website copy and social captions across lifestyle, real-estate and wellness brands.",
            requirements: [
              "Excellent written English",
              "SEO writing basics",
              "Samples of published work",
            ],
            openings: ["Gurugram (On-site)"],
          },
        ],
      },
    ],
  },
  {
    mode: "FULL_TIME",
    code: "MKT",
    title: "Marketing",
    slug: "marketing",
    tone: "teal",
    subs: [
      {
        title: "SEO",
        slug: "seo",
        roles: [
          {
            title: "SEO Specialist",
            slug: "seo-specialist",
            meta: "Full-time · Gurugram · 2-4 years",
            summary:
              "Plan and run technical and content SEO for client websites, and report on rankings and traffic.",
            requirements: [
              "Search Console and GA4",
              "Technical audits",
              "Keyword research and content briefs",
            ],
            openings: [],
            status: "DRAFT",
          },
        ],
      },
      {
        title: "Social Media",
        slug: "social-media",
        roles: [
          {
            title: "Social Media Executive",
            slug: "social-media-executive",
            meta: "Full-time · Gurugram · 1-2 years",
            summary:
              "Run content calendars, community management and monthly reporting for three brand handles.",
            requirements: [
              "Hands-on with Instagram and LinkedIn",
              "Meta Business Suite",
              "A sense for trends and formats",
            ],
            openings: ["Gurugram (On-site)"],
          },
        ],
      },
    ],
  },
  {
    mode: "FULL_TIME",
    code: "TECH",
    title: "Technology",
    slug: "technology",
    tone: "teal",
    subs: [
      {
        title: "Web Development",
        slug: "web-development",
        roles: [
          {
            title: "Full Stack Developer",
            slug: "full-stack-developer",
            meta: "Full-time · Gurugram · 3-6 years",
            summary:
              "Build client websites and landing pages in Next.js, and look after integrations and hosting.",
            requirements: [
              "React / Next.js",
              "Node and a SQL database",
              "Shopify or WordPress is a plus",
            ],
            openings: ["Gurugram (Hybrid)"],
          },
        ],
      },
    ],
  },
  {
    mode: "FULL_TIME",
    code: "BIZ",
    title: "Business",
    slug: "business",
    tone: "red",
    subs: [
      {
        title: "Sales",
        slug: "sales",
        roles: [
          {
            title: "Business Development Executive",
            slug: "business-development-executive",
            meta: "Full-time · Gurugram · 1-3 years",
            summary:
              "Find and pitch new brands, write proposals and hand won accounts over to delivery.",
            requirements: [
              "Agency or SaaS sales experience",
              "Confident presenter",
              "CRM discipline",
            ],
            openings: [],
          },
        ],
      },
    ],
  },
  {
    mode: "INTERNSHIP",
    code: "INT",
    title: "Internships",
    slug: "internships",
    tone: "teal",
    subs: [
      {
        title: "Creative Internships",
        slug: "creative-internships",
        roles: [
          {
            title: "Design Intern",
            slug: "design-intern",
            meta: "Internship · Gurugram · 6 months",
            summary: "Work alongside our designers on live client campaigns.",
            requirements: ["Final-year design student or recent graduate", "A small portfolio"],
            openings: ["Gurugram (On-site) - Jan batch"],
          },
          {
            title: "Content Intern",
            slug: "content-intern",
            meta: "Internship · Remote · 3 months",
            summary: "Research and draft blogs and social captions.",
            requirements: ["Strong written English", "Curiosity about brands and marketing"],
            openings: ["Remote"],
          },
        ],
      },
    ],
  },
]

const mail = (local: string) => `${local}@${DEMO_EMAIL_DOMAIN}`

export async function seedRecruitment(ctx: DemoContext): Promise<void> {
  const roleIndex = new Map<string, { id: string; group: GroupDef; sub: SubDef; role: RoleDef }>()
  let groups = 0
  let roles = 0
  let openings = 0
  for (const [gi, g] of TREE.entries()) {
    const groupId = await make(ctx, "careerGroup", {
      mode: g.mode,
      code: g.code,
      title: g.title,
      slug: g.slug,
      jobsLabel: "Explore Sub-Departments",
      tone: g.tone,
      order: gi,
      status: "PUBLISHED",
    })
    groups++
    for (const [si, s] of g.subs.entries()) {
      const subId = await make(ctx, "careerSubDepartment", {
        groupId,
        title: s.title,
        slug: s.slug,
        jobsLabel: "Explore Open Roles",
        tone: g.tone,
        order: si,
        status: "PUBLISHED",
      })
      for (const [ri, role] of s.roles.entries()) {
        const roleId = await make(ctx, "careerRole", {
          subDepartmentId: subId,
          title: role.title,
          slug: role.slug,
          meta: role.meta,
          summary: role.summary,
          intro: `Demo Company is a digital agency in Gurugram working with food, real-estate and wellness brands. ${role.summary}`,
          jobEssence: role.summary,
          keyRequirements: role.requirements,
          order: ri,
          status: role.status ?? "PUBLISHED",
        })
        roles++
        roleIndex.set(role.slug, { id: roleId, group: g, sub: s, role })
        await makeMany(
          ctx,
          "careerOpening",
          role.openings.map((label, oi) => ({ roleId, label, order: oi, status: "PUBLISHED" })),
        )
        openings += role.openings.length
      }
    }
  }
  ctx.summary.add(M, "careers groups", groups)
  ctx.summary.add(M, "careers roles", roles)
  ctx.summary.add(M, "careers openings", openings)

  type App = {
    name: string
    role: string
    status: "RECEIVED" | "IN_REVIEW" | "SHORTLISTED" | "REJECTED" | "HIRED"
    daysAgo: number
    note?: string
    message?: string
    referrerNo?: string
    referrer?: string
    hired?: string
    /** Same person, same role, again within 24h - the "Re-applied" flag. */
    repeat?: boolean
    /** Applied for a role closed before the application arrived - "Role closed". */
    closed?: { slug: string; title: string }
    time?: string
  }
  // Guide requirement: page 1 shows one "Re-applied" and one "Role closed" application.
  const apps: App[] = [
    {
      name: "Rhea Kulkarni",
      role: "graphic-designer",
      status: "RECEIVED",
      daysAgo: 0,
      message: "Four years at a Mumbai agency, mostly FMCG social work. Portfolio linked.",
    },
    { name: "Aman Choudhary", role: "full-stack-developer", status: "RECEIVED", daysAgo: 1 },
    {
      name: "Tanya Bhatia",
      role: "social-media-executive",
      status: "IN_REVIEW",
      daysAgo: 4,
      note: "Good reels portfolio. Check notice period.",
    },
    { name: "Siddharth Rao", role: "graphic-designer", status: "IN_REVIEW", daysAgo: 6 },
    {
      name: "Siddharth Rao",
      role: "graphic-designer",
      status: "RECEIVED",
      daysAgo: 6,
      time: "18:25",
      repeat: true,
      message: "Re-sending with my updated portfolio link - the earlier one had an old project.",
    },
    {
      name: "Farah Siddiqui",
      role: "graphic-designer",
      status: "RECEIVED",
      daysAgo: 3,
      closed: { slug: "motion-designer", title: "Motion Designer" },
      message: "3 years of motion graphics for D2C brands. Showreel attached.",
    },
    {
      name: "Nikita Saxena",
      role: "content-writer",
      status: "SHORTLISTED",
      daysAgo: 9,
      note: "Writing test scored 8/10. Interview with Rohan on Friday.",
    },
    {
      name: "Harsh Vardhan",
      role: "full-stack-developer",
      status: "SHORTLISTED",
      daysAgo: 12,
      note: "Referred by Karthik. Strong Next.js, some Shopify.",
      referrerNo: "DM005",
      referrer: "karthik",
    },
    {
      name: "Mohit Arora",
      role: "ui-ux-designer",
      status: "REJECTED",
      daysAgo: 15,
      note: "Portfolio is mostly print - not the right fit for product design.",
    },
    {
      name: "Simran Kaur",
      role: "design-intern",
      status: "RECEIVED",
      daysAgo: 2,
      message: "Final-year B.Des student from Delhi.",
    },
    {
      name: "Ishaan Malhotra",
      role: "business-development-executive",
      status: "HIRED",
      daysAgo: 215,
      note: "Joined as Business Development Executive.",
      referrer: "vikram",
      hired: "ishaan",
    },
  ]
  const appRows: Record<string, unknown>[] = []
  for (const a of apps) {
    const ref = roleIndex.get(a.role)!
    const id = `app_${randomUUID()}`
    const slugName = a.name.toLowerCase().replace(/[^a-z]+/g, ".")
    // Never in the future, whatever time of day the seed runs.
    const at_ = at(addDays(ctx.today, -a.daysAgo), a.time ?? "13:10")
    const submitted = new Date(Math.min(at_.getTime(), ctx.now.getTime() - 40 * 60_000))
    appRows.push({
      id,
      idempotencyKey: `site_${randomUUID()}`,
      mode: ref.group.mode,
      groupSlug: ref.group.slug,
      departmentSlug: ref.sub.slug,
      roleSlug: a.closed?.slug ?? ref.role.slug,
      groupCode: ref.group.code,
      departmentTitle: ref.sub.title,
      roleTitle: a.closed?.title ?? ref.role.title,
      opening: a.closed ? null : (ref.role.openings[0] ?? null),
      careerRoleId: a.closed ? null : ref.id,
      roleResolved: !a.closed,
      isRepeat: a.repeat ?? false,
      fullName: a.name,
      email: mail(slugName),
      phone: `+91 98765 45${String(appRows.length + 10).padStart(3, "0")}`,
      linkedIn: `https://example.com/in/${slugName.replace(/\./g, "-")}`,
      portfolio: a.role.includes("design")
        ? `https://example.com/portfolio/${slugName.replace(/\./g, "-")}`
        : "",
      resumeUrl: `https://example.com/resumes/${slugName.replace(/\./g, "-")}.pdf`,
      message: a.message ?? null,
      submittedAt: submitted,
      sourceUrl: `https://example.com/careers/${ref.group.slug}/${ref.sub.slug}/${a.closed?.slug ?? ref.role.slug}`,
      status: a.status,
      hrNotes: a.note ?? null,
      referrerEmployeeNo: a.referrerNo ?? null,
      referrerId: a.referrer ? idOf(ctx, a.referrer) : null,
      hiredEmployeeId: a.hired ? idOf(ctx, a.hired) : null,
      createdAt: submitted,
    })
  }

  // Internal referrals by Priya (guide requirement): one HIRED (Rahul, reward pending for a year), one in the
  // pipeline. REFERRAL_REWARD_PERCENT is platform-wide (shared with the real company), so it stays unset.
  const internal = [
    {
      role: "ui-ux-designer",
      name: "Kunal Mehra",
      daysAgo: 3,
      status: "SHORTLISTED" as const,
      hired: null as string | null,
      message:
        "Kunal and I studied design together. He has 4 years of app and website design at a Bengaluru startup - very strong in Figma design systems.",
      note: "Portfolio looks strong. Call with Rohan scheduled for Friday.",
    },
    {
      role: "graphic-designer",
      name: "Rahul Das",
      daysAgo: 45,
      status: "HIRED" as const,
      hired: "rahul",
      message:
        "Rahul interned with me at my last agency - quick learner, great with layouts and type.",
      note: "Hired as Junior Designer.",
    },
  ]
  for (const ref of internal) {
    const r = roleIndex.get(ref.role)!
    const id = `app_${randomUUID()}`
    const submitted = at(addDays(ctx.today, -ref.daysAgo), "17:45")
    const local = ref.name.toLowerCase().replace(/[^a-z]+/g, ".")
    appRows.push({
      id,
      idempotencyKey: `referral_${id}`,
      mode: r.group.mode,
      groupSlug: r.group.slug,
      // The referral service stores the sub-department TITLE and the role id here.
      departmentSlug: r.sub.title,
      roleSlug: r.id,
      groupCode: r.group.code,
      departmentTitle: r.sub.title,
      roleTitle: r.role.title,
      opening: null,
      careerRoleId: r.id,
      roleResolved: true,
      fullName: ref.name,
      email: ref.hired ? mail("rahul.das.personal") : mail(local),
      phone: "",
      linkedIn: "",
      portfolio: "",
      resumeUrl: `https://example.com/resumes/${local.replace(/\./g, "-")}.pdf`,
      message: ref.message,
      submittedAt: submitted,
      sourceUrl: "internal:referral",
      status: ref.status,
      hrNotes: ref.note,
      referrerId: idOf(ctx, "priya"),
      hiredEmployeeId: ref.hired ? idOf(ctx, ref.hired) : null,
      isInternalReferral: true,
      createdAt: submitted,
    })
  }
  await makeMany(ctx, "careerApplication", appRows)
  ctx.summary.add(M, "career applications", appRows.length)
  ctx.summary.add(M, "  of which referrals (Priya x2 incl. Rahul hired, Karthik, Vikram)", 4)

  const neha = idOf(ctx, "neha")
  const postings = [
    {
      title: "Graphic Designer",
      dept: "Design",
      status: "OPEN",
      openings: 1,
      min: 35000,
      max: 55000,
    },
    {
      title: "Full Stack Developer",
      dept: "Technology",
      status: "OPEN",
      openings: 1,
      min: 70000,
      max: 100000,
    },
    {
      title: "Social Media Executive",
      dept: "Social Media",
      status: "OPEN",
      openings: 2,
      min: 30000,
      max: 42000,
    },
    { title: "SEO Specialist", dept: "SEO", status: "CLOSED", openings: 1, min: 40000, max: 55000 },
  ]
  const postingId: Record<string, string> = {}
  for (const p of postings) {
    postingId[p.title] = await make(ctx, "jobPosting", {
      title: p.title,
      slug: p.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      departmentId: ctx.dept[p.dept],
      description: `We are hiring a ${p.title} for our Gurugram office.`,
      requirements: "See the careers page for the full role description.",
      location: "Gurugram",
      type: "FULL_TIME",
      salaryMin: p.min,
      salaryMax: p.max,
      status: p.status,
      openings: p.openings,
      closingDate: addDays(ctx.today, p.status === "OPEN" ? 30 : -10),
      postedById: neha,
      createdAt: at(addDays(ctx.today, -35), "11:00"),
    })
  }
  const applicants = [
    { first: "Rhea", last: "Kulkarni", job: "Graphic Designer", stage: "APPLIED", days: 0 },
    { first: "Siddharth", last: "Rao", job: "Graphic Designer", stage: "SCREENING", days: 6 },
    { first: "Mohit", last: "Arora", job: "Graphic Designer", stage: "REJECTED", days: 15 },
    { first: "Aman", last: "Choudhary", job: "Full Stack Developer", stage: "APPLIED", days: 1 },
    { first: "Harsh", last: "Vardhan", job: "Full Stack Developer", stage: "INTERVIEW", days: 12 },
    { first: "Tanya", last: "Bhatia", job: "Social Media Executive", stage: "INTERVIEW", days: 4 },
    { first: "Megha", last: "Jain", job: "Social Media Executive", stage: "OFFER", days: 20 },
    { first: "Rohit", last: "Bisht", job: "SEO Specialist", stage: "HIRED", days: 40 },
  ]
  const applicantId: Record<string, string> = {}
  for (const a of applicants) {
    const created = at(addDays(ctx.today, -a.days), "12:30")
    applicantId[`${a.first} ${a.last}`] = await make(ctx, "applicant", {
      jobPostingId: postingId[a.job],
      firstName: a.first,
      lastName: a.last,
      email: mail(`${a.first}.${a.last}`.toLowerCase()),
      phone: `+91 98765 46${String(Object.keys(applicantId).length + 10).padStart(3, "0")}`,
      stage: a.stage,
      rating: a.stage === "REJECTED" ? 2 : a.stage === "APPLIED" ? null : 4,
      source: a.days > 30 ? "Referral" : "Careers page",
      rejectionReason: a.stage === "REJECTED" ? "Portfolio not a fit for the role." : null,
      appliedAt: created,
      createdAt: created,
    })
  }
  await makeMany(ctx, "interview", [
    {
      applicantId: applicantId["Harsh Vardhan"],
      interviewerId: idOf(ctx, "karthik"),
      type: "TECHNICAL",
      scheduledAt: at(addDays(ctx.today, 2), "15:00"),
      durationMins: 60,
      meetingLink: "https://example.com/meet/harsh-technical",
      result: "PENDING",
    },
    {
      applicantId: applicantId["Tanya Bhatia"],
      interviewerId: idOf(ctx, "rohan"),
      type: "VIDEO",
      scheduledAt: at(addDays(ctx.today, 1), "11:30"),
      durationMins: 45,
      meetingLink: "https://example.com/meet/tanya",
      result: "PENDING",
    },
    {
      applicantId: applicantId["Megha Jain"],
      interviewerId: neha,
      type: "HR",
      scheduledAt: at(addDays(ctx.today, -6), "16:00"),
      durationMins: 30,
      location: "Gurugram office, Meeting Room 2",
      result: "PASSED",
      feedback: "Clear communicator, salary expectations within the band.",
      rating: 4,
    },
  ])
  ctx.summary.add(M, "legacy job postings (Analytics)", postings.length)
  ctx.summary.add(M, "legacy applicants (Analytics)", applicants.length)
  ctx.summary.add(M, "interviews", 3)
}
