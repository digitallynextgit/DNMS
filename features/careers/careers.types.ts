// Careers public API contract + admin row types.
//
// The public contract (CareersDepartmentGroup[]) is exactly what the marketing
// site renders, so the site swap is a one-line change. See temp/README.md §4.

import type { CareersTone } from "@/features/recruitment/careers-types"

export type { CareersTone }
export type CareersMode = "full-time" | "internship"
export type CareerDbMode = "FULL_TIME" | "INTERNSHIP"
export type CareerStatus = "DRAFT" | "PUBLISHED"

// ─── Public contract (consumed by the marketing site) ───────────────────────
export interface PublicCareerRoleDescription {
  intro: string
  jobEssence?: string
  keyRequirements: string[]
  currentOpenings: string[]
}
export interface PublicCareerRole {
  id: string // role slug
  title: string
  meta: string | null
  summary: string | null
  description: PublicCareerRoleDescription | null
}
export interface PublicCareerSubDepartment {
  id: string // sub-department slug
  title: string
  jobsLabel: string
  tone: CareersTone
  roles: PublicCareerRole[]
}
export interface CareersDepartmentGroup {
  id: string // group slug
  code: string
  title: string
  jobsLabel: string
  tone: CareersTone
  subDepartments: PublicCareerSubDepartment[]
}

// ─── Admin row types (the management tree, all statuses) ─────────────────────
export interface AdminCareerOpening {
  id: string
  label: string
  order: number
  status: CareerStatus
}
export interface AdminCareerRole {
  id: string
  title: string
  slug: string
  meta: string | null
  summary: string | null
  intro: string | null
  jobEssence: string | null
  keyRequirements: string[]
  order: number
  status: CareerStatus
  openings: AdminCareerOpening[]
}
export interface AdminCareerSubDepartment {
  id: string
  title: string
  slug: string
  jobsLabel: string
  tone: string
  order: number
  status: CareerStatus
  roles: AdminCareerRole[]
}
export interface AdminCareerGroup {
  id: string
  mode: CareerDbMode
  code: string
  title: string
  slug: string
  jobsLabel: string
  tone: string
  order: number
  status: CareerStatus
  subDepartments: AdminCareerSubDepartment[]
}

/** `?mode=full-time` → DB enum. Defaults to FULL_TIME. */
export function toDbMode(mode: string | null | undefined): CareerDbMode {
  return mode === "internship" || mode === "INTERNSHIP" ? "INTERNSHIP" : "FULL_TIME"
}
