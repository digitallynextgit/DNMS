// The work report as data. Built once by the server loader, then drawn by the
// PPTX, PDF and DOCX renderers - none of them queries anything.

export type WorkReportFormat = "pptx" | "pdf" | "docx"

/** Who is asking decides who they may report on. */
export type WorkReportRole = "admin" | "manager" | "member"

export interface WorkReportScopePerson {
  id: string
  name: string
  designation: string | null
  department: string | null
  /** In the caller's own reporting line (direct, indirect or dotted). */
  inTeam: boolean
  isMe: boolean
}

export interface WorkReportScopeData {
  role: WorkReportRole
  people: WorkReportScopePerson[]
  /** The default month: the one before today. */
  defaultMonth: string
  aiAvailable: boolean
}

export interface ProjectHours {
  project: string
  hours: number
}

export interface DayLine {
  project: string
  hours: number
  text: string
}

export interface DayRow {
  date: string
  /** "work" = tracked day; "leave" = full-day leave; "idle" = present, nothing tracked. */
  kind: "work" | "leave" | "idle"
  label?: string
  wfh: boolean
  halfDayLeave: boolean
  hours: number
  lines: DayLine[]
}

export interface OpenItem {
  project: string
  text: string
  status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "ON_HOLD"
  due: string | null
}

export interface CappedClock {
  date: string
  project: string
  task: string
  leftRunningHours: number
  countedHours: number
}

export interface PersonReport {
  id: string
  name: string
  designation: string | null
  department: string | null
  totalHours: number
  projectHours: ProjectHours[]
  workingDays: number
  wfhDays: number
  leaveDays: { date: string; type: string; days: number }[]
  officeDays: number
  officeHours: number
  tasksWorked: number
  tasksDone: number
  highlights: string[]
  focus: string
  days: DayRow[]
  openItems: OpenItem[]
  capped: CappedClock[]
}

export interface ImpactCard {
  project: string
  /** People (ids) who logged time on it, most hours first. */
  owners: string[]
  hours: number
  bullets: string[]
}

export interface WorkReport {
  period: { month: string; from: string; to: string; label: string }
  /** "Web Development Team", "Diwakar Jha", "Team report". */
  title: string
  preparedBy: { name: string; designation: string | null }
  generatedAt: string
  holidays: { date: string; name: string }[]
  people: PersonReport[]
  team: {
    totalHours: number
    tasksDone: number
    projects: { project: string; total: number; byPerson: Record<string, number> }[]
    adhocHours: number
  }
  impact: ImpactCard[]
  /** True when the highlights and impact text were rewritten by AI. */
  aiPolished: boolean
}

export interface BuiltWorkReport {
  bytes: Uint8Array<ArrayBuffer>
  filename: string
  contentType: string
}
