// Public Careers API contract, shared with the marketing site. No runtime dependencies - safe to copy.

export type CareersTone = "red" | "teal"
export type CareersMode = "full-time" | "internship"

export type CareersRoleDescription = {
  intro: string
  jobEssence?: string
  keyRequirements?: string[]
  currentOpenings?: string[]
}

export type CareersRole = {
  id: string
  title: string
  meta?: string
  summary?: string
  description?: CareersRoleDescription
}

export type CareersDepartment = {
  id: string
  title: string
  jobsLabel: string
  tone: CareersTone
  roles: CareersRole[]
}

export type CareersApiResponse = {
  generatedAt: string
  fullTime: CareersDepartment[]
  internship: CareersDepartment[]
}

export const DEFAULT_CAREERS_TONE: CareersTone = "teal"
export const DEFAULT_CAREERS_JOBS_LABEL = "Explore Open Roles"
export const DEFAULT_INTERNSHIP_JOBS_LABEL = "Explore Open Positions"

export function slugifyCareer(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[‒-―]/g, "-")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
}
