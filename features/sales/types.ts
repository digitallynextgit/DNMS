import type { Stage } from "./lib/sales"

export interface LeadPerson {
  id: string
  firstName: string
  lastName: string
  profilePhoto: string | null
}

export interface LeadRow {
  id: string
  business: string
  contactName: string | null
  phone: string | null
  email: string | null
  website: string | null
  category: string | null
  area: string | null
  city: string | null
  address: string | null
  mapsUrl: string | null
  rating: number | null
  reviewsCount: number | null
  stage: Stage
  lostReason: string | null
  value: number | null
  assignee: LeadPerson | null
  /** YYYY-MM-DD */
  nextFollowUp: string | null
  doNotContact: boolean
  source: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  lastActivity: { kind: string; at: string } | null
}

export interface LeadActivityRow {
  id: string
  kind: string
  note: string | null
  fromStage: string | null
  toStage: string | null
  createdAt: string
  actor: LeadPerson | null
}
