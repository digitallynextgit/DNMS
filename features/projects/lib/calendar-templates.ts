// The fixed column set of every service calendar: a spine shared by all, then a block per service.
// Reminders, the campaign view and imports bind to the KEY, never to the header text, so a
// renamed header changes nothing. Pure: shared by the server, the grid and the tests.

import type { SheetColumnType } from "./sheet-types"

export interface CalendarColumnSpec {
  key: string
  label: string
  type: SheetColumnType
  /** SELECT choices. */
  options?: readonly string[]
  /** Core: cannot be retyped or deleted (the label can change). */
  locked?: boolean
}

/** One workflow for every calendar; "Done" means published / sent / live / delivered. */
export const STATUS_OPTIONS = [
  "Planned",
  "In progress",
  "Review",
  "Approved",
  "Scheduled",
  "Done",
  "Dropped",
] as const
export type CalendarStatus = (typeof STATUS_OPTIONS)[number]

/** Rows in these states are finished: no reminders, no "waiting on you". */
export const CLOSED_STATUSES: ReadonlySet<string> = new Set(["Done", "Dropped"])

/** Statuses at or past Approved: the internal deadline has been met. */
export const READY_STATUSES: ReadonlySet<string> = new Set(["Approved", "Scheduled", "Done"])

export const CAMPAIGN_NONE = "None"

/** Derived from Date; never typed. */
export const COMPUTED_KEYS: ReadonlySet<string> = new Set(["day"])

const squash = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

/** Statuses typed before the fixed list existed, and what they mean in it. */
const LEGACY_STATUS: Record<string, CalendarStatus> = {
  planned: "Planned",
  plan: "Planned",
  idea: "Planned",
  "to do": "Planned",
  todo: "Planned",
  pending: "Planned",
  "not started": "Planned",
  open: "Planned",
  "in progress": "In progress",
  "work in progress": "In progress",
  wip: "In progress",
  ongoing: "In progress",
  drafting: "In progress",
  "in design": "In progress",
  designing: "In progress",
  review: "Review",
  "in review": "Review",
  "under review": "Review",
  drafted: "Review",
  "drafted ready for review": "Review",
  "ready for review": "Review",
  "waiting for approval": "Review",
  "sent for approval": "Review",
  "pending approval": "Review",
  approved: "Approved",
  "client approved": "Approved",
  ready: "Approved",
  scheduled: "Scheduled",
  queued: "Scheduled",
  done: "Done",
  posted: "Done",
  published: "Done",
  live: "Done",
  sent: "Done",
  completed: "Done",
  complete: "Done",
  delivered: "Done",
  closed: "Done",
  dropped: "Dropped",
  cancelled: "Dropped",
  canceled: "Dropped",
  skipped: "Dropped",
  rejected: "Dropped",
}

/** A status cell as the workflow knows it: "Posted" is "Done"; an unknown value stays (trimmed). */
export function normaliseStatus(value: unknown): string | null {
  if (typeof value !== "string") return null
  const s = value.trim()
  if (!s) return null
  return LEGACY_STATUS[squash(s)] ?? s
}

export const isClosedStatus = (value: unknown): boolean => {
  const s = normaliseStatus(value)
  return !!s && CLOSED_STATUSES.has(s)
}

export const isReadyStatus = (value: unknown): boolean => {
  const s = normaliseStatus(value)
  return !!s && READY_STATUSES.has(s)
}

const col = (
  key: string,
  label: string,
  type: SheetColumnType,
  extra: Partial<CalendarColumnSpec> = {},
): CalendarColumnSpec => ({ key, label, type, ...extra })

const select = (key: string, label: string, options: readonly string[]) =>
  col(key, label, "SELECT", { options })

// The spine, in two halves: the row's "what and when" up front, the workflow at the end.
const SPINE_HEAD: CalendarColumnSpec[] = [
  col("date", "Date", "DATE", { locked: true }),
  col("day", "Day", "TEXT", { locked: true }),
]
const SPINE_CAMPAIGN = select("campaign", "Campaign", [CAMPAIGN_NONE])
SPINE_CAMPAIGN.locked = true
const SPINE_TAIL: CalendarColumnSpec[] = [
  col("owner", "Owner", "PERSON", { locked: true }),
  col("internal_due", "Internal deadline", "DATE", { locked: true }),
  select("status", "Status", STATUS_OPTIONS),
  col("approver", "Approver", "PERSON", { locked: true }),
  col("asset", "Final asset", "URL", { locked: true }),
  col("notes", "Notes", "LONG_TEXT", { locked: true }),
]
SPINE_TAIL[2]!.locked = true

