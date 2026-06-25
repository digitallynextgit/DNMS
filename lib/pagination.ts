/**
 * Shared pagination helpers for server actions and API route handlers.
 *
 * `resolvePagination` clamps incoming page/limit params (default slot = 10,
 * max 100) and computes the Prisma `skip`/`take`. `paginationMeta` builds the
 * canonical response shape consumed by the client `<Pagination>` component.
 */

export interface PaginationInput {
  page?: number | string | null
  limit?: number | string | null
}

export interface PaginationMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ResolvedPagination {
  page: number
  limit: number
  skip: number
  take: number
}

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 100

/** Clamp page/limit and derive `skip`/`take` for a Prisma `findMany`. */
export function resolvePagination(
  input: PaginationInput = {},
  defaultLimit: number = DEFAULT_LIMIT,
  maxLimit: number = MAX_LIMIT,
): ResolvedPagination {
  const page = Math.max(1, Number(input.page ?? 1) || 1)
  const limit = Math.min(maxLimit, Math.max(1, Number(input.limit ?? defaultLimit) || defaultLimit))
  return { page, limit, skip: (page - 1) * limit, take: limit }
}

/** Build the canonical `{ total, page, limit, totalPages }` metadata object. */
export function paginationMeta(total: number, page: number, limit: number): PaginationMeta {
  return { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) }
}
