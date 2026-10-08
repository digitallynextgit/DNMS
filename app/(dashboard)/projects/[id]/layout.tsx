import type { Metadata } from "next"
import type { ReactNode } from "react"

import { tenantScopedSession } from "@/server/tenant-request"
import { getProjectTitle } from "@/features/projects/server/projects.queries"

const DESCRIPTION = "A project's teams, tasks, messages and delivery."

/**
 * The page is a client component and can't set metadata, so the project name is looked up here.
 * tenantScopedSession(), not auth(): a layout renders outside every route wrapper.
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
