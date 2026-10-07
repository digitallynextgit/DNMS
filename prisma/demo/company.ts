// =============================================================================
// Company-wide: announcements, photo gallery, company + personal documents,
// 1:1 chat, email templates and the audit log.
//
// ── FILES ARE ROWS ONLY ──────────────────────────────────────────────────────
// Nothing is uploaded to storage. Photos, documents and chat attachments get a
// fake object key under "demo/..." - no real object exists there. The Help
// screenshot script intercepts the file routes (/api/gallery/photos/<id>/file,
// /api/chat/attachments/<id>/file) and serves generated images itself. Opened
// in a normal browser those files 404; everything else on the page renders.
// =============================================================================

import { randomUUID } from "node:crypto"
import { DEMO_EMAIL_DOMAIN } from "@/lib/demo"
import {
  addDays,
  at,
  dayKey,
  firstOfMonth,
  idOf,
  make,
  makeMany,
  shiftWorkingDays,
  type DemoContext,
} from "./context"

// ── Announcements ────────────────────────────────────────────────────────────

/** The next date of a fixed holiday called `name`, today or later. */
function nextHoliday(ctx: DemoContext, name: string): Date | null {
  const dates = [...ctx.holidayNames]
    .filter(([k, n]) => n === name && new Date(`${k}T00:00:00Z`) >= ctx.today)
    .map(([k]) => new Date(`${k}T00:00:00Z`))
    .sort((a, b) => a.getTime() - b.getTime())
  return dates[0] ?? null
}

const longDate = (d: Date) =>
  d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })

async function seedAnnouncements(ctx: DemoContext): Promise<void> {
  const neha = idOf(ctx, "neha")
  const diwali = nextHoliday(ctx, "Diwali") ?? addDays(ctx.today, 30)
  const rahulJoined = shiftWorkingDays(ctx, ctx.today, -4)
  const friday = (() => {
    let d = ctx.today
    while (d.getUTCDay() !== 5) d = addDays(d, 1)
    return d
  })()
  const lastMonth = addDays(firstOfMonth(ctx.today, -1), 6)

  // GUIDE REQUIREMENT (company): exact titles/categories; "Office closed for
  // Diwali" is the ONLY high-priority notice.
  const rows = [
    {
      title: "Office closed for Diwali",
      body: `Wishing everyone a very happy Diwali! The office will be closed on ${longDate(diwali)}.\n\nPlease plan client deliveries around the holiday and set an out-of-office reply. Our Diwali celebration (rangoli competition + potluck lunch) is on the last working day before the holiday - details to follow.`,
      category: "Holiday Notification",
      priority: "HIGH",
      publishedAt: at(addDays(ctx.today, -2), "10:30"),
    },
    {
      title: "Updated Work From Home policy",
      body: "From this month, everyone who has completed probation can take one ordinary work-from-home day a month, applied at least two working days in advance from Work From Home. Emergency WFH (illness, a home emergency) is still allowed on the day - just tick Emergency when you apply.\n\nThe full policy is in Documents > Work From Home Policy.",
      category: "Policy Update",
      priority: "NORMAL",
      publishedAt: at(addDays(ctx.today, -5), "16:00"),
    },
    {
      title: "Welcome Rahul Das to the Design team",
      body: "Please welcome Rahul Das, who joins us as a Junior Designer in the Design team, reporting to Rohan Verma. Rahul has just finished his B.Des and will start on the FitLife App Rebrand. Say hello when you see him!",
      category: "Celebration",
      priority: "LOW",
      publishedAt: at(rahulJoined, "11:15"),
    },
    {
      title: "Laptop security update on Friday",
      body: `IT will push a security update to every office laptop on ${longDate(friday)} at 5:00 PM. Please save your work and keep your laptop on charge and connected to the office Wi-Fi. It takes about 20 minutes and needs one restart.`,
      category: "IT / System",
      priority: "NORMAL",
      publishedAt: at(addDays(ctx.today, -1), "12:00"),
    },
    {
      title: "Team Outing to Lonavala - register by Friday",
      body: "Our team outing is on! Two days in Lonavala with a waterfall trek, team games and a bonfire night. Buses leave the office at 6:00 AM. Register with Kavya by Friday so we can book rooms.",
      category: "Event",
      priority: "NORMAL",
      publishedAt: at(lastMonth, "15:30"),
    },
    {
      title: "Wi-Fi maintenance this Saturday",
      body: "The office Wi-Fi will be down on Saturday between 10 AM and 2 PM for a router upgrade.",
      category: "IT / System",
      priority: "LOW",
      publishedAt: at(addDays(ctx.today, -16), "17:00"),
      expiresAt: at(addDays(ctx.today, -12), "23:59"),
    },
    {
      title: "Q4 appraisal cycle timeline",
      body: "Draft: self-evaluations open on the 1st, manager reviews by the 15th, one-on-ones in the last week of the month.",
      category: "Information",
      priority: "NORMAL",
      publishedAt: at(ctx.today, "09:40"),
      isPublished: false,
    },
  ]
  await makeMany(
    ctx,
    "announcement",
    rows.map((a) => ({
      ...a,
      isPublished: a.isPublished ?? true,
      expiresAt: a.expiresAt ?? null,
      createdById: neha,
      createdAt: a.publishedAt,
      updatedAt: a.publishedAt,
    })),
  )
  ctx.summary.add("Announcements", "announcements (1 HIGH, 1 draft, 1 expired)", rows.length)
}

