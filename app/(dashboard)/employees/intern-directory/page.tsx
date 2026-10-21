import { HydrationBoundary, dehydrate } from "@tanstack/react-query"

import { getQueryClient } from "@/lib/query-server"
import { directoryPageSize } from "@/features/employees/lib/directory-page-size"
import { getEmployees } from "@/features/employees/server/employees.service"

import { EmployeeDirectoryClient } from "../employee-directory/employee-directory-client"

type SearchParams = Record<string, string | string[] | undefined>

/** Mimic `URLSearchParams.get()`, which yields the FIRST value of a repeated key. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/**
 * The Employee Directory restricted to interns (employmentType INTERN). Same prefetch contract as
 * the employee directory: the key MUST match the client's filters exactly or it refetches.
 */
export default async function InternDirectoryPage({
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
  const limit = directoryPageSize(first(sp.limit))

  const filters = {
    search,
    departmentId: departmentId || undefined,
    status: status || undefined,
    employmentType: "INTERN",
    page,
    limit,
  }

  const queryClient = getQueryClient()

  try {
    await queryClient.prefetchQuery({
      queryKey: ["employees", filters],
      queryFn: async () => {
        const result = await getEmployees(filters)
        if (!result.ok) throw new Error(result.error)
        return result.data
      },
    })
  } catch (error) {
    // Never 500 the page over a prefetch - the client hook fetches on mount instead.
    console.error("[INTERN_DIRECTORY_PREFETCH]", error)
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <EmployeeDirectoryClient kind="intern" />
    </HydrationBoundary>
  )
}
