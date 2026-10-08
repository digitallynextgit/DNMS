import { HydrationBoundary, dehydrate } from "@tanstack/react-query"

import { getQueryClient } from "@/lib/query-server"
import { getEmployees } from "@/features/employees/server/employees.service"

import { EmployeeDirectoryClient } from "./employee-directory-client"

type SearchParams = Record<string, string | string[] | undefined>

/** Mimic `URLSearchParams.get()`, which yields the FIRST value of a repeated key. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/**
 * Prefetches the first page so the client's useEmployees() paints from a warm cache. The key
 * MUST match the client's filters exactly (derived from the URL the same way) or it refetches.
 */
export default async function EmployeeDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams

  const search = first(sp.search) ?? ""
  const departmentId = first(sp.departmentId) ?? ""
  const statusParam = first(sp.status) ?? "ACTIVE"
  const status = statusParam === "all" ? "" : statusParam
  const page = Math.max(1, Number(first(sp.page) ?? "1"))

  const filters = {
    search,
    departmentId: departmentId || undefined,
    status: status || undefined,
    page,
    limit: 10,
  }

  const queryClient = getQueryClient()

  try {
    await queryClient.prefetchQuery({
      queryKey: ["employees", filters],
      // Same service as the API route; it already serialize()s, so the cache matches the wire shape.
      // The client's queryFn unwraps { data }, so result.data is cached.
      queryFn: async () => {
        const result = await getEmployees(filters)
        if (!result.ok) throw new Error(result.error)
        return result.data
      },
    })
  } catch (error) {
    // Never 500 the page over a prefetch - the client hook fetches on mount instead.
    console.error("[EMPLOYEE_DIRECTORY_PREFETCH]", error)
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <EmployeeDirectoryClient />
    </HydrationBoundary>
  )
}
