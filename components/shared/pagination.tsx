"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface PaginationMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

interface PaginationProps {
  /** 1-indexed. */
  page: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
  /** Singular noun, e.g. "employee". Default "item". */
  itemLabel?: string
  /** Default true. */
  hideOnSinglePage?: boolean
  className?: string
}

export function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
  itemLabel = "item",
  hideOnSinglePage = true,
  className,
}: PaginationProps) {
  if (hideOnSinglePage && totalPages <= 1) return null

  const go = (p: number) => {
    const next = Math.min(Math.max(1, p), totalPages)
    if (next !== page) onPageChange(next)
  }

  return (
    <div className={cn("flex flex-col items-center justify-between gap-3 sm:flex-row", className)}>
      <p className="text-muted-foreground text-sm">
        Page {page} of {totalPages} &middot; {total} {itemLabel}
        {total !== 1 ? "s" : ""}
      </p>

      {/* Wrap, or "Next" falls off a phone screen (main is overflow-x-hidden). */}
      <div className="flex flex-wrap items-center justify-center gap-1">
        <Button
          className="gap-1"
          variant="outline"
          disabled={page <= 1}
          onClick={() => go(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Previous</span>
        </Button>

        {getPageWindow(page, totalPages).map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="text-muted-foreground px-1.5 text-sm">
              …
            </span>
          ) : (
            <Button
              key={p}
              variant={p === page ? "default" : "outline"}
              size="icon"
              className="p-0 tabular-nums"
              aria-current={p === page ? "page" : undefined}
              onClick={() => go(p)}
            >
              {p}
            </Button>
          ),
        )}

        <Button
          className="gap-1"
          variant="outline"
          disabled={page >= totalPages}
          onClick={() => go(page + 1)}
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

/** First, last, current and neighbours, with gaps: 1 … 4 [5] 6 … 20 */
function getPageWindow(page: number, totalPages: number): Array<number | "…"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  const pages: Array<number | "…"> = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(totalPages - 1, page + 1)
  if (start > 2) pages.push("…")
  for (let p = start; p <= end; p++) pages.push(p)
  if (end < totalPages - 1) pages.push("…")
  pages.push(totalPages)
  return pages
}
