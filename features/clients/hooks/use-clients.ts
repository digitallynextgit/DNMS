"use client"

import { useQuery, keepPreviousData } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api-fetch"
import type { PaginationMeta } from "@/components/shared/pagination"
import type { ClientModuleKey } from "@/features/client-portal"

// ─── Types (mirror features/clients/server/clients.queries.ts) ───────────────

export interface ClientPerson {
  id: string
  firstName: string
  lastName: string
  profilePhoto: string | null
}

export interface ClientStats {
  projects: number
  activeProjects: number
  contacts: number
  activeContacts: number
  lastLoginAt: string | null
}

export interface ClientListItem {
  id: string
  name: string
  code: string
  slug: string | null
  status: string
  industry: string | null
  website: string | null
  email: string | null
  phone: string | null
  ownerId: string | null
  createdAt: string
  updatedAt: string
  owner: ClientPerson | null
  stats: ClientStats
}

/** Whole-book totals for the strip above the directory. Unaffected by filters. */
export interface ClientBookSummary {
  clients: number
  activeClients: number
  projects: number
  contacts: number
}

export interface ClientProject {
  id: string
  name: string
  code: string
  slug: string | null
  logo: string | null
  status: string
  priority: string
  startDate: string | null
  createdAt: string
  owner: ClientPerson
  _count: { tasks: number; teams: number }
}

export interface ClientGrant {
  id: string
  modules: ClientModuleKey[]
  status: "ACTIVE" | "SUSPENDED"
  createdAt: string
  project: { id: string; name: string; code: string; slug: string | null }
}

export interface ClientContact {
  id: string
  name: string
  email: string
  phone: string | null
  isActive: boolean
  mustChangePassword: boolean
  lastLoginAt: string | null
  createdAt: string
  access: ClientGrant[]
}

/** The detail page's payload: the client, its projects and its people. */
export interface ClientRecord extends ClientListItem {
  address: string | null
  taxId: string | null
  notes: string | null
  createdBy: { id: string; firstName: string; lastName: string } | null
  projects: ClientProject[]
  contacts: ClientContact[]
}

export interface ClientActivityEvent {
  id: string
  action: string
  module: string
  summary: string | null
  entityType: string | null
  createdAt: string
  clientUser: { id: string; name: string; email: string }
  project: { id: string; name: string; slug: string | null } | null
}

export interface ClientListParams {
  search?: string
  status?: string
  ownerId?: string
  page?: number
  limit?: number
}

// ─── Keys ────────────────────────────────────────────────────────────────────
// ["client", ref] is a prefix for the detail AND its activity pages, so one
// invalidation after a mutation on any tab refreshes both.

export const clientKeys = {
  all: ["clients"] as const,
  list: (params: ClientListParams) => ["clients", params] as const,
  detail: (ref: string) => ["client", ref] as const,
  activity: (ref: string, page: number) => ["client", ref, "activity", page] as const,
}

function query(params: object): string {
  const s = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") s.set(k, String(v))
  }
  const str = s.toString()
  return str ? `?${str}` : ""
}

// ─── Queries ─────────────────────────────────────────────────────────────────
// Envelope: withAuth → respond() wraps the service payload under `data`, so a
// paginated list arrives as res.data.data + res.data.pagination.

export function useClients(params: ClientListParams = {}, opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: clientKeys.list(params),
    queryFn: async () =>
      (
        await apiFetch<{
          data: { data: ClientListItem[]; pagination: PaginationMeta; summary: ClientBookSummary }
        }>(`/api/clients${query(params)}`)
      ).data,
    placeholderData: keepPreviousData,
    enabled: opts.enabled ?? true,
  })
}

export function useClient(ref: string | undefined) {
  return useQuery({
    queryKey: clientKeys.detail(ref ?? ""),
    queryFn: async () => (await apiFetch<{ data: ClientRecord }>(`/api/clients/${ref}`)).data,
    enabled: !!ref,
    staleTime: 30_000,
  })
}

export function useClientActivity(ref: string | undefined, page: number) {
  return useQuery({
    queryKey: clientKeys.activity(ref ?? "", page),
    queryFn: async () =>
      (
        await apiFetch<{ data: { data: ClientActivityEvent[]; pagination: PaginationMeta } }>(
          `/api/clients/${ref}/activity?page=${page}&limit=25`,
        )
      ).data,
    placeholderData: keepPreviousData,
    enabled: !!ref,
  })
}