const SOCIAL_FORMATS: Record<string, readonly string[]> = {
  Meta: ["Static", "Carousel", "Reel", "Story", "Live"],
  LinkedIn: ["Post", "Carousel / Document", "Article", "Video", "Poll"],
  YouTube: ["Short", "Long-form", "Community post", "Live"],
  X: ["Post", "Thread", "Poll", "Video"],
}
const ALL_SOCIAL_FORMATS = [...new Set(Object.values(SOCIAL_FORMATS).flat())]
/** The platform a social tab is for, from its name ("LinkedIn_DN_Feb'26", "August Reels"). */
const PLATFORM_IN_TAB: [string, RegExp][] = [
  ["LinkedIn", /linkedin/i],
  ["YouTube", /youtube|\byt\b/i],
  ["X", /\bx\b|twitter/i],
  ["Meta", /meta|instagram|insta|facebook|\bfb\b|reels?\b/i],
]
const socialFormats = (tab: string) =>
  SOCIAL_FORMATS[tab] ??
  SOCIAL_FORMATS[PLATFORM_IN_TAB.find(([, re]) => re.test(tab))?.[0] ?? ""] ??
  ALL_SOCIAL_FORMATS

/** The service block: columns between the spine's head and tail. Keyed by service code. */
const BLOCKS: Record<string, (tab: string) => CalendarColumnSpec[]> = {
  SMO: (tab) => [
    col("time", "Posting time", "TEXT"),
    col("occasion", "Occasion / Key date", "TEXT"),
    col("theme", "Theme", "TEXT"),
    SPINE_CAMPAIGN,
    select("format", "Format", socialFormats(tab)),
    col("hook", "Content idea / Hook", "LONG_TEXT"),
    col("caption", "Caption / Copy", "LONG_TEXT"),
    col("hashtags", "Hashtags", "TEXT"),
    col("cta", "CTA", "TEXT"),
    col("brief", "Creative brief", "LONG_TEXT"),
    col("copywriter", "Copywriter", "PERSON"),
    col("designer", "Designer / Editor", "PERSON"),
    col("client_ok", "Client approved", "CHECKBOX"),
    col("live_link", "Published link", "URL"),
  ],
  SEO: () => [
    select("task_type", "Task type", [
      "Blog",
      "On-page",
      "Technical",
      "Backlink / Off-page",
      "Google Business Profile",
      "AEO / FAQ",
      "GEO / AI visibility",
      "Audit",
      "Report",
    ]),
    col("keyword", "Target keyword / query", "TEXT"),
    col("page", "Page / URL", "URL"),
    col("title", "Title / Topic", "TEXT"),
    col("brief", "Brief", "URL"),
    SPINE_CAMPAIGN,
    col("live_link", "Live link", "URL"),
  ],
  PM: () => [
    col("end_date", "End date", "DATE"),
    select("platform", "Platform", [
      "Meta",
      "Google Search",
      "Google Display",
      "YouTube",
      "LinkedIn",
      "X",
      "Other",
    ]),
    SPINE_CAMPAIGN,
    select("objective", "Objective", [
      "Awareness",
      "Traffic",
      "Leads",
      "Sales",
      "App installs",
      "Engagement",
      "Retargeting",
    ]),
    col("audience", "Ad set / Audience", "TEXT"),
    col("creative", "Creative", "URL"),
    col("landing", "Landing page", "URL"),
    col("budget", "Total budget", "NUMBER"),
    col("daily_budget", "Daily budget", "NUMBER"),
    col("kpi", "KPI target", "TEXT"),
    col("actual", "Actual", "TEXT"),
  ],
  DA: () => [
    select("deliverable", "Deliverable", [
      "Weekly report",
      "Monthly report",
      "Dashboard update",
      "Ad-hoc analysis",
      "Audit",
      "Tracking setup",
    ]),
    select("source", "Source", [
      "GA4",
      "Search Console",
      "Meta Ads",
      "Google Ads",
      "CRM",
      "Social insights",
      "Mixed",
    ]),
    col("period", "Period covered", "TEXT"),
    SPINE_CAMPAIGN,
    col("client_shared", "Shared with client", "CHECKBOX"),
  ],
  MSG: () => [
    col("time", "Send time", "TEXT"),
    select("channel", "Channel", ["Email", "WhatsApp", "SMS", "Push"]),
    SPINE_CAMPAIGN,
    col("audience", "Audience / Segment", "TEXT"),
    col("subject", "Subject / Headline", "TEXT"),
    col("copy", "Message / Copy", "LONG_TEXT"),
    col("template", "Template / Creative", "URL"),
    col("client_ok", "Client approved", "CHECKBOX"),
    col("report", "Sent report", "URL"),
  ],
  INF: () => [
    col("partner", "Influencer / Partner", "TEXT"),
    col("profile", "Profile", "URL"),
    select("platform", "Platform", ["Instagram", "YouTube", "LinkedIn", "X", "Other"]),
    SPINE_CAMPAIGN,
    select("deliverable", "Deliverable", ["Reel", "Story", "Post", "Video", "Event", "Giveaway"]),
    col("fee", "Agreed fee", "NUMBER"),
    col("brief_sent", "Brief sent", "CHECKBOX"),
    col("content_in", "Content received", "CHECKBOX"),
    col("live_link", "Live link", "URL"),
  ],
  ALL: () => [
    col("partner", "Partner", "TEXT"),
    col("contact", "Contact person", "TEXT"),
    select("activity", "Activity", [
      "Outreach",
      "Meeting",
      "Proposal",
      "Co-marketing",
      "Event",
      "Agreement",
      "Renewal",
    ]),
    SPINE_CAMPAIGN,
    col("next_step", "Next step", "TEXT"),
    col("next_date", "Next step date", "DATE"),
  ],
  DPR: () => [
    col("outlet", "Outlet / Publication", "TEXT"),
    col("contact", "Journalist / Contact", "TEXT"),
    col("angle", "Angle / Headline", "TEXT"),
    select("pr_type", "Type", [
      "Press release",
      "Feature",
      "Interview",
      "Guest post",
      "Listicle",
      "Award",
      "Podcast",
    ]),
    SPINE_CAMPAIGN,
    col("coverage", "Coverage link", "URL"),
  ],
  WEB: () => [
    col("page", "Page / Section", "TEXT"),
    select("change_type", "Change type", [
      "New page",
      "Content update",
      "Design",
      "Bug fix",
      "SEO fix",
      "Performance",
      "Integration",
      "Form / tracking",
    ]),
    col("brief", "Request / Brief", "LONG_TEXT"),
    col("requested_by", "Requested by", "PERSON"),
    SPINE_CAMPAIGN,
    col("staging", "Staging link", "URL"),
  ],
  CAMP: () => [
    SPINE_CAMPAIGN,
    select("phase", "Phase", ["Teaser", "Launch", "Sustain", "Close"]),
    select("channel", "Channel", [
      "Social",
      "Paid",
      "Email / WhatsApp",
      "PR",
      "Website",
      "Influencer",
      "Offline",
      "Other",
    ]),
    col("message", "Key message", "TEXT"),
    col("deliverable", "Deliverable", "TEXT"),
  ],
  OFF: () => [
    select("activity", "Activity", [
      "Event",
      "Print",
      "OOH / Hoarding",
      "Radio / TV",
      "Merchandise",
      "Activation",
      "Sponsorship",
    ]),
    col("location", "Location", "TEXT"),
    col("vendor", "Vendor", "TEXT"),
    col("budget", "Budget", "NUMBER"),
    SPINE_CAMPAIGN,
  ],
  BD: () => [
    col("lead", "Lead / Account", "TEXT"),
    col("contact", "Contact", "TEXT"),
    select("stage", "Stage", [
      "Lead",
      "Contacted",
      "Meeting",
      "Proposal",
      "Negotiation",
      "Won",
      "Lost",
    ]),
    col("value", "Value", "NUMBER"),
    col("next_step", "Next action", "TEXT"),
    col("next_date", "Next action date", "DATE"),
    SPINE_CAMPAIGN,
  ],
  BRAND: () => [
    select("asset_kind", "Asset", [
      "Logo",
      "Colour palette",
      "Typography",
      "Templates",
      "Brand guidelines",
      "Icons",
      "Stationery",
      "Social kit",
      "Presentation deck",
    ]),
    col("version", "Version", "TEXT"),
    col("designer", "Designer", "PERSON"),
    SPINE_CAMPAIGN,
    col("client_ok", "Client approved", "CHECKBOX"),
  ],
}