// ── Gallery ──────────────────────────────────────────────────────────────────

async function seedGallery(ctx: DemoContext): Promise<void> {
  const holi = [...ctx.holidayNames]
    .filter(([k, n]) => n === "Holi" && new Date(`${k}T00:00:00Z`) < ctx.today)
    .map(([k]) => new Date(`${k}T00:00:00Z`))
    .sort((a, b) => b.getTime() - a.getTime())[0]
  const independence = [...ctx.holidayNames]
    .filter(([k, n]) => n === "Independence Day" && new Date(`${k}T00:00:00Z`) < ctx.today)
    .map(([k]) => new Date(`${k}T00:00:00Z`))
    .sort((a, b) => b.getTime() - a.getTime())[0]

  // GUIDE REQUIREMENT (company): "Team Outing - Lonavala" with ~8 photos, at
  // least two by Priya; three more albums of 4-6 photos.
  const albums: {
    title: string
    slug: string
    description: string
    eventDate: Date
    by: string
    photos: { caption: string; by: string; portrait?: boolean }[]
  }[] = [
    {
      title: "Team Outing - Lonavala",
      slug: "team-outing-lonavala",
      description: "Two days of trekking, team games and a bonfire night in the hills.",
      eventDate: addDays(ctx.today, -21),
      by: "kavya",
      photos: [
        { caption: "The whole gang at Tiger Point", by: "kavya" },
        { caption: "Waterfall trek - we made it!", by: "priya" },
        { caption: "Tug of war: Creative vs Everyone Else", by: "sneha" },
        { caption: "Chai break on the way up", by: "priya", portrait: true },
        { caption: "Bonfire night", by: "arjun" },
        { caption: "Sunrise from the resort", by: "arjun", portrait: true },
        { caption: "Treasure hunt winners - Team Pixel", by: "kavya" },
        { caption: "Bus ride back", by: "ananya" },
      ],
    },
    {
      title: "Sunmeadow Organics Launch Event",
      slug: "sunmeadow-organics-launch-event",
      description:
        "Launch of the Sunmeadow Organics millet range - shoot, stall and the client team.",
      eventDate: addDays(ctx.today, -42),
      by: "rohan",
      photos: [
        { caption: "Launch stage before the doors opened", by: "rohan" },
        { caption: "Product wall we designed", by: "priya" },
        { caption: "Behind the scenes of the reel shoot", by: "arjun", portrait: true },
        { caption: "With the Sunmeadow marketing team", by: "rohan" },
        { caption: "Sampling counter", by: "sneha" },
      ],
    },
    {
      title: "Holi Celebration",
      slug: "holi-celebration",
      description: "Colours, gujiya and a lot of thandai on the terrace.",
      eventDate: holi ?? addDays(ctx.today, -200),
      by: "neha",
      photos: [
        { caption: "Before...", by: "neha" },
        { caption: "...and after", by: "kavya" },
        { caption: "Gujiya counter", by: "meera", portrait: true },
        { caption: "Team photo on the terrace", by: "neha" },
      ],
    },
    {
      title: "Independence Day",
      slug: "independence-day",
      description: "Flag hoisting at the office and a tricolour breakfast.",
      eventDate: independence ?? addDays(ctx.today, -60),
      by: "kavya",
      photos: [
        { caption: "Flag hoisting", by: "kavya" },
        { caption: "National anthem", by: "neha" },
        { caption: "Tricolour breakfast", by: "meera" },
        { caption: "Rangoli by the Design team", by: "priya", portrait: true },
        { caption: "Group photo", by: "kavya" },
      ],
    },
  ]

  let photoCount = 0
  for (const album of albums) {
    const created = at(addDays(album.eventDate, 2), "12:00")
    const albumId = randomUUID()
    await make(ctx, "photoAlbum", {
      id: albumId,
      slug: album.slug,
      title: album.title,
      description: album.description,
      eventDate: album.eventDate,
      createdById: idOf(ctx, album.by),
      createdAt: created,
    })
    // The first photo (oldest createdAt) is the album cover.
    await makeMany(
      ctx,
      "photo",
      album.photos.map((p, i) => ({
        albumId,
        objectKey: `demo/gallery/${albumId}/${randomUUID()}.webp`,
        thumbKey: null,
        fileName: `IMG_${2040 + i}.webp`,
        contentType: "image/webp",
        size: 280_000 + i * 17_000,
        caption: p.caption,
        width: p.portrait ? 1067 : 1600,
        height: p.portrait ? 1600 : 1067,
        uploadedById: idOf(ctx, p.by),
        createdAt: new Date(created.getTime() + i * 60_000),
      })),
    )
    photoCount += album.photos.length
  }
  ctx.summary.add("Photo gallery", "albums", albums.length)
  ctx.summary.add("Photo gallery", "photos (rows only, fake demo/ keys)", photoCount)
}

