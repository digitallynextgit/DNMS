import type { Metadata } from "next"
import type { ReactNode } from "react"

import { tenantScopedSession } from "@/server/tenant-request"
import { getProjectTitle } from "@/features/projects/server/projects.queries"

const DESCRIPTION = "A project's teams, tasks, messages and delivery."

/**
 * The tab reads the project's name, not "Project".
 *
 * The page itself is a client component and cannot set metadata, so the name is
 * looked up here, once per navigation. `tenantScopedSession()` rather than
 * `auth()`: a layout renders outside every route wrapper, and without it the
 * lookup would run with no tenant context. The root layout's template turns
 * the name into "RUDIONE / LEOCYM | DNMS".
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const session = await tenantScopedSession()
  const name = session ? await getProjectTitle(id, session) : null
  return { title: name ?? "Project", description: DESCRIPTION }
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
