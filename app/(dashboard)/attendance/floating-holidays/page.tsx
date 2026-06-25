"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { CalendarDays, Check } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination } from "@/components/shared/pagination"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn, formatDate } from "@/lib/utils"

interface Holiday {
  id: string
  name: string
  date: string
  description: string | null
  isOptional: boolean
}

interface FloatingData {
  year: number
  limit: number
  remaining: number
  optionalHolidays: Holiday[]
  selectedHolidayIds: string[]
}

const CURRENT_YEAR = new Date().getFullYear()

async function fetchFloating(year: number): Promise<{ data: FloatingData }> {
  const res = await fetch(`/api/attendance/floating-holidays?year=${year}`)
  if (!res.ok) throw new Error("Failed to load floating holidays")
  return res.json()
}

async function selectHoliday(holidayId: string): Promise<unknown> {
  const res = await fetch("/api/attendance/floating-holidays", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ holidayId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to select holiday" }))
    throw new Error(err.error?.message || "Failed to select holiday")
  }
  return res.json()
}

async function deselectHoliday(holidayId: string): Promise<unknown> {
  const res = await fetch(`/api/attendance/floating-holidays?holidayId=${holidayId}`, {
    method: "DELETE",
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to remove holiday" }))
    throw new Error(err.error?.message || "Failed to remove holiday")
  }
  return res.json()
}

export default function FloatingHolidaysPage() {
  const queryClient = useQueryClient()
  const [year, setYear] = useState(CURRENT_YEAR)
  const [page, setPage] = useState(1)

  // Reset to the first page whenever the year filter changes.
  function changeYear(next: number) {
    setYear(next)
    setPage(1)
  }

  const { data, isLoading } = useQuery({
    queryKey: ["floating-holidays", year],
    queryFn: () => fetchFloating(year),
  })
  const fd = data?.data

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["floating-holidays"] })

  const selectMut = useMutation({
    mutationFn: selectHoliday,
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  })
  const deselectMut = useMutation({
    mutationFn: deselectHoliday,
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  })
  const pending = selectMut.isPending || deselectMut.isPending

  const selected = new Set(fd?.selectedHolidayIds ?? [])
  const limit = fd?.limit ?? 3
  const usedCount = fd?.selectedHolidayIds.length ?? 0
  const atLimit = usedCount >= limit

  // Client-side pagination of the per-year optional-holiday list.
  const PAGE_SIZE = 10
  const optionalHolidays = fd?.optionalHolidays ?? []
  const totalPages = Math.max(1, Math.ceil(optionalHolidays.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pagedHolidays = optionalHolidays.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )

  function toggle(h: Holiday) {
    if (selected.has(h.id)) deselectMut.mutate(h.id)
    else selectMut.mutate(h.id)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Floating Holidays"
        description={`Pick up to ${limit} optional holidays you'd like to take off this year.`}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => changeYear(year - 1)}>
            &larr; {year - 1}
          </Button>
          <span className="bg-muted rounded px-3 py-1 text-sm font-medium">{year}</span>
          <Button variant="outline" size="sm" onClick={() => changeYear(year + 1)}>
            {year + 1} &rarr;
          </Button>
        </div>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium",
            atLimit ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground",
          )}
        >
          {usedCount} of {limit} selected
        </span>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded" />
          ))}
        </div>
      ) : !fd || fd.optionalHolidays.length === 0 ? (
        <div className="bg-card flex flex-col items-center justify-center rounded border py-20 text-center">
          <CalendarDays className="text-muted-foreground/40 mb-3 h-10 w-10" />
          <p className="text-muted-foreground text-sm">
            No optional holidays are configured for {year} yet.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {pagedHolidays.map((h) => {
            const isSel = selected.has(h.id)
            const disabled = pending || (!isSel && atLimit)
            return (
              <button
                key={h.id}
                type="button"
                onClick={() => !disabled && toggle(h)}
                disabled={disabled}
                className={cn(
                  "flex items-start justify-between gap-3 rounded border p-4 text-left transition-colors",
                  isSel ? "border-primary bg-primary/5" : "bg-card hover:bg-muted/40",
                  disabled && !isSel && "cursor-not-allowed opacity-50",
                )}
              >
                <div className="min-w-0">
                  <p className="font-medium">{h.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {formatDate(h.date, "EEE, dd MMM yyyy")}
                  </p>
                  {h.description && (
                    <p className="text-muted-foreground mt-1 truncate text-xs">{h.description}</p>
                  )}
                </div>
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                    isSel
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/30",
                  )}
                >
                  {isSel && <Check className="h-3.5 w-3.5" />}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <Pagination
        page={currentPage}
        totalPages={totalPages}
        total={optionalHolidays.length}
        onPageChange={setPage}
        itemLabel="holiday"
      />

      {atLimit && (
        <p className="text-muted-foreground text-xs">
          You&apos;ve used all {limit} picks. Remove one to choose a different holiday.
        </p>
      )}
    </div>
  )
}
