import type { Metadata } from "next"
import type { ReactNode } from "react"

import { tenantScopedSession } from "@/server/tenant-request"
import { getClientTitle } from "@/features/clients/server/clients.queries"

const DESCRIPTION = "A client's projects, contacts and portal access."

/**
 * The tab reads the client's name, not "Client". Same shape as the project
 * layout: the page is a client component, so the name is looked up here with
 * the tenant context established.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const session = await tenantScopedSession()
  const name = session ? await getClientTitle(id, session) : null
  return { title: name ?? "Client", description: DESCRIPTION }
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
