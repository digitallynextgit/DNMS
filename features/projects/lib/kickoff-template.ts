// The pre-campaign "must-haves" an Account Manager completes before a campaign kicks off. Keys are
// stored per project, so renaming text is safe; changing a key makes a new item.

export interface KickoffTemplateSection {
  key: string
  title: string
  items: { key: string; text: string }[]
}

export const KICKOFF_SECTIONS: readonly KickoffTemplateSection[] = [
  {
    key: "strategy",
    title: "Strategy and business overview plan",
    items: [
      { key: "strategy.lobs", text: "Lines of business (LoBs)" },
      { key: "strategy.markets", text: "Markets" },
      { key: "strategy.competition", text: "Competition" },
      { key: "strategy.fab", text: "FAB (features, advantages, benefits)" },
      { key: "strategy.usp", text: "USP" },
    ],
  },
  {
    key: "journey",
    title: "User journey flow chart",
    items: [
      { key: "journey.prospects", text: "Prospects" },
      { key: "journey.customers", text: "Customers" },
    ],
  },
  {
    key: "hub-spoke",
    title: "Hub-spoke model / flow chart",
    items: [
      { key: "hub-spoke.ltv", text: "LTV" },
      { key: "hub-spoke.profile", text: "User profile" },
    ],
  },
  {
    key: "seven-ps",
    title: "7 Ps value offerings mapped with the LTV plan",
    items: [{ key: "seven-ps.map", text: "7 Ps value offerings mapped with the LTV plan" }],
  },
  {
    key: "quadrants",
    title: "Hub-spoke presentation of the 4 priority quadrants",
    items: [{ key: "quadrants.deck", text: "Constituents of the 4 priority quadrants presented" }],
  },
  {
    key: "manifestation",
    title: "Manifestation plan",
    items: [{ key: "manifestation.plan", text: "Finalised, with theme activation timelines" }],
  },
  {
    key: "create-phase",
    title: "Hub-spoke model for the create phase",
    items: [{ key: "create-phase.model", text: "Hub-spoke model for the create phase" }],
  },
  {
    key: "milestones",
    title: "Milestones + hub-spoke model | flow chart | funnel | calendar",
    items: [
      { key: "milestones.content", text: "Content formats: text | graphics | video scripts" },
      { key: "milestones.visuals", text: "Visual formats: graphics | videos" },
      { key: "milestones.digital-pr", text: "Digital PR" },
      { key: "milestones.paid-ads", text: "Paid ads: Meta | Google" },
      { key: "milestones.marketplaces", text: "Marketplaces | Q-commerce" },
      { key: "milestones.affiliates", text: "Affiliates | collabs" },
      { key: "milestones.ugc", text: "UGC | influencers | celebrities" },
      { key: "milestones.smo", text: "SMO" },
      { key: "milestones.organic", text: "Organic: SEO, AEO, GEO | ORM" },
      { key: "milestones.website", text: "Website updates / dynamic content" },
    ],
  },
  {
    key: "analytics",
    title: "Analytics",
    items: [
      { key: "analytics.impact", text: "Impact" },
      { key: "analytics.metrics", text: "Metrics definition" },
      { key: "analytics.reports", text: "Reports" },
      { key: "analytics.iterations", text: "Suggestive iterations" },
    ],
  },
  {
    key: "planning",
    title: "Planning and evaluation",
    items: [
      { key: "planning.checklist", text: "Complete work checklist of the account" },
      { key: "planning.allocation", text: "Work and time allocation as per JD / KRAs" },
      {
        key: "planning.weekly",
        text: "Account-wise work and time allocation, with weekly objectives ready for at least 4 weeks",
      },
      {
        key: "planning.reports",
        text: "Account-wise reports: output performance + impact highlights",
      },
    ],
  },
]

export const KICKOFF_TOTAL = KICKOFF_SECTIONS.reduce((n, s) => n + s.items.length, 0)

export const KICKOFF_KEYS = new Set(KICKOFF_SECTIONS.flatMap((s) => s.items.map((i) => i.key)))

export interface KickoffItemView {
  key: string
  text: string
  isDone: boolean
  doneAt: string | Date | null
  doneBy: { id: string; firstName: string; lastName: string } | null
  note: string | null
}

export interface KickoffView {
  done: number
  total: number
  sections: { key: string; title: string; items: KickoffItemView[] }[]
}

export interface KickoffProgress {
  done: number
  total: number
}