/** The template for a tab of a service calendar; null when the service has none (a custom sheet). */
export function calendarTemplate(
  service: string | null | undefined,
  tab = "",
): CalendarColumnSpec[] | null {
  if (!service) return null
  const block = BLOCKS[service]
  if (!block) return null
  const middle = block(tab)
  // Every block carries the campaign column; a block that forgot it gets it before the tail.
  const withCampaign = middle.some((c) => c.key === "campaign")
    ? middle
    : [...middle, SPINE_CAMPAIGN]
  return [...SPINE_HEAD, ...withCampaign, ...SPINE_TAIL]
}

/** Every key any template uses. */
export const TEMPLATE_KEYS: ReadonlySet<string> = new Set(
  Object.keys(BLOCKS).flatMap((s) => calendarTemplate(s)!.map((c) => c.key)),
)

/** Row-level reminders only make sense once these exist on the tab. */
export const REMINDER_KEYS = ["date", "status", "owner"] as const

/** Header names (as typed over the months, typos included) that mean a template key. */
const ALIASES: Record<string, readonly string[]> = {
  date: [
    "date",
    "publish date",
    "publishing date",
    "post date",
    "posting date",
    "date of post",
    "scheduled date",
    "go live",
    "go live date",
    "send date",
    "start",
    "start date",
    "due date",
    "live date",
  ],
  day: ["day", "weekday", "day of week"],
  time: ["time", "posting time", "post time", "send time", "slot", "time slot"],
  occasion: [
    "occasion",
    "occassion",
    "key date",
    "key dates",
    "occasion key date",
    "occassion key date",
    "occasion day",
    "occassion day",
    "event",
    "festival",
  ],
  theme: [
    "theme",
    "theme campaign",
    "theme campiaign",
    "campaign theme",
    "topic",
    "pillar",
    "content pillar",
  ],
  campaign: ["campaign", "campaign name"],
  format: [
    "format",
    "content format",
    "post format",
    "post type",
    "type of post",
    "content type",
    "type",
  ],
  hook: [
    "content idea",
    "idea",
    "hook",
    "hook concept",
    "concept hook",
    "content idea hook",
    "content idea hook concept",
    "idea hook concept",
    "concept",
    "angle",
  ],
  caption: [
    "caption",
    "copy",
    "caption copy",
    "content",
    "post content",
    "post copy",
    "caption text",
    "text",
  ],
  hashtags: ["hashtags", "hashtag", "tags"],
  cta: ["cta", "call to action"],
  brief: ["brief", "creative brief", "design brief", "request", "request brief"],
  copywriter: ["copywriter", "writer", "content writer", "copy by"],
  designer: [
    "designer",
    "designer editor",
    "editor",
    "design",
    "design by",
    "graphic designer",
    "video editor",
  ],
  owner: [
    "owner",
    "assignee",
    "assigned",
    "assigned to",
    "responsible",
    "poc",
    "person",
    "handled by",
  ],
  internal_due: [
    "internal deadline",
    "deadline",
    "ready by",
    "internal due",
    "internal due date",
    "due",
  ],
  status: ["status", "stage", "state", "progress"],
  approver: ["approver", "approved by", "approval", "reviewer", "review by", "checked by"],
  client_ok: [
    "client approved",
    "client approval",
    "client ok",
    "approved by client",
    "client sign off",
  ],
  asset: [
    "final asset",
    "asset",
    "creative",
    "creatives",
    "creative link",
    "design link",
    "final creative",
    "canva link",
    "file",
    "drive link",
    "link",
  ],
  live_link: [
    "published link",
    "live link",
    "post link",
    "link of post",
    "link of the post",
    "post url",
    "published url",
    "url",
    "live url",
    "coverage",
  ],
  notes: ["notes", "note", "remarks", "remark", "comments", "comment"],
  keyword: [
    "keyword",
    "keywords",
    "target keyword",
    "query",
    "target query",
    "target keyword query",
    "search query",
    "search intent target query",
  ],
  page: ["page", "page url", "page section", "url", "section"],
  title: ["title", "title topic", "topic", "headline"],
  platform: ["platform", "channel", "network"],
  end_date: ["end date", "end", "till", "to"],
  budget: ["budget", "total budget", "spend"],
  audience: ["audience", "segment", "audience segment", "ad set", "ad set audience", "targeting"],
  subject: ["subject", "subject line", "subject headline"],
  deliverable: ["deliverable", "deliverables", "output"],
  partner: ["partner", "influencer", "influencer partner", "creator", "brand"],
  contact: ["contact", "contact person", "journalist", "journalist contact", "spoc"],
  outlet: ["outlet", "publication", "outlet publication", "media"],
  lead: ["lead", "lead account", "name", "account", "company", "organisation", "organization"],
  next_step: ["next step", "next steps", "next action", "follow up", "follow ups", "followup"],
  next_date: ["next step date", "next action date", "follow up date", "followup date"],
}

