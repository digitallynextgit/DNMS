import { redirect, notFound } from "next/navigation"
import { auth } from "@/server/auth"
import { listClientGrants } from "@/server/client-guard"
import { listClientChannels } from "@/features/client-portal/server/client-portal.queries"
import { Badge } from "@/components/ui/badge"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "Sales channels" }

interface Channel {
  id: string
  name: string
  provider: string
  status: string
  lastSyncedAt: string | null
  _count: { products: number }
}

const PROVIDER_LABELS: Record<string, string> = {
  SHOPIFY: "Shopify",
  AMAZON: "Amazon",
  FLIPKART: "Flipkart",
  MEESHO: "Meesho",
  MYNTRA: "Myntra",
  WOOCOMMERCE: "WooCommerce",
  OTHER: "Other",
}

export default async function PortalChannelsPage({
  params,
}: {
  params: Promise<{ projectRef: string }>
}) {
  const { projectRef } = await params
  const session = await auth()
  if (!session || session.user.kind !== "client") redirect("/client-login")

  const grant = (await listClientGrants(session.user.id)).find(
    (g) => g.projectRef === projectRef || g.projectId === projectRef,
  )
  if (!grant) notFound()
  if (!grant.modules.includes("channels")) notFound()

  // The query re-proves the grant and the module itself; this is a plain read.
  const result = await listClientChannels(projectRef)
  const channels: Channel[] = result.ok ? ((result.data as { data: Channel[] }).data ?? []) : []

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Sales channels</h1>
        <p className="text-muted-foreground text-sm">
          Where your products are listed, and when we last pulled data.
        </p>
      </div>

      {channels.length === 0 ? (
        <div className="text-muted-foreground rounded-md border border-dashed py-14 text-center text-sm">
          No sales channel is connected yet.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {channels.map((c) => (
            <div key={c.id} className="bg-card rounded-md border p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {PROVIDER_LABELS[c.provider] ?? c.provider}
                  </p>
                </div>
                <Badge
                  variant={c.status === "connected" ? "default" : "secondary"}
                  className="text-[10px] capitalize"
                >
                  {c.status}
                </Badge>
              </div>
              <p className="mt-3 text-sm font-semibold">
                {c._count.products}
                <span className="text-muted-foreground ml-1 text-xs font-normal">
                  product{c._count.products === 1 ? "" : "s"}
                </span>
              </p>
              <p className="text-muted-foreground mt-1 text-[11px]">
                {c.lastSyncedAt
                  ? `Last updated ${new Date(c.lastSyncedAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}`
                  : "Not synced yet"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
