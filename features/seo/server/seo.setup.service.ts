import "server-only"

import { db } from "@/server/db"

// =============================================================================
// "What do I do next?" for one tracked site.
//
// The SEO module has a lot of surface (10 plan steps), and an operator landing on
// it cold cannot tell what is configured, what is missing, or which gap is
// costing them the most. This turns that into an ordered checklist: each step
// knows whether it's done, what it unlocks, and which action fixes it - so the
// UI can render a guided flow instead of a wall of empty tabs.
//
// Order matters: earlier steps unblock later ones (no Search Console => no
// keywords => no backlog), so the first incomplete step is genuinely "next".
// =============================================================================

/** Which UI affordance resolves this step. */
export type SetupAction =
  | "EDIT_SITE" // open the site settings dialog
  | "SYNC" // pull Search Console
  | "KEYWORDS" // generate the backlog
  | "COMPETITORS" // run the competitor gap
  | "TECHNICAL" // run a technical audit
  | "VITALS" // measure Core Web Vitals
  | "BACKLINKS" // import a backlink export
  | "SCORECARD" // build the scorecard

/** Which single setting an EDIT_SITE step should open, so the guide never sends
 *  someone to a form holding eight fields they did not ask for. */
export type SetupField = "identity" | "gsc" | "keywords" | "pages" | "competitors" | "ga4"

export interface SetupStep {
  id: string
  title: string
  /** Plain-language: what this step is and why it matters. */
  description: string
  done: boolean
  /** Not required to get value, but improves the picture. */
  optional: boolean
  /** What completing it unlocks, the reason to bother. */
  impact: string
  action: SetupAction
  /** The one setting to open when action is EDIT_SITE. */
  field?: SetupField
  /** AI can propose values for this step. */
  aiAssist?: "keywords" | "competitors"
}

export interface SetupState {
  steps: SetupStep[]
  completed: number
  total: number
  percent: number
  /** First incomplete required step, or null when the essentials are done. */
  nextStepId: string | null
  /** Scorecard points currently unmeasurable because of missing config. */
  lockedPoints: number
}

export async function getSetupState(propertyId: string): Promise<SetupState | null> {
  const property = await db.seoProperty.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      siteUrl: true,
      gaPropertyId: true,
      moneyKeywords: true,
      moneyPages: true,
      competitors: true,
      lastSyncedAt: true,
    },
  })
  if (!property) return null

  const [snapshots, keywords, audits, vitals, backlinks, scorecards, competitorRuns] =
    await Promise.all([
      db.seoSnapshot.count({ where: { propertyId } }),
      db.seoKeyword.count({ where: { propertyId } }),
      db.seoTechnicalAudit.count({ where: { propertyId } }),
      db.seoVitals.count({ where: { propertyId } }),
      db.seoBacklink.count({ where: { propertyId } }),
      db.seoScorecard.count({ where: { propertyId } }),
      db.seoCompetitorAudit.count({ where: { propertyId } }),
    ])

  const steps: SetupStep[] = [
    {
      id: "gsc",
      title: "Connect Search Console",
      description:
        "Point this site at its Search Console property and pull its history. This is the backbone - queries, clicks and positions all come from here.",
      done: snapshots > 0,
      optional: false,
      impact: "Unlocks Growth, Keywords and 45 scorecard points",
      action: snapshots > 0 ? "SYNC" : property.siteUrl ? "SYNC" : "EDIT_SITE",
      field: "gsc",
    },
    {
      id: "keywords",
      title: "Set your money keywords",
      description:
        "The 5 to 10 terms this site is judged on. They're tracked every week and alert you when they slip off page one.",
      done: property.moneyKeywords.length > 0,
      optional: false,
      impact: "Unlocks money-keyword tracking and 15 scorecard points",
      action: "EDIT_SITE",
      field: "keywords",
      aiAssist: "keywords",
    },
    {
      id: "pages",
      title: "Set your money pages",
      description:
        "The 5 to 10 pages that actually earn. Technical audits and Core Web Vitals run against these instead of guessing from traffic.",
      done: property.moneyPages.length > 0,
      optional: false,
      impact: "Focuses audits, vitals and the daily monitor on what matters",
      action: "EDIT_SITE",
      field: "pages",
    },
    {
      id: "competitors",
      title: "Add competitors",
      description:
        "3 to 5 real competitors. We crawl their pages and show which topics they cover that you don't.",
      done: property.competitors.length > 0,
      optional: false,
      impact: "Unlocks the Competitors tab (content gap analysis)",
      action: "EDIT_SITE",
      field: "competitors",
      aiAssist: "competitors",
    },
    {
      id: "ga4",
      title: "Connect GA4",
      description:
        "Add the GA4 numeric property id so conversions and AI-assistant referrals are counted. Search Console proves clicks; GA4 proves they pay.",
      done: !!property.gaPropertyId,
      optional: false,
      impact: "Unlocks 25 scorecard points (conversions and AI citations)",
      action: "EDIT_SITE",
      field: "ga4",
    },
    {
      id: "backlog",
      title: "Build the keyword backlog",
      description:
        "Turns your real Search Console queries into a scored, prioritised work-queue - what to write next, ranked.",
      done: keywords > 0,
      optional: false,
      impact: "Unlocks the Backlog tab and content briefs",
      action: "KEYWORDS",
    },
    {
      id: "technical",
      title: "Run a technical audit",
      description:
        "Crawls your money pages and checks sitemap + robots.txt for the errors that quietly cost rankings.",
      done: audits > 0,
      optional: false,
      impact: "Unlocks 5 scorecard points + the Technical tab",
      action: "TECHNICAL",
    },
    {
      id: "vitals",
      title: "Measure Core Web Vitals",
      description:
        "Real-user loading performance from Chrome (CrUX), falling back to a lab run. This is a live ranking signal.",
      done: vitals > 0,
      optional: false,
      impact: "Unlocks 5 scorecard points",
      action: "VITALS",
    },
    {
      id: "competitor-run",
      title: "Run the competitor gap analysis",
      description:
        "Crawl those competitors and list the topics they publish for and you don't - your content backlog.",
      done: competitorRuns > 0,
      optional: true,
      impact: "Produces a ready-made content gap list",
      action: "COMPETITORS",
    },
    {
      id: "backlinks",
      title: "Import your backlinks",
      description:
        "Paste an Ahrefs Webmaster Tools or Search Console links export. Re-import monthly to see what you gained and lost.",
      done: backlinks > 0,
      optional: true,
      impact: "Unlocks 10 scorecard points (referring domains)",
      action: "BACKLINKS",
    },
    {
      id: "scorecard",
      title: "Generate the scorecard",
      description:
        "The weighted health score across all ten plan metrics, with an honest coverage figure for what could actually be measured.",
      done: scorecards > 0,
      optional: false,
      impact: "Your single monthly health number",
      action: "SCORECARD",
    },
  ]

  // Scorecard weight that is currently unmeasurable purely because of config.
  let lockedPoints = 0
  if (property.moneyKeywords.length === 0) lockedPoints += 15
  if (!property.gaPropertyId) lockedPoints += 25 // conversions 20 + AI citations 5
  if (backlinks === 0) lockedPoints += 10
  if (vitals === 0) lockedPoints += 5
  if (audits === 0) lockedPoints += 5

  const required = steps.filter((s) => !s.optional)
  const completed = steps.filter((s) => s.done).length
  const nextStepId = required.find((s) => !s.done)?.id ?? null

  return {
    steps,
    completed,
    total: steps.length,
    percent: Math.round((completed / steps.length) * 100),
    nextStepId,
    lockedPoints,
  }
}
