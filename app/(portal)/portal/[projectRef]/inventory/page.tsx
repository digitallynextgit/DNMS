import { redirect, notFound } from "next/navigation"
import { auth } from "@/server/auth"
import { listClientGrants } from "@/server/client-guard"
import { getClientInventory } from "@/features/client-portal/server/client-portal.queries"
import { cn } from "@/lib/utils"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "Inventory" }

interface Inventory {
  total: number
  outOfStock: number
  lowStock: number
  lowStockThreshold: number
  attention: Array<{
    id: string
    title: string
    sku: string | null
    imageUrl: string | null
    inventoryQty: number | null
    channel: { name: string } | null
  }>
}

export default async function PortalInventoryPage({
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
  if (!grant.modules.includes("inventory")) notFound()

  const result = await getClientInventory(projectRef)
  const inv = result.ok ? (result.data as { data: Inventory }).data : null

  const stats = [
    { label: "Products tracked", value: inv?.total ?? 0, tone: "" },
    { label: "Out of stock", value: inv?.outOfStock ?? 0, tone: "text-destructive" },
    {
      label: `Low stock (≤ ${inv?.lowStockThreshold ?? 5})`,
      value: inv?.lowStock ?? 0,
      tone: "text-amber-600 dark:text-amber-500",
    },
  ]

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Inventory</h1>
        <p className="text-muted-foreground text-sm">
          Stock levels, and what needs restocking first.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-card rounded-md border p-4">
            <p className="text-muted-foreground text-xs">{s.label}</p>
            <p className={cn("mt-1 text-2xl font-semibold tabular-nums", s.tone)}>{s.value}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold">Needs attention</h2>
        {!inv?.attention.length ? (
          <div className="text-muted-foreground rounded-md border border-dashed py-12 text-center text-sm">
            Nothing is running low right now.
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium">Product</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium">SKU</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium">Channel</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium">Stock</th>
                </tr>
              </thead>
              <tbody>
                {inv.attention.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-4 py-2.5">{p.title}</td>
                    <td className="text-muted-foreground px-4 py-2.5 text-xs">{p.sku ?? "-"}</td>
                    <td className="text-muted-foreground px-4 py-2.5 text-xs">
                      {p.channel?.name ?? "-"}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-2.5 text-right tabular-nums",
                        (p.inventoryQty ?? 0) <= 0
                          ? "text-destructive font-medium"
                          : "text-amber-600 dark:text-amber-500",
                      )}
                    >
                      {p.inventoryQty ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