// ── Documents ────────────────────────────────────────────────────────────────

async function seedDocuments(ctx: DemoContext): Promise<void> {
  const neha = idOf(ctx, "neha")
  // GUIDE REQUIREMENT (company): "Leave Policy" is among the three newest and
  // no other title contains "Leave Policy".
  const company: {
    title: string
    category: string
    description: string
    daysAgo: number
    file: string
    size: number
    expires?: number
  }[] = [
    {
      title: "Leave Policy",
      category: "COMPANY_POLICY",
      description: "Leave types, entitlements, carry-forward and how to apply.",
      daysAgo: 2,
      file: "Leave-Policy-2026.pdf",
      size: 412_000,
    },
    {
      title: "Work From Home Policy",
      category: "COMPANY_POLICY",
      description: "Eligibility, monthly limit and emergency WFH.",
      daysAgo: 5,
      file: "WFH-Policy.pdf",
      size: 238_000,
    },
    {
      title: "Expense Claim Form",
      category: "TEMPLATE",
      description: "Fill in, attach bills and send to Finance by the 25th.",
      daysAgo: 9,
      file: "Expense-Claim-Form.xlsx",
      size: 36_000,
    },
    {
      title: "Fire Safety Certificate",
      category: "OTHER",
      description: "Building fire NOC - renewal due.",
      daysAgo: 340,
      file: "Fire-NOC.pdf",
      size: 1_240_000,
      expires: 20,
    },
    {
      title: "Code of Conduct",
      category: "COMPANY_POLICY",
      description: "How we work with each other and with clients.",
      daysAgo: 120,
      file: "Code-of-Conduct.pdf",
      size: 520_000,
    },
    {
      title: "Offer Letter Template",
      category: "TEMPLATE",
      description: "Standard offer letter with merge fields.",
      daysAgo: 150,
      file: "Offer-Letter-Template.docx",
      size: 48_000,
    },
    {
      title: "Employee Handbook",
      category: "EMPLOYMENT",
      description: "Everything a new joiner needs to know.",
      daysAgo: 200,
      file: "Employee-Handbook.pdf",
      size: 2_310_000,
    },
  ]
  const mime = (f: string) =>
    f.endsWith(".pdf")
      ? "application/pdf"
      : f.endsWith(".xlsx")
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  await makeMany(
    ctx,
    "document",
    company.map((d) => ({
      title: d.title,
      description: d.description,
      category: d.category,
      fileName: d.file,
      fileSize: d.size,
      mimeType: mime(d.file),
      objectKey: `demo/documents/${randomUUID()}-${d.file}`,
      version: 1,
      employeeId: null,
      uploadedById: neha,
      isCompanyDoc: true,
      expiresAt: d.expires ? at(addDays(ctx.today, d.expires), "00:00") : null,
      createdAt: at(addDays(ctx.today, -d.daysAgo), "11:30"),
      updatedAt: at(addDays(ctx.today, -d.daysAgo), "11:30"),
    })),
  )

  // Priya's personal documents.
  const priya = idOf(ctx, "priya")
  const personal = [
    { title: "Aadhaar Card", category: "IDENTITY", file: "Aadhaar.pdf", size: 310_000 },
    { title: "PAN Card", category: "TAX", file: "PAN.pdf", size: 180_000 },
    { title: "Degree Certificate", category: "ACADEMIC", file: "BDes-Degree.pdf", size: 640_000 },
    {
      title: "Offer Letter",
      category: "EMPLOYMENT",
      file: "Offer-Letter-Priya-Sharma.pdf",
      size: 210_000,
    },
    { title: "Passport", category: "IDENTITY", file: "Passport.pdf", size: 450_000, expires: 25 },
  ]
  await makeMany(
    ctx,
    "employeeDocument",
    personal.map((d, i) => ({
      employeeId: priya,
      title: d.title,
      category: d.category,
      fileName: d.file,
      fileSize: d.size,
      mimeType: "application/pdf",
      objectKey: `demo/employee-docs/${priya}/${randomUUID()}-${d.file}`,
      uploadedById: i === 3 ? neha : priya,
      expiresAt: d.expires ? at(addDays(ctx.today, d.expires), "00:00") : null,
      createdAt: at(addDays(ctx.today, -400 + i * 2), "14:00"),
    })),
  )
  ctx.summary.add("Documents", "company documents (rows only, fake demo/ keys)", company.length)
  ctx.summary.add("Documents", "Priya's personal documents (rows only)", personal.length)
}

