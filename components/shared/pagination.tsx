"use client"

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export interface PaginationMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

export const PAGE_SIZES = [10, 20, 50, 100] as const

interface PaginationProps {
  /** 1-indexed. */
  page: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
  /** Singular noun, e.g. "employee". Default "item". */
  itemLabel?: string
  /** Default true (unless there is a rows-per-page choice to show). */
  hideOnSinglePage?: boolean
  className?: string
  /** Rows per page, for "21–40 of 95". */
  pageSize?: number
  /** Offers a rows-per-page choice. */
  onPageSizeChange?: (size: number) => void
  pageSizes?: readonly number[]
  /** The rows shown, when pageSize can't work it out (e.g. a short last page from the server). */
  range?: { start: number; end: number }
}

/** "21–40 of 95 employees · Rows per page · « ‹ Page 2 of 5 › »" - under every paged list. */
export function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
  itemLabel = "item",
  hideOnSinglePage = true,
  className,
  pageSize,
  onPageSizeChange,
  pageSizes = PAGE_SIZES,
  range,
}: PaginationProps) {
  if (hideOnSinglePage && totalPages <= 1 && !onPageSizeChange) return null

  const go = (p: number) => {
    const next = Math.min(Math.max(1, p), totalPages)
    if (next !== page) onPageChange(next)
  }
  const noun = `${itemLabel}${total === 1 ? "" : "s"}`
  const shown =
    range ??
    (pageSize
      ? { start: (page - 1) * pageSize + 1, end: Math.min(total, page * pageSize) }
      : undefined)

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-x-4 gap-y-2", className)}>
      <p className="text-muted-foreground text-xs tabular-nums">
        {shown && total > 0
          ? `${shown.start}–${shown.end} of ${total} ${noun}`
          : `${total} ${noun}`}
      </p>

      {/* Wrap, or the buttons fall off a phone screen (main is overflow-x-hidden). */}
      <div className="flex flex-wrap items-center gap-3">
        {onPageSizeChange ? (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">Rows per page</span>
            <Select
              value={String(pageSize ?? "")}
              onValueChange={(v) => onPageSizeChange(Number(v))}
            >
              <SelectTrigger className="h-8 w-[76px]" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizes.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {totalPages > 1 ? (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              aria-label="First page"
              disabled={page <= 1}
              onClick={() => go(1)}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              aria-label="Previous page"
              disabled={page <= 1}
              onClick={() => go(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-xs whitespace-nowrap tabular-nums">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              aria-label="Next page"
              disabled={page >= totalPages}
              onClick={() => go(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              aria-label="Last page"
              disabled={page >= totalPages}
              onClick={() => go(totalPages)}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
