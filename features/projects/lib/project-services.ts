/**
 * Services a project can include, in the order they are listed everywhere. Each ticked service gets
 * its own monthly calendar (`calendar`), managed by the service's owner.
 */
export const PROJECT_SERVICES = [
  {
    code: "SMO",
    label: "SMO",
    name: "Social Media",
    calendar: { name: "Social Media Calendar", tabs: ["Instagram", "LinkedIn", "YouTube", "X"] },
  },
  {
    code: "SEO",
    label: "SEO",
    name: "SEO / AEO / GEO",
    calendar: { name: "SEO / AEO / GEO Calendar", tabs: ["Calendar"] },
  },
  {
    code: "PM",
    label: "PM",
    name: "Paid Performance",
    calendar: { name: "Paid Performance Calendar", tabs: ["Calendar"] },
  },
  {
    code: "MSG",
    label: "Email/WA/SMS",
    name: "Email, WhatsApp & SMS",
    calendar: { name: "Email / WhatsApp / SMS Calendar", tabs: ["Calendar"] },
  },
  {
    code: "INF",
    label: "Inf.",
    name: "Influencers & Collabs",
    calendar: { name: "Influencers & Collabs Calendar", tabs: ["Calendar"] },
  },
  {
    code: "ALL",
    label: "All.",
    name: "Alliances & Partnerships",
    calendar: { name: "Alliances & Partnerships Calendar", tabs: ["Calendar"] },
  },
  {
    code: "DPR",
    label: "DPR",
    name: "Digital PR",
    calendar: { name: "Digital PR Calendar", tabs: ["Calendar"] },
  },
  {
    code: "WEB",
    label: "Web",
    name: "Website",
    calendar: { name: "Website Calendar", tabs: ["Calendar"] },
  },
  {
    code: "CAMP",
    label: "Camp.",
    name: "Campaign Planning",
    calendar: { name: "Campaign Planning Calendar", tabs: ["Calendar"] },
  },
  {
    code: "OFF",
    label: "Offline",
    name: "Offline Marketing",
    calendar: { name: "Offline Marketing Calendar", tabs: ["Calendar"] },
  },
  {
    code: "BD",
    label: "BD",
    name: "BD / Sales",
    calendar: { name: "BD / Sales Calendar", tabs: ["Calendar"] },
  },
  {
    code: "BRAND",
    label: "Brand",
    name: "Branding Kit",
    calendar: { name: "Branding Kit Calendar", tabs: ["Calendar"] },
  },
] as const

/** Campaign Planning sets the direction every other calendar follows. */
export const LEAD_SERVICE = "CAMP"

export type ProjectServiceCode = (typeof PROJECT_SERVICES)[number]["code"]

const ORDER = new Map<string, number>(PROJECT_SERVICES.map((s, i) => [s.code, i]))

export function isProjectService(code: unknown): code is ProjectServiceCode {
  return typeof code === "string" && ORDER.has(code)
}

/** Known codes only, each once, in catalogue order. Anything else is dropped. */
export function normaliseServices(input: unknown): ProjectServiceCode[] {
  if (!Array.isArray(input)) return []
  const codes = [...new Set(input.filter(isProjectService))]
  return codes.sort((a, b) => ORDER.get(a)! - ORDER.get(b)!)
}

export function serviceInfo(code: string) {
  return PROJECT_SERVICES.find((s) => s.code === code)
}

/** The person answering for one service on a project. */
export interface ServiceOwner {
  service: string
  employee: { id: string; firstName: string; lastName: string; profilePhoto: string | null }
}

/** "SEO (Priya Sharma), Web" - for exports and other plain-text places. */
export function servicesText(services: readonly string[], owners: readonly ServiceOwner[] = []) {
  return normaliseServices(services)
    .map((code) => {
      const label = serviceInfo(code)?.label ?? code
      const owner = owners.find((o) => o.service === code)?.employee
      return owner ? `${label} (${`${owner.firstName} ${owner.lastName}`.trim()})` : label
    })
    .join(", ")
}

export const SHORT_NAME_MAX = 24

/** Trimmed, inner spaces collapsed; empty means "no short name". */
export function normaliseShortName(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const s = raw.trim().replace(/\s+/g, " ")
  return s || null
}

/** Why a short name can't be used, or null when it's fine. */
export function shortNameProblem(shortName: string): string | null {
  if (shortName.length > SHORT_NAME_MAX)
    return `Keep the short name to ${SHORT_NAME_MAX} characters.`
  if (!/^[\p{L}\p{N}][\p{L}\p{N} &.+-]*$/u.test(shortName))
    return "Use letters and numbers (spaces, &, ., + and - are fine), starting with a letter or number."
  return null
}