// ── Chat ─────────────────────────────────────────────────────────────────────

type Msg = {
  from: string
  body: string
  minsAgo: number
  replyTo?: number
  pinned?: boolean
  image?: boolean
  react?: [string, string]
}

async function conversation(
  ctx: DemoContext,
  a: string,
  b: string,
  messages: Msg[],
  opts: { readBy: Record<string, number>; pinnedFor?: string[] },
): Promise<{ id: string; count: number }> {
  const idA = idOf(ctx, a)
  const idB = idOf(ctx, b)
  const id = randomUUID()
  const ago = (mins: number) => new Date(ctx.now.getTime() - mins * 60_000)
  const sorted = [...messages].sort((x, y) => y.minsAgo - x.minsAgo)
  const last = sorted[sorted.length - 1]!
  await make(ctx, "conversation", {
    id,
    pairKey: [idA, idB].sort().join(":"),
    lastMessageAt: ago(last.minsAgo),
    createdAt: ago(sorted[0]!.minsAgo + 1),
  })
  await makeMany(ctx, "conversationParticipant", [
    {
      conversationId: id,
      employeeId: idA,
      lastReadAt: ago(opts.readBy[a] ?? 0),
      pinnedAt: opts.pinnedFor?.includes(a) ? ago(600) : null,
    },
    {
      conversationId: id,
      employeeId: idB,
      lastReadAt: ago(opts.readBy[b] ?? 0),
      pinnedAt: opts.pinnedFor?.includes(b) ? ago(600) : null,
    },
  ])
  const ids = sorted.map(() => randomUUID())
  await makeMany(
    ctx,
    "chatMessage",
    sorted.map((m, i) => ({
      id: ids[i],
      conversationId: id,
      senderId: idOf(ctx, m.from),
      body: m.body,
      deliveredAt: ago(m.minsAgo - 1),
      replyToId: m.replyTo !== undefined ? ids[m.replyTo] : null,
      pinnedAt: m.pinned ? ago(m.minsAgo - 5) : null,
      pinnedBy: m.pinned ? idOf(ctx, m.from === a ? b : a) : null,
      hiddenFor: [],
      createdAt: ago(m.minsAgo),
    })),
  )
  const attachments = sorted.flatMap((m, i) =>
    m.image
      ? [
          {
            messageId: ids[i],
            kind: "IMAGE",
            objectKey: `demo/chat/${id}/${randomUUID()}.webp`,
            fileName: "banner-draft-v2.webp",
            contentType: "image/webp",
            size: 184_000,
            width: 1600,
            height: 900,
            waveform: [],
            createdAt: ago(m.minsAgo),
          },
        ]
      : [],
  )
  await makeMany(ctx, "chatAttachment", attachments)
  const reactions = sorted.flatMap((m, i) =>
    m.react
      ? [
          {
            messageId: ids[i],
            employeeId: idOf(ctx, m.react[0]),
            emoji: m.react[1],
            createdAt: ago(m.minsAgo - 2),
          },
        ]
      : [],
  )
  await makeMany(ctx, "chatMessageReaction", reactions)
  return { id, count: sorted.length }
}

