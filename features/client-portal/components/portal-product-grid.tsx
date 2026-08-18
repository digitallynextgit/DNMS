"use client"

import * as React from "react"
import { useQuery, keepPreviousData } from "@tanstack/react-query"
import { Search, PackageOpen } from "lucide-react"

import { apiFetch } from "@/lib/api-fetch"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

interface ProductCard {
  id: string
  title: string
  sku: string | null
  imageUrl: string | null
  vendor: string | null
  category: string | null
  price: string | null
  compareAtPrice: string | null
  currency: string
  inventoryQty: number | null
  status: string
  tags: string[]
  url: string | null
  channel: { id: string; name: string; provider: string } | null
}

// The API envelope nests twice: withClientSession → respond() → ok(result.data),
// where result.data is itself { data, pagination }. Same shape the leave hooks
// unwrap - see features/leave/hooks/use-leave.ts.
interface ProductsResponse {
  data: {
    data: ProductCard[]
    pagination: { page: number; pageSize: number; total: number; totalPages: number }
  }
}

function money(amount: string | null, currency: string): string | null {
  if (amount === null) return null
  const n = Number(amount)
  if (Number.isNaN(n)) return null
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(n)
  } catch {
    // An unknown/invalid ISO code must not blank the whole price.
    return `${currency} ${n.toFixed(2)}`
  }
}

function stockLabel(qty: number | null): { text: string; tone: string } {
  if (qty === null) return { text: "Stock not tracked", tone: "text-muted-foreground" }
  if (qty <= 0) return { text: "Out of stock", tone: "text-destructive" }
  if (qty <= 5) return { text: `Low stock · ${qty}`, tone: "text-amber-600 dark:text-amber-500" }
  return { text: `${qty} in stock`, tone: "text-muted-foreground" }
}

/** The client-facing catalog for one project. */
export function PortalProductGrid({ projectRef }: { projectRef: string }) {
  const [search, setSearch] = React.useState("")
  const [debounced, setDebounced] = React.useState("")
  const [page, setPage] = React.useState(1)

  // Debounce so typing doesn't fire a query per keystroke.
  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const { data, isPending, isError, error } = useQuery({
    queryKey: ["portal-products", projectRef, debounced, page],
    queryFn: async () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: "24" })
      if (debounced) qs.set("search", debounced)
      const res = await apiFetch<ProductsResponse>(
        `/api/portal/projects/${projectRef}/products?${qs}`,
      )
      return res.data
    },
    placeholderData: keepPreviousData,
  })

  const products = data?.data ?? []
  const pagination = data?.pagination

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products or SKU"
            className="h-9 pl-9 text-sm"
          />
        </div>
        {pagination && pagination.total > 0 && (
          <p className="text-muted-foreground text-xs">
            {pagination.total} product{pagination.total === 1 ? "" : "s"}
          </p>
        )}
      </div>

      {isError && (
        <p className="text-destructive text-sm">
          {error instanceof Error ? error.message : "Could not load products."}
        </p>
      )}

      {isPending && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-sm" />
          ))}
        </div>
      )}

      {!isPending && !isError && products.length === 0 && (
        <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-sm border border-dashed py-16 text-center">
          <PackageOpen className="h-7 w-7" />
          <p className="text-sm font-medium">No products yet</p>
          <p className="max-w-sm text-xs">
            {debounced
              ? "Nothing matched that search."
              : "Once your store is connected, your catalog will appear here."}
          </p>
        </div>
      )}

      {products.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => {
            const stock = stockLabel(p.inventoryQty)
            const price = money(p.price, p.currency)
            const compareAt = money(p.compareAtPrice, p.currency)
            return (
              <article
                key={p.id}
                className="bg-card flex flex-col overflow-hidden rounded-sm border"
              >
                <div className="bg-muted relative aspect-square">
                  {p.imageUrl ? (
                    // Remote storefront images: <img> rather than next/image so a
                    // new marketplace domain doesn't need a next.config change.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.imageUrl}
                      alt={p.title}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="text-muted-foreground flex h-full items-center justify-center">
                      <PackageOpen className="h-6 w-6" />
                    </div>
                  )}
                  {p.status !== "active" && (
                    <Badge variant="secondary" className="absolute top-2 left-2 text-[10px]">
                      {p.status}
                    </Badge>
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-1.5 p-3">
                  <h3 className="line-clamp-2 text-sm leading-snug font-medium">{p.title}</h3>
                  {p.sku && <p className="text-muted-foreground text-[11px]">SKU {p.sku}</p>}

                  <div className="mt-auto space-y-1.5 pt-2">
                    {price && (
                      <p className="flex items-baseline gap-1.5 text-sm font-semibold">
                        {price}
                        {compareAt && compareAt !== price && (
                          <span className="text-muted-foreground text-[11px] font-normal line-through">
                            {compareAt}
                          </span>
                        )}
                      </p>
                    )}
                    <p className={cn("text-[11px]", stock.tone)}>{stock.text}</p>
                    {p.channel && (
                      <p className="text-muted-foreground truncate text-[11px]">{p.channel.name}</p>
                    )}
                    {p.url && (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary inline-block text-[11px] hover:underline"
                      >
                        View listing
                      </a>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="text-muted-foreground text-xs">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