/** The template key a free header most likely means, or null. Exact label match first. */
export function guessKey(header: string, template: readonly CalendarColumnSpec[]): string | null {
  const h = squash(header)
  if (!h) return null
  const exact = template.find((c) => squash(c.label) === h)
  if (exact) return exact.key
  const keys = new Set(template.map((c) => c.key))
  for (const [key, names] of Object.entries(ALIASES)) {
    if (keys.has(key) && names.some((n) => squash(n) === h)) return key
  }
  return null
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]

const pad = (n: number) => String(n).padStart(2, "0")

/** "YYYY-MM-DD" when the parts make a real date (no 31 Feb), else null. */
function ymdOf(y: number, m: number, d: number): string | null {
  const t = new Date(Date.UTC(y, m - 1, d))
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null
  return `${y}-${pad(m)}-${pad(d)}`
}

const monthOf = (name: string) => MONTHS.indexOf(name.slice(0, 3).toLowerCase()) + 1
const yearOf = (y: string) => (y.length === 2 ? 2000 + Number(y) : Number(y))

/**
 * A cell's date as "YYYY-MM-DD". Reads what people type: ISO (with or without a time),
 * "15/10/2026" (day first), "15-Sep-26", "1st Oct 2026", "Oct 1, 2026". A date with no year is
 * not a date ("Oct 1" would otherwise become 2001). Else null.
 */