async function seedChat(ctx: DemoContext): Promise<void> {
  // Minutes ago. ~1500 = yesterday morning; everything at least 20 minutes old.
  // GUIDE REQUIREMENT (company): Priya-Rohan thread with "banner", a reaction,
  // a reply, a pinned message and an image; Rohan has read everything (blue
  // ticks); the thread is pinned for Priya.
  const rohanThread: Msg[] = [
    {
      from: "rohan",
      body: "Morning Priya! Sunmeadow wants the Diwali hamper creatives by Thursday instead of Friday.",
      minsAgo: 1500,
    },
    {
      from: "priya",
      body: "Morning! That's tight but doable. Statics first or the website banner?",
      minsAgo: 1494,
    },
    {
      from: "rohan",
      body: "Website banner first - it goes live with the offer page. Statics after.",
      minsAgo: 1490,
      pinned: true,
    },
    {
      from: "priya",
      body: "Got it. I'll share a first draft of the banner after lunch.",
      minsAgo: 1485,
      react: ["rohan", "👍"],
    },
    {
      from: "priya",
      body: "Here's the first draft - two colour options for the banner.",
      minsAgo: 1230,
      image: true,
    },
    {
      from: "rohan",
      body: "Option B works. Can the hamper be a bit bigger and the price callout move to the right?",
      minsAgo: 1195,
      replyTo: 4,
    },
    { from: "priya", body: "Sure, will update and send v2 in the evening.", minsAgo: 1190 },
    {
      from: "priya",
      body: "v2 is in the project files. Also exported the mobile size.",
      minsAgo: 1050,
    },
    { from: "rohan", body: "Perfect, sharing it with Nandini now.", minsAgo: 1040 },
    {
      from: "rohan",
      body: "Client approved the banner! 🎉 Please start the 6 statics today.",
      minsAgo: 180,
    },
    {
      from: "priya",
      body: "Yay! Starting now. I've put them on my task sheet for today and tomorrow.",
      minsAgo: 172,
    },
    {
      from: "rohan",
      body: "Great. Ping me if you need the product shots - Arjun has the raw files.",
      minsAgo: 95,
    },
  ]
  const rohan = await conversation(ctx, "priya", "rohan", rohanThread, {
    readBy: { priya: 60, rohan: 60 },
    pinnedFor: ["priya"],
  })

  // GUIDE REQUIREMENT: Ananya's last two messages are UNREAD by Priya.
  const ananya = await conversation(
    ctx,
    "priya",
    "ananya",
    [
      {
        from: "ananya",
        body: "Hey, are the reel cover templates final? I need them for the captions doc.",
        minsAgo: 330,
      },
      { from: "priya", body: "Almost - sending them by 4.", minsAgo: 315 },
      {
        from: "ananya",
        body: "Thanks! Also, can you check the copy on the FitLife moodboard? I changed the tagline.",
        minsAgo: 70,
      },
      { from: "ananya", body: "Option 2 reads better, I think 🙂", minsAgo: 66 },
    ],
    { readBy: { priya: 310, ananya: 60 } },
  )
  const sneha = await conversation(
    ctx,
    "priya",
    "sneha",
    [
      {
        from: "sneha",
        body: "Can I get the carousel in 4:5 instead of 1:1? Instagram crops it otherwise.",
        minsAgo: 2900,
      },
      { from: "priya", body: "Yes, will export 4:5 by EOD.", minsAgo: 2880 },
      { from: "priya", body: "Done - uploaded in the Sunmeadow folder.", minsAgo: 2700 },
      {
        from: "sneha",
        body: "Thank you!! Scheduled for tomorrow 7 PM.",
        minsAgo: 2690,
        react: ["priya", "🙌"],
      },
    ],
    { readBy: { priya: 2600, sneha: 2600 } },
  )
  const karthik = await conversation(
    ctx,
    "priya",
    "karthik",
    [
      {
        from: "karthik",
        body: "What size should the UrbanNest hero banner be? The new layout is wider.",
        minsAgo: 4400,
      },
      {
        from: "priya",
        body: "1920 x 800 for desktop and 1080 x 1350 for mobile. I'll send both.",
        minsAgo: 4380,
      },
      { from: "karthik", body: "Perfect, thanks.", minsAgo: 4370 },
    ],
    { readBy: { priya: 4300, karthik: 4300 } },
  )

  // Other personas' inboxes.
  const others = [
    await conversation(
      ctx,
      "rohan",
      "aarav",
      [
        {
          from: "aarav",
          body: "Rohan, can you share the FitLife rebrand plan before Monday's call?",
          minsAgo: 900,
        },
        { from: "rohan", body: "Yes - deck will be ready by Friday evening.", minsAgo: 880 },
        {
          from: "aarav",
          body: "Also, good job on the Sunmeadow launch. Client was very happy.",
          minsAgo: 120,
        },
      ],
      { readBy: { aarav: 100, rohan: 600 } },
    ),
    await conversation(
      ctx,
      "neha",
      "kavya",
      [
        {
          from: "kavya",
          body: "Rahul's PAN and degree certificate are still pending. I've raised document requests.",
          minsAgo: 1400,
        },
        {
          from: "neha",
          body: "Thanks. Please also book his induction with the department heads.",
          minsAgo: 1380,
        },
        {
          from: "kavya",
          body: "Done - Thursday 3 PM. Also updated his scorecard for day 3.",
          minsAgo: 50,
        },
      ],
      { readBy: { neha: 1300, kavya: 40 } },
    ),
    await conversation(
      ctx,
      "neha",
      "aarav",
      [
        {
          from: "neha",
          body: "September payroll is processed and paid. Draft for this month is in Payroll Directory.",
          minsAgo: 3000,
        },
        {
          from: "aarav",
          body: "Thanks Neha. Let's close Pooja's exit clearances before her last day.",
          minsAgo: 2950,
        },
        {
          from: "neha",
          body: "Yes - Finance and IT sign-offs are pending with Meera and Karthik.",
          minsAgo: 140,
        },
      ],
      { readBy: { neha: 130, aarav: 2900 } },
    ),
    await conversation(
      ctx,
      "meera",
      "pooja",
      [
        {
          from: "pooja",
          body: "Hi Meera, I've submitted my last two reimbursement bills.",
          minsAgo: 2000,
        },
        {
          from: "meera",
          body: "Got them. I'll clear them with the full and final settlement.",
          minsAgo: 1950,
        },
      ],
      { readBy: { meera: 1900, pooja: 1900 } },
    ),
  ]
  const total = [rohan, ananya, sneha, karthik, ...others].reduce((n, c) => n + c.count, 0)
  ctx.summary.add("Chat", "1:1 conversations", 4 + others.length)
  ctx.summary.add("Chat", "messages (incl. 1 image row, Priya: 2 unread)", total)
}

