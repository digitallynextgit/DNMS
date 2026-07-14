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
 * Server shell for the employee directory: prefetch the first page of the list
 * so EmployeeDirectoryClient's `useEmployees(...)` finds a warm cache and paints
 * immediately, with no client fetch on first load.
 *
 * The query key below MUST stay byte-identical to the filters object the client
 * passes to `useEmployees` (see employee-directory-client.tsx), or React Query
 * treats it as a different query and refetches - wasting the prefetch.
 * The client derives those filters from the URL, so we derive them the same way:
 *   - search:       `?search` (the debounce hook returns its initial value
 *                   synchronously, so the first render already uses it), else ""
 *   - departmentId: `?departmentId`, empty → undefined
 *   - status:       `?status`, defaulting to "ACTIVE"
 *   - page:         `?page`, min 1
 *   - limit:        always 10
 */
export default async function EmployeeDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams

  const search = first(sp.search) ?? ""
  const departmentId = first(sp.departmentId) ?? ""
  const status = first(sp.status) ?? "ACTIVE"
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
      // Same service the API route calls (app/api/employees/route.ts), so no auth
      // re-check and no network hop. `getEmployees` already `serialize()`s its
      // payload, so the cached value matches the wire shape exactly. The client's
      // queryFn unwraps the `{ data }` envelope, so we cache `result.data`.
      queryFn: async () => {
        const result = await getEmployees(filters)
        if (!result.ok) throw new Error(result.error)
        return result.data
      },
    })
  } catch (error) {
    // Never 500 the page over a prefetch (e.g. missing employee:read) - the
    // client hook will fetch on mount, exactly as it did before.
    console.error("[EMPLOYEE_DIRECTORY_PREFETCH]", error)
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <EmployeeDirectoryClient />
    </HydrationBoundary>
  )
}
