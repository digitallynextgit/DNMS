/**
 * The vocabulary of the AI briefing builder.
 *
 * Shared by the options dialog and the route that writes the prompt, so a report
 * type or section can never exist on screen without the prompt knowing how to
 * render it. Plain data - no "use client", no "server-only", imported by both.
 */

export type ReportType = "portfolio" | "project" | "team" | "individual"

/** Which scope pickers a report type can be narrowed by. */
export type ScopeKind = "projects" | "teams" | "people"

export interface ReportTypeDef {
  key: ReportType
  label: string
  hint: string
  scopes: ScopeKind[]
  /** The angle the model is told to analyse from. */
  lens: string
  /** How the data block is grouped. The route switches on this. */
  groupBy: "none" | "project" | "team" | "employee"
}

export const REPORT_TYPES: ReportTypeDef[] = [
  {
    key: "portfolio",
    label: "Portfolio overview",
    hint: "Everything at once, project against project",
    scopes: ["projects"],
    lens: "Assess the health of the portfolio as a whole, then call out the projects that stand apart from it in either direction.",
    groupBy: "project",
  },
  {
    key: "project",
    label: "Project performance",
    hint: "One or more projects in depth",
    scopes: ["projects", "teams"],
    lens: "Go project by project. For each, say whether it is on track and what specifically is holding it back.",
    groupBy: "project",
  },
  {
    key: "team",
    label: "Team performance",
    hint: "How each team is delivering",
    scopes: ["projects", "teams"],
    lens: "Compare the teams against each other. Attribute delivery to the team, not to individuals, unless one person is the whole reason for a team's number.",
    groupBy: "team",
  },
  {
    key: "individual",
    label: "Individual performance",
    hint: "Person by person",
    scopes: ["projects", "teams", "people"],
    lens: "Go person by person. Be concrete about what each person completed, what they are carrying, and what is late. Judge people against their own load, never against a raw count someone else happens to have.",
    groupBy: "employee",
  },
]

/** Accepts anything so the API route can snap an untrusted body to a known type. */
export function reportType(key: unknown): ReportTypeDef {
  return REPORT_TYPES.find((t) => t.key === key) ?? REPORT_TYPES[0]!
}

export type ReportSection =
  | "overall"
  | "onTrack"
  | "attention"
  | "urgent"
  | "blockers"
  | "workload"
  | "quality"
  | "actions"

export interface ReportSectionDef {
  key: ReportSection
  label: string
  /** The exact bold heading the model must emit. */
  heading: string
  instruction: string
  /** Offered only for these report types. Absent = all of them. */
  only?: ReportType[]
}

export const REPORT_SECTIONS: ReportSectionDef[] = [
  {
    key: "overall",
    label: "Overall",
    heading: "Overall",
    instruction: "Two or three lines on the headline position. Lead with the number that matters.",
  },
  {
    key: "onTrack",
    label: "What is on track",
    heading: "On track",
    instruction: "What is genuinely going well, with the counts that show it.",
  },
  {
    key: "attention",
    label: "Needs attention",
    heading: "Needs attention",
    instruction:
      "Where delivery is slipping. Name the project, team or person and the evidence. Do not soften it.",
  },
  {
    key: "urgent",
    label: "Urgent this week",
    heading: "Urgent this week",
    instruction: "Only what is overdue or due within the next seven days. Most urgent first.",
  },
  {
    key: "blockers",
    label: "Blockers and on-hold",
    heading: "Blockers",
    instruction:
      "On-hold work: the reason given and the date it is expected to move. Flag anything on hold with no expected date.",
  },
  {
    key: "workload",
    label: "Workload balance",
    heading: "Workload balance",
    instruction:
      "Who or which team is carrying too much or too little, comparing assigned counts against completion rates. Say if the spread looks reasonable.",
  },
  {
    key: "quality",
    label: "On-time delivery",
    heading: "On-time delivery",
    instruction:
      "How much completed work landed by its due date, and where late delivery clusters.",
  },
  {
    key: "actions",
    label: "Suggested actions",
    heading: "Suggested actions",
    instruction:
      "Concrete next steps a manager can take this week. Each one must point at named work or a named person.",
  },
]

export function reportSection(key: ReportSection): ReportSectionDef | undefined {
  return REPORT_SECTIONS.find((s) => s.key === key)
}

/** Sections offered for a given report type, in canonical order. */
export function sectionsFor(type: ReportType): ReportSectionDef[] {
  return REPORT_SECTIONS.filter((s) => !s.only || s.only.includes(type))
}

export const DEFAULT_SECTIONS: ReportSection[] = [
  "overall",
  "onTrack",
  "attention",
  "urgent",
  "actions",
]

export interface ReportConfig {
  type: ReportType
  projectIds: string[]
  teamIds: string[]
  employeeIds: string[]
  sections: ReportSection[]
}

export const DEFAULT_REPORT_CONFIG: ReportConfig = {
  type: "portfolio",
  projectIds: [],
  teamIds: [],
  employeeIds: [],
  sections: DEFAULT_SECTIONS,
}

/**
 * Keep a config coherent after the type changes: drop scopes the new type has no
 * picker for (otherwise an invisible team filter silently narrows the report)
 * and sections it does not offer.
 */
export function reconcileConfig(config: ReportConfig): ReportConfig {
  const def = reportType(config.type)
  const allowed = new Set(sectionsFor(config.type).map((s) => s.key))
  const sections = config.sections.filter((s) => allowed.has(s))
  return {
    ...config,
    projectIds: def.scopes.includes("projects") ? config.projectIds : [],
    teamIds: def.scopes.includes("teams") ? config.teamIds : [],
    employeeIds: def.scopes.includes("people") ? config.employeeIds : [],
    sections: sections.length > 0 ? sections : DEFAULT_SECTIONS.filter((s) => allowed.has(s)),
  }
}

/** One-line summary of what will be generated, for the trigger button. */
export function describeConfig(config: ReportConfig): string {
  const def = reportType(config.type)
  const bits: string[] = [def.label]
  const scope: string[] = []
  if (def.scopes.includes("projects")) {
    scope.push(
      config.projectIds.length === 0
        ? "all projects"
        : `${config.projectIds.length} project${config.projectIds.length === 1 ? "" : "s"}`,
    )
  }
  if (def.scopes.includes("teams") && config.teamIds.length > 0) {
    scope.push(`${config.teamIds.length} team${config.teamIds.length === 1 ? "" : "s"}`)
  }
  if (def.scopes.includes("people") && config.employeeIds.length > 0) {
    scope.push(
      `${config.employeeIds.length} ${config.employeeIds.length === 1 ? "person" : "people"}`,
    )
  }
  if (scope.length > 0) bits.push(scope.join(", "))
  bits.push(`${config.sections.length} section${config.sections.length === 1 ? "" : "s"}`)
  return bits.join(" · ")
}