// ── Email templates + audit log ──────────────────────────────────────────────

async function seedEmailTemplates(ctx: DemoContext): Promise<void> {
  // GUIDE REQUIREMENT (admin): "Welcome Email" (slug welcome-email, active,
  // first_name merge field) and "Password Reset", as prisma/seed.ts creates them
  // for the founding company.
  const templates = [
    {
      slug: "welcome-email",
      name: "Welcome Email",
      subject: "Welcome to {{company_name}}, {{first_name}}!",
      trigger: "employee:created",
      mergeFields: [
        "first_name",
        "last_name",
        "company_name",
        "department",
        "designation",
        "login_url",
      ],
      body: '<p>Hi {{first_name}},</p><p>Welcome to {{company_name}}! You are joining the {{department}} team as {{designation}}.</p><p>Sign in to set up your profile: <a href="{{login_url}}">{{login_url}}</a></p><p>See you on your first day!</p>',
    },
    {
      slug: "password-reset",
      name: "Password Reset",
      subject: "Reset your DNMS password",
      trigger: "auth:password_reset",
      mergeFields: ["first_name", "reset_url"],
      body: '<p>Hi {{first_name}},</p><p>We received a request to reset your password. <a href="{{reset_url}}">Choose a new password</a>. If you did not ask for this, ignore this email.</p>',
    },
    {
      slug: "leave-approved",
      name: "Leave Approved",
      subject: "Your leave from {{start_date}} has been approved",
      trigger: null,
      mergeFields: ["first_name", "start_date", "end_date", "leave_type"],
      body: "<p>Hi {{first_name}},</p><p>Your {{leave_type}} from {{start_date}} to {{end_date}} has been approved. Enjoy your time off!</p>",
    },
  ]
  await makeMany(
    ctx,
    "emailTemplate",
    templates.map((t) => ({
      slug: t.slug,
      name: t.name,
      subject: t.subject,
      bodyHtml: t.body,
      bodyText: t.body.replace(/<[^>]+>/g, ""),
      mergeFields: t.mergeFields,
      trigger: t.trigger,
      isActive: true,
      createdAt: at(addDays(ctx.today, -300), "12:00"),
    })),
  )
  ctx.summary.add("Admin", "email templates", templates.length)
}