export function cellDate(value: unknown): string | null {
  if (typeof value !== "string") return null
  const s = value.trim()
  if (!s) return null
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/.exec(s)
  if (m) return ymdOf(Number(m[1]), Number(m[2]), Number(m[3]))
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s)
  if (m) return ymdOf(Number(m[3]), Number(m[2]), Number(m[1]))
  m = /^(\d{1,2})(?:st|nd|rd|th)?[\s/-]+([a-z]{3,9})\.?,?[\s/-]+(\d{2}|\d{4})$/i.exec(s)
  if (m) {
    const month = monthOf(m[2]!)
    return month ? ymdOf(yearOf(m[3]!), month, Number(m[1])) : null
  }
  m = /^([a-z]{3,9})\.?[\s/-]+(\d{1,2})(?:st|nd|rd|th)?,?[\s/-]+(\d{2}|\d{4})$/i.exec(s)
  if (m) {
    const month = monthOf(m[1]!)
    return month ? ymdOf(yearOf(m[3]!), month, Number(m[2])) : null
  }
  // Anything else with a four-digit year ("Wednesday, 1 October 2026"): the runtime's reading,
  // as a calendar day (not shifted through UTC).
  if (!/\d{4}/.test(s)) return null
  const t = Date.parse(s)
  if (Number.isNaN(t)) return null
  const d = new Date(t)
  return ymdOf(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

/** "Mon" for a date cell, "" when it isn't a date. */
export function dayOf(value: unknown): string {
  const d = cellDate(value)
  if (!d) return ""
  const t = Date.parse(`${d}T00:00:00Z`)
  return Number.isNaN(t) ? "" : DAYS[new Date(t).getUTCDay()]!
}

/** The best one-line name for a row, for notifications: theme, title, occasion... else "Row N". */
export function rowTitle(
  cells: Record<string, unknown>,
  byKey: ReadonlyMap<string, { id: string }>,
  position: number,
): string {
  for (const key of [
    "theme",
    "title",
    "subject",
    "occasion",
    "hook",
    "keyword",
    "angle",
    "page",
    "partner",
    "lead",
    "outlet",
    "deliverable",
    "message",
    "caption",
  ]) {
    const column = byKey.get(key)
    const v = column ? cells[column.id] : null
    if (typeof v === "string" && v.trim()) return v.trim().replace(/\s+/g, " ").slice(0, 80)
  }
  return `Row ${position + 1}`
}