async function seedAuditLog(ctx: DemoContext): Promise<void> {
  const ua =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36"
  const ip = (n: number) => `203.0.113.${n}` // documentation range (RFC 5737)
  // GUIDE REQUIREMENT (admin): 20-30 rows over ~2 weeks, several "role"
  // actions, some without an IP, one system row (no actor).
  type Row = {
    actor: string | null
    action: string
    module: string
    entityType?: string
    entityKey?: string
    changes?: unknown
    daysAgo: number
    time: string
    ip?: number
  }
  const rows: Row[] = [
    {
      actor: "priya",
      action: "auth:login",
      module: "auth",
      entityType: "Employee",
      entityKey: "priya",
      daysAgo: 0,
      time: "09:21",
      ip: 41,
    },
    {
      actor: "neha",
      action: "auth:login",
      module: "auth",
      entityType: "Employee",
      entityKey: "neha",
      daysAgo: 0,
      time: "09:31",
      ip: 24,
    },
    {
      actor: "rohan",
      action: "auth:login",
      module: "auth",
      entityType: "Employee",
      entityKey: "rohan",
      daysAgo: 0,
      time: "09:40",
      ip: 37,
    },
    {
      actor: "aarav",
      action: "auth:login",
      module: "auth",
      entityType: "Employee",
      entityKey: "aarav",
      daysAgo: 0,
      time: "09:52",
      ip: 12,
    },
    {
      actor: "neha",
      action: "announcement:create",
      module: "company",
      entityType: "Announcement",
      changes: { title: "Office closed for Diwali" },
      daysAgo: 2,
      time: "10:30",
      ip: 24,
    },
    {
      actor: "neha",
      action: "document.upload",
      module: "document",
      entityType: "Document",
      changes: { title: "Leave Policy" },
      daysAgo: 2,
      time: "11:30",
      ip: 24,
    },
    {
      actor: "aarav",
      action: "employee:roles:update",
      module: "role",
      entityType: "Employee",
      entityKey: "kavya",
      changes: { roles: [["employee"], ["hr_employee"]] },
      daysAgo: 3,
      time: "17:45",
      ip: 12,
    },
    {
      actor: "kavya",
      action: "joinee_scorecard.recommendation",
      module: "onboarding",
      entityType: "JoineeScorecard",
      entityKey: "ishaan",
      changes: { recommendation: "CONTINUE" },
      daysAgo: 4,
      time: "15:00",
    },
    {
      actor: "neha",
      action: "announcement:create",
      module: "company",
      entityType: "Announcement",
      changes: { title: "Updated Work From Home policy" },
      daysAgo: 5,
      time: "16:00",
      ip: 24,
    },
    {
      actor: "aarav",
      action: "role:update",
      module: "role",
      entityType: "Role",
      changes: { role: "hr_employee", added: ["recruitment:write"] },
      daysAgo: 5,
      time: "18:10",
      ip: 12,
    },
    {
      actor: "neha",
      action: "evaluation.generate",
      module: "performance",
      entityType: "Evaluation",
      changes: { count: 12 },
      daysAgo: 6,
      time: "09:30",
      ip: 24,
    },
    {
      actor: "neha",
      action: "CREATE",
      module: "employee",
      entityType: "Employee",
      entityKey: "rahul",
      changes: { created: { employeeNo: "DM013", email: `rahul.das@${DEMO_EMAIL_DOMAIN}` } },
      daysAgo: 8,
      time: "11:05",
      ip: 24,
    },
    {
      actor: "neha",
      action: "joinee_scorecard.create",
      module: "onboarding",
      entityType: "JoineeScorecard",
      entityKey: "rahul",
      daysAgo: 8,
      time: "11:06",
      ip: 24,
    },
    {
      actor: "aarav",
      action: "employee:roles:update",
      module: "role",
      entityType: "Employee",
      entityKey: "rahul",
      changes: { roles: [[], ["employee"]] },
      daysAgo: 8,
      time: "11:20",
      ip: 12,
    },
    {
      actor: "kavya",
      action: "checklist_item:add",
      module: "onboarding",
      entityType: "ChecklistInstanceItem",
      changes: { text: "Laptop and email setup" },
      daysAgo: 8,
      time: "12:10",
    },
    {
      actor: "neha",
      action: "UPDATE",
      module: "leave",
      entityType: "LeaveType",
      changes: { name: "Casual Leave", description: ["", "For personal work and short absences."] },
      daysAgo: 9,
      time: "10:15",
      ip: 24,
    },
    {
      actor: "rohan",
      action: "UPDATE",
      module: "project",
      entityType: "Project",
      changes: { name: "Sunmeadow Organics Launch", stage: ["GROWTH", "LAUNCH"] },
      daysAgo: 10,
      time: "13:20",
      ip: 37,
    },
    {
      actor: null,
      action: "evaluation.create",
      module: "performance",
      entityType: "Evaluation",
      changes: { source: "cron:evaluation-autocreate" },
      daysAgo: 10,
      time: "06:00",
    },
    {
      actor: "karthik",
      action: "incident:acknowledge",
      module: "project",
      entityType: "UptimeIncident",
      daysAgo: 11,
      time: "02:20",
    },
    {
      actor: "neha",
      action: "exit_checklist:start",
      module: "exit",
      entityType: "ChecklistInstance",
      entityKey: "pooja",
      daysAgo: 11,
      time: "16:25",
      ip: 24,
    },
    {
      actor: "neha",
      action: "RESIGNATION_APPROVE",
      module: "employee",
      entityType: "Resignation",
      entityKey: "pooja",
      daysAgo: 11,
      time: "16:20",
      ip: 24,
    },
    {
      actor: "kavya",
      action: "album:create",
      module: "company",
      entityType: "PhotoAlbum",
      changes: { title: "Team Outing - Lonavala" },
      daysAgo: 12,
      time: "12:00",
    },
    {
      actor: "aarav",
      action: "client:add_contact",
      module: "client",
      entityType: "ClientUser",
      changes: { name: "Nandini Rao" },
      daysAgo: 12,
      time: "11:20",
      ip: 12,
    },
    {
      actor: "aarav",
      action: "role:update",
      module: "role",
      entityType: "Role",
      changes: { role: "employee", added: ["project:read"] },
      daysAgo: 13,
      time: "18:30",
      ip: 12,
    },
    {
      actor: "pooja",
      action: "RESIGNATION_APPLY",
      module: "employee",
      entityType: "Resignation",
      entityKey: "pooja",
      daysAgo: 14,
      time: "10:05",
      ip: 52,
    },
    {
      actor: "meera",
      action: "UPDATE",
      module: "employee",
      entityType: "Employee",
      entityKey: "meera",
      changes: { phone: ["", "+91 98765 43010"] },
      daysAgo: 14,
      time: "15:45",
    },
  ]
  await makeMany(
    ctx,
    "auditLog",
    rows
      .map((r) => ({
        actorId: r.actor ? idOf(ctx, r.actor) : null,
        action: r.action,
        module: r.module,
        entityType: r.entityType ?? null,
        entityId: r.entityKey ? idOf(ctx, r.entityKey) : null,
        changes: r.changes ?? undefined,
        ipAddress: r.ip ? ip(r.ip) : null,
        userAgent: r.ip ? ua : null,
        createdAt: at(addDays(ctx.today, -r.daysAgo), r.time),
      }))
      // Never in the future when the seed runs early in the morning.
      .filter((r) => r.createdAt <= ctx.now),
  )
  ctx.summary.add("Admin", "audit log entries", rows.length)
}

export async function seedCompany(ctx: DemoContext): Promise<void> {
  await seedAnnouncements(ctx)
  await seedGallery(ctx)
  await seedDocuments(ctx)
  await seedChat(ctx)
  await seedEmailTemplates(ctx)
  await seedAuditLog(ctx)
  void dayKey
}
